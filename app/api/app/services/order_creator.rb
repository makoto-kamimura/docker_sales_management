class OrderCreator
  class Error < StandardError; end

  # address はデジタル商品のみの注文なら nil でよい。
  # payment_kind: card (このあと Stripe Checkout で支払う) / transfer (振込など。店舗が入金を確認する)
  def initialize(user:, address:, payment_kind: "transfer")
    @user = user
    @address = address
    @payment_kind = payment_kind
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
    free = totals[:total_cents].zero?
    if @payment_kind == "card" && !free && totals[:total_cents] < StripeService::MIN_AMOUNT_CENTS
      raise Error, "カード決済は#{StripeService::MIN_AMOUNT_CENTS}円以上のご注文で使えます"
    end

    order = nil
    ActiveRecord::Base.transaction do
      order = Order.create!(
        user: @user,
        address: physical ? @address : nil,
        payment_kind: free ? "free" : @payment_kind,
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

    # 0円の注文 (無料配布の商品だけ) は支払いがないので入金確認を省略する (デジタル商品だけなら完了になる)。
    # それ以外は「注文受付」のまま。カードは Stripe の Webhook、振込などは店舗が入金を確認して進める
    OrderWorkflow.new(order).transition!("paid", note: "0円のため入金確認を省略") if free
    order
  end
end
