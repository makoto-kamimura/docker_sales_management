module Api
  module V1
    class CartsController < BaseController
      before_action :authenticate!

      def show
        cart = current_user.cart || current_user.create_cart!
        render json: serialize(cart)
      end

      private

      def serialize(cart)
        items = cart.items.includes(:product).to_a
        # 注文と同じ計算 (Pricing) で、注文確認画面に税・送料込みの合計を出す
        totals = Pricing.calc(items.map { |i| { product: i.product, unit_price_cents: i.product.price_cents, quantity: i.quantity } })
        {
          id: cart.id,
          total_items: cart.total_items,
          subtotal_cents: cart.subtotal_cents,
          tax_cents: totals[:tax_cents],
          shipping_cents: totals[:shipping_cents],
          total_cents: totals[:total_cents],
          currency: items.first&.product&.currency || "JPY",
          # デジタル商品のみなら配送先は不要
          requires_shipping: items.any? { |i| i.product.physical? },
          items: items.map { |i|
            {
              id: i.id,
              product_id: i.product_id,
              name: i.product.name,
              unit_price_cents: i.product.price_cents,
              quantity: i.quantity,
              line_total_cents: i.line_total_cents,
              is_digital: i.product.is_digital
            }
          }
        }
      end
    end
  end
end
