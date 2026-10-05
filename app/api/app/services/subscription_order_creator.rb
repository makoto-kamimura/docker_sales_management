# 定期便の請求 (Stripe の invoice.paid) ごとに、1回分のお届けの注文を作り、入金確認へ進める。
# 同じ請求から注文を二度作らない (orders.stripe_invoice_id)。
# 在庫が足りないときは「注文受付」のまま履歴にメモを残し、店舗が在庫を補充してから入金確認へ進める
class SubscriptionOrderCreator
  def initialize(subscription, invoice_id:)
    @subscription = subscription
    @invoice_id = invoice_id
  end

  def call
    existing = Order.find_by(stripe_invoice_id: @invoice_id)
    return existing if existing

    sub = @subscription
    product = sub.product
    item = { product: product, unit_price_cents: sub.unit_price, quantity: sub.quantity }
    shortage = nil

    order = Order.create!(
      user: sub.user,
      address: product.physical? ? sub.address : nil,
      subscription: sub,
      payment_kind: "card",
      stripe_invoice_id: @invoice_id,
      status: "received",
      currency: product.currency,
      **Pricing.calc([item]),
      placed_at: Time.current
    )
    order.items.create!(product: product, quantity: item[:quantity], unit_price_cents: item[:unit_price_cents],
                        line_total_cents: item[:unit_price_cents] * item[:quantity])
    order.events.create!(status: "received", actor: sub.user, note: "定期便 (#{sub.subscription_plan.name}) の請求")
    if product.physical?
      order.create_shipment!(status: "preparing")
      begin
        product.inventory.reserve!(item[:quantity])
      rescue ApplicationController::NotFoundError => e # Inventory は在庫不足をこの例外で通知する
        shortage = e.message
      end
    end

    delivery = sub.deliveries.find_or_initialize_by(scheduled_on: Date.current)
    delivery.update!(order: order) if delivery.order_id.nil?

    if shortage
      order.note!("カード決済済み (定期便)。#{shortage} のため入金確認に進めませんでした。在庫を補充してから入金確認へ進めてください")
    else
      confirm_payment!(order)
    end
    order
  end

  private

  def confirm_payment!(order)
    Order.transaction(requires_new: true) do
      OrderWorkflow.new(order).transition!("paid", note: "カード決済 (Stripe・定期便)")
    end
  rescue OrderWorkflow::Error => e
    order.reload.note!("カード決済済み (定期便)。入金確認に進めませんでした: #{e.message}")
  end
end
