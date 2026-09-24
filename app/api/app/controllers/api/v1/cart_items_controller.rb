module Api
  module V1
    class CartItemsController < BaseController
      before_action :authenticate!

      def create
        cart = current_user.cart || current_user.create_cart!
        product = Product.find(params.require(:product_id))
        if current_user.owns_digital?(product)
          return render_error(code: "already_purchased", message: "購入済みのデータです。注文履歴から再ダウンロードできます",
                              status: :unprocessable_entity)
        end
        qty = params.fetch(:quantity, 1).to_i.clamp(1, 99)

        item = cart.items.find_or_initialize_by(product: product)
        item.quantity = clamp_quantity(product, (item.new_record? ? 0 : item.quantity) + qty)
        item.save!

        render json: serialize(item), status: :created
      end

      def update
        item = current_user.cart.items.find(params[:id])
        item.update!(quantity: clamp_quantity(item.product, params.require(:quantity).to_i))
        render json: serialize(item)
      end

      def destroy
        item = current_user.cart.items.find(params[:id])
        item.destroy!
        head :no_content
      end

      private

      # デジタル商品は1ライセンス単位なので数量は常に 1
      def clamp_quantity(product, qty)
        product.is_digital? ? 1 : qty.clamp(1, 99)
      end

      def serialize(i)
        {
          id: i.id, product_id: i.product_id, quantity: i.quantity,
          unit_price_cents: i.product.price_cents,
          line_total_cents: i.line_total_cents
        }
      end
    end
  end
end
