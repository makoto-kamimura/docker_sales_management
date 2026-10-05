require "stripe"

# カード決済 (Stripe)。支払いは Stripe Checkout、定期便の支払いカードの変更は Customer Portal の画面で行い、
# カード情報はこのサーバーを通さない。支払いの結果は Webhook (StripeWebhookHandler) で注文・投げ銭・定期便に反映する。
#
# STRIPE_SECRET_KEY と STRIPE_WEBHOOK_SECRET の両方がなければカード決済は無効 (API は 503、画面はカードの選択肢を出さない)。
# STRIPE_API_BASE は接続先を差し替えるとき (stripe-mock など) だけ指定する。
class StripeService
  class Error < StandardError; end
  class Disabled < StandardError; end

  # Stripe で JPY を決済できる最低額
  MIN_AMOUNT_CENTS = 50
  TIME_ZONE = "Asia/Tokyo"

  def self.enabled?
    ENV["STRIPE_SECRET_KEY"].present? && ENV["STRIPE_WEBHOOK_SECRET"].present?
  end

  def self.ensure_enabled!
    raise Disabled, "カード決済は準備中です" unless enabled?
  end

  def self.webhook_secret
    ENV.fetch("STRIPE_WEBHOOK_SECRET", "")
  end

  # 決済の画面から戻る先 (Web の公開 URL)
  def self.app_base_url
    ENV.fetch("APP_BASE_URL", "http://localhost").chomp("/")
  end

  def initialize
    self.class.ensure_enabled!
    @client = Stripe::StripeClient.new(ENV.fetch("STRIPE_SECRET_KEY"), api_base: ENV["STRIPE_API_BASE"].presence)
  end

  def ensure_customer(user)
    return user.stripe_customer_id if user.stripe_customer_id.present?

    customer = call { @client.v1.customers.create(email: user.email, name: user.name, metadata: { user_id: user.id.to_s }) }
    user.update!(stripe_customer_id: customer.id)
    customer.id
  end

  # 1回払い (注文・投げ銭)。line_items: [{ name:, amount:, quantity: }]。
  # metadata の kind (order / tip) と ID で、Webhook が支払いの対象を見分ける
  def create_payment_checkout(user:, line_items:, metadata:, success_url:, cancel_url:, currency: "JPY")
    customer = ensure_customer(user)
    call do
      @client.v1.checkout.sessions.create(
        mode: "payment",
        customer: customer,
        payment_method_types: ["card"],
        line_items: line_items.map { |li|
          { quantity: li.fetch(:quantity, 1),
            price_data: { currency: currency.downcase, unit_amount: li[:amount], product_data: { name: li[:name] } } }
        },
        client_reference_id: user.id.to_s,
        metadata: metadata,
        payment_intent_data: { metadata: metadata },
        success_url: success_url,
        cancel_url: cancel_url,
        locale: "ja"
      )
    end
  end

  # 定期便の申し込み。お届けの間隔ごとに、割引後の単価 × 数量 (税・送料込み) を請求する
  def create_subscription_checkout(subscription, success_url:, cancel_url:)
    customer = ensure_customer(subscription.user)
    metadata = { kind: "subscription", subscription_id: subscription.id.to_s }
    call do
      @client.v1.checkout.sessions.create(
        mode: "subscription",
        customer: customer,
        payment_method_types: ["card"],
        line_items: [{
          quantity: 1,
          price_data: {
            currency: subscription.product.currency.downcase,
            unit_amount: subscription.charge_cents,
            recurring: { interval: "day", interval_count: subscription.interval_days },
            product_data: { name: "定期便: #{subscription.product.name} × #{subscription.quantity}" }
          }
        }],
        client_reference_id: subscription.user_id.to_s,
        metadata: metadata,
        subscription_data: { metadata: metadata },
        success_url: success_url,
        cancel_url: cancel_url,
        locale: "ja"
      )
    end
  end

  # 支払いカードの変更などの画面 (Customer Portal)
  def create_portal_session(user, return_url:)
    raise Error, "カード払いの定期便がありません" if user.stripe_customer_id.blank?

    call { @client.v1.billing_portal.sessions.create(customer: user.stripe_customer_id, return_url: return_url, locale: "ja") }
  end

  # 開いたままの決済の画面を閉じる (作り直すときの二重払いを防ぐ)。完了・失効済みならエラーになるので無視する
  def expire_checkout_session(session_id)
    return if session_id.blank?

    @client.v1.checkout.sessions.expire(session_id)
  rescue Stripe::StripeError => e
    Rails.logger.info("Stripe checkout session #{session_id} not expired: #{e.message}")
  end

  # 一時停止中の請求は取り消す (お届けしない)
  def pause_subscription(stripe_subscription_id)
    call { @client.v1.subscriptions.update(stripe_subscription_id, pause_collection: { behavior: "void" }) }
  end

  def resume_subscription(stripe_subscription_id)
    call { @client.v1.subscriptions.update(stripe_subscription_id, pause_collection: "") }
  end

  # 次の請求 (お届け) の日をずらす。それまでの期間は請求しない
  def reschedule_subscription(stripe_subscription_id, next_on)
    at = next_on.in_time_zone(TIME_ZONE).change(hour: 9)
    call { @client.v1.subscriptions.update(stripe_subscription_id, trial_end: at.to_i, proration_behavior: "none") }
  end

  def cancel_subscription(stripe_subscription_id)
    call { @client.v1.subscriptions.cancel(stripe_subscription_id) }
  end

  private

  def call
    yield
  rescue Stripe::StripeError => e
    Rails.logger.warn("Stripe error: #{e.class}: #{e.message}")
    raise Error, "決済サービスに接続できませんでした。時間をおいてから、もう一度お試しください"
  end
end
