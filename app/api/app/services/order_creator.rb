class OrderCreator
  class Error < StandardError; end

  # address はデジタル商品のみの注文なら nil でよい
  def initialize(user:, address:, payment_method:)
    @user = user
    @address = address
    @payment_method = payment_method
  end

  def call(cart)
    raise Error, "カートが空です" if cart.items.empty?

    items = cart.items.includes(product: [:inventory, { model_file_attachment: :blob }]).map do |ci|
      product = ci.product
      raise Error, "在庫不足: #{product.name}" unless product.in_stock?(ci.quantity)
      raise Error, "購入済みのデータです: #{product.name}" if @user.owns_digital?(product)
      {
        product: product,
        unit_price_cents: product.price_cents,
        quantity: product.is_digital? ? 1 : ci.quantity # データは1ライセンス単位
      }
    end

    physical = items.any? { |i| i[:product].physical? }
    raise Error, "配送先を指定してください" if physical && @address.nil?

    totals = Pricing.calc(items)

    order = nil
    ActiveRecord::Base.transaction do
      order = Order.create!(
        user: @user,
        address: physical ? @address : nil,
        payment_method: @payment_method,
        status: "received",
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
        i[:product].inventory.reserve!(i[:quantity]) if i[:product].physical?
      end

      Shipment.create!(order: order, status: "preparing") if physical
      order.events.create!(status: "received", actor: @user)
      cart.items.destroy_all
    end

    # 0円の注文 (無料配布の商品だけ) は支払いがないので入金確認を省略する (デジタル商品だけなら完了になる)
    if order.total_cents.zero?
      OrderWorkflow.new(order).transition!("paid", note: "0円のため入金確認を省略")
    else
      pay_and_confirm!(order)
    end
    order
  end

  private

  def pay_and_confirm!(order)
    return unless @payment_method && @user.stripe_customer_id

    intent = StripeService.new.create_payment_intent(order, payment_method_id: @payment_method.stripe_payment_method_id)
    order.update!(stripe_payment_intent_id: intent.id)
    # 入金確認: 在庫の確定引き当て (デジタル商品のみなら自動で完了) は OrderWorkflow が行う
    OrderWorkflow.new(order).transition!("paid", note: "Stripe決済") if intent.status == "succeeded"
  rescue StripeService::Error => e
    Rails.logger.warn("Stripe payment failed for order #{order.id}: #{e.message}")
    # 在庫の仮押さえはキャンセル時に OrderWorkflow が解除する
  end
end
