module Pricing
  TAX_RATE = 0.10
  SHIPPING_FLAT_CENTS = 500_00 # 500円 (JPY は小数なしなので *_cents は実質「円」)

  module_function

  def calc(items)
    subtotal = items.sum { |i| i[:unit_price_cents] * i[:quantity] }
    tax = (subtotal * TAX_RATE).round
    shipping = subtotal >= 500_000 ? 0 : SHIPPING_FLAT_CENTS
    total = subtotal + tax + shipping
    { subtotal_cents: subtotal, tax_cents: tax, shipping_cents: shipping, total_cents: total }
  end
end
