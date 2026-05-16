class OrderCreator
  class Error < StandardError; end

  def initialize(user:, address:, payment_method:)
    @user = user
    @address = address
    @payment_method = payment_method
  end

  def call(cart)
    raise Error, "カートが空です" if cart.items.empty?

    items = cart.items.includes(:product).map do |ci|
      raise Error, "在庫不足: #{ci.product.name}" unless ci.product.in_stock?(ci.quantity)
      {
        product: ci.product,
        unit_price_cents: ci.product.price_cents,
        quantity: ci.quantity
      }
    end

    totals = Pricing.calc(items)

    order = nil
    ActiveRecord::Base.transaction do
      order = Order.create!(
        user: @user,
        address: @address,
        payment_method: @payment_method,
        status: "pending",
        currency: items.first[:product].currency,
        **totals,
        placed_at: Time.current
      )

      items.each do |i|
        OrderItem.create!(
          order: order,
          product: i[:product],
          quantity: i[:quantity],
          unit_price_cents: i[:unit_price_cents],
          line_total_cents: i[:unit_price_cents] * i[:quantity]
        )
        i[:product].inventory.reserve!(i[:quantity])
      end

      Shipment.create!(order: order, status: "preparing")
      cart.items.destroy_all
    end

    pay_and_confirm!(order)
    order
  end

  private

  def pay_and_confirm!(order)
    return unless @payment_method && @user.stripe_customer_id

    intent = StripeService.new.create_payment_intent(order, payment_method_id: @payment_method.stripe_payment_method_id)
    order.update!(stripe_payment_intent_id: intent.id)
    if intent.status == "succeeded"
      order.transition_to!("paid")
      order.items.each { |it| it.product.inventory.consume!(it.quantity) }
    end
  rescue StripeService::Error => e
    Rails.logger.warn("Stripe payment failed for order #{order.id}: #{e.message}")
    # 在庫の解放は注文キャンセル時にまとめて行う方針
  end
end
