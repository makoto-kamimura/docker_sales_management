# Stripe からの通知 (Webhook) を検証して、注文・投げ銭・定期便に反映する。
#
# - 署名が正しくなければ InvalidSignature (400)。同じイベントは二度処理しない (stripe_webhook_events)
# - 1回払いの決済の画面 (Checkout) は metadata の kind (order / tip / subscription) で対象を見分ける
# - 定期便の請求 (invoice.paid) ごとに、お届け分の注文を作る
# - 決済は済んだのに注文を進められないとき (キャンセル済み・在庫不足など) は、例外にせず注文の履歴にメモを残す。
#   例外にすると Stripe が同じ通知を送り直し続けるため
class StripeWebhookHandler
  class InvalidSignature < StandardError; end

  def initialize(payload, signature)
    @payload = payload
    @signature = signature
  end

  def call
    StripeService.ensure_enabled!
    event = verify!

    ActiveRecord::Base.transaction do
      next unless StripeWebhookEvent.record!(event["id"], event["type"])

      object = event.dig("data", "object") || {}
      case event["type"]
      when "checkout.session.completed" then checkout_completed(object)
      when "checkout.session.expired"   then checkout_expired(object)
      when "invoice.paid"               then invoice_paid(object)
      when "invoice.payment_failed"     then invoice_payment_failed(object)
      when "customer.subscription.updated", "customer.subscription.deleted"
        subscription_changed(object, deleted: event["type"] == "customer.subscription.deleted")
      end
    end
  end

  private

  def verify!
    Stripe::Webhook::Signature.verify_header(@payload, @signature, StripeService.webhook_secret)
    JSON.parse(@payload)
  rescue Stripe::SignatureVerificationError, JSON::ParserError
    raise InvalidSignature, "署名を確認できません"
  end

  # --- 決済の画面 (Checkout)

  def checkout_completed(session)
    return unless %w[paid no_payment_required].include?(session["payment_status"])

    meta = session["metadata"] || {}
    case meta["kind"]
    when "order"        then order_paid(session, meta["order_id"])
    when "tip"          then tip_paid(session, meta["tip_id"])
    when "subscription" then subscription_started(session, meta["subscription_id"])
    end
  end

  def order_paid(session, order_id)
    order = Order.lock.find_by(id: order_id)
    return Rails.logger.warn("Stripe checkout for unknown order #{order_id}") unless order

    order.update!(stripe_payment_intent_id: session["payment_intent"], stripe_checkout_session_id: session["id"],
                  payment_kind: "card")
    if order.status == "cancelled"
      order.note!("キャンセル後にカード決済を受け付けました (Stripe)。返金してください")
    elsif order.paid_at
      order.note!("入金確認済みの注文にカード決済がありました (Stripe)。二重の支払いでないか確認してください")
    else
      begin
        Order.transaction(requires_new: true) do
          OrderWorkflow.new(order).transition!("paid", note: "カード決済 (Stripe)")
        end
      rescue OrderWorkflow::Error => e
        order.reload.note!("カード決済を受け付けましたが、入金確認に進めませんでした: #{e.message}")
      end
    end
  end

  def tip_paid(session, tip_id)
    tip = Tip.lock.find_by(id: tip_id)
    return Rails.logger.warn("Stripe checkout for unknown tip #{tip_id}") unless tip
    return if tip.status == "paid"

    # 取り消した後に支払われた場合も、受け取った分は入金済みにする
    tip.update!(status: "paid", paid_at: Time.current, payment_kind: "card",
                stripe_payment_intent_id: session["payment_intent"], stripe_checkout_session_id: session["id"])
  end

  def subscription_started(session, subscription_id)
    sub = Subscription.lock.find_by(id: subscription_id)
    return Rails.logger.warn("Stripe checkout for unknown subscription #{subscription_id}") unless sub

    attrs = { stripe_checkout_session_id: session["id"] }
    attrs[:stripe_subscription_id] = session["subscription"] if session["subscription"].present?
    attrs[:status] = "active" if sub.status == "incomplete"
    sub.update!(attrs)
  end

  # 決済の画面の期限切れ。注文・投げ銭はそのまま (払い直せる)、申し込み手続き中の定期便は取り消す
  def checkout_expired(session)
    meta = session["metadata"] || {}
    case meta["kind"]
    when "order"
      Order.where(id: meta["order_id"], stripe_checkout_session_id: session["id"]).update_all(stripe_checkout_session_id: nil)
    when "tip"
      Tip.where(id: meta["tip_id"], stripe_checkout_session_id: session["id"]).update_all(stripe_checkout_session_id: nil)
    when "subscription"
      Subscription.where(id: meta["subscription_id"], status: "incomplete", stripe_checkout_session_id: session["id"])
                  .find_each(&:cancel!)
    end
  end

  # --- 定期便の請求

  def invoice_paid(invoice)
    sub = find_subscription(subscription_metadata(invoice), invoice_subscription_id(invoice))
    return unless sub
    return if invoice["amount_paid"].to_i <= 0 # 0円の請求 (お届け日をずらしたときなど) はお届けしない

    SubscriptionOrderCreator.new(sub, invoice_id: invoice["id"]).call
    sub.update!(status: "active") if %w[incomplete past_due].include?(sub.status)
  end

  def invoice_payment_failed(invoice)
    sub = find_subscription(subscription_metadata(invoice), invoice_subscription_id(invoice))
    sub.update!(status: "past_due") if sub && sub.status != "cancelled"
  end

  # 契約の状態・次の請求日 (= 次回お届け日) を反映する
  def subscription_changed(stripe_sub, deleted:)
    sub = find_subscription(stripe_sub["metadata"] || {}, stripe_sub["id"])
    return unless sub

    status = deleted ? "cancelled" : local_status(stripe_sub)
    attrs = { status: status }
    next_at = stripe_sub["status"] == "trialing" ? stripe_sub["trial_end"] : nil
    next_at ||= stripe_sub.dig("items", "data", 0, "current_period_end") || stripe_sub["current_period_end"]
    attrs[:next_delivery_on] = Time.zone.at(next_at).in_time_zone(StripeService::TIME_ZONE).to_date if next_at && status != "cancelled"
    sub.update!(attrs)
  end

  def local_status(stripe_sub)
    case stripe_sub["status"]
    when "active", "trialing" then stripe_sub["pause_collection"].present? ? "paused" : "active"
    when "paused"             then "paused"
    when "past_due", "unpaid" then "past_due"
    when "incomplete"         then "incomplete"
    else "cancelled" # canceled・incomplete_expired
    end
  end

  def subscription_metadata(invoice)
    invoice.dig("parent", "subscription_details", "metadata") || invoice.dig("subscription_details", "metadata") || {}
  end

  def invoice_subscription_id(invoice)
    invoice.dig("parent", "subscription_details", "subscription") || invoice["subscription"]
  end

  # 申し込みの通知より先に請求の通知が届くことがあるので、metadata の購読 ID でも探す
  def find_subscription(metadata, stripe_subscription_id)
    sub = Subscription.lock.find_by(stripe_subscription_id: stripe_subscription_id) if stripe_subscription_id.present?
    sub ||= Subscription.lock.find_by(id: metadata["subscription_id"]) if metadata["subscription_id"].present?
    unless sub
      Rails.logger.warn("Stripe event for unknown subscription #{stripe_subscription_id}")
      return
    end

    sub.update!(stripe_subscription_id: stripe_subscription_id) if sub.stripe_subscription_id.blank? && stripe_subscription_id.present?
    sub
  end
end
