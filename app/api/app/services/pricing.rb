module Pricing
  TAX_RATE = 0.10
  # JPY は小数なしなので *_cents は実質「円」
  SHIPPING_FLAT_CENTS = 500             # 送料 500円
  FREE_SHIPPING_THRESHOLD_CENTS = 5_000 # 小計 5,000円以上で送料無料

  module_function

  # items: [{ product:, unit_price_cents:, quantity: }]
  def calc(items)
    subtotal = items.sum { |i| i[:unit_price_cents] * i[:quantity] }
    tax = (subtotal * TAX_RATE).round
    # デジタル商品 (ダウンロード販売) のみの注文は送料なし
    physical = items.any? { |i| i[:product].physical? }
    shipping = !physical || subtotal >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS
    total = subtotal + tax + shipping
    { subtotal_cents: subtotal, tax_cents: tax, shipping_cents: shipping, total_cents: total }
  end
end
