module Api
  module V1
    class CartItemsController < BaseController
      before_action :authenticate!

      def create
        cart = current_user.cart || current_user.create_cart!
        product = Product.find(params.require(:product_id))
        qty = params.fetch(:quantity, 1).to_i.clamp(1, 99)

        item = cart.items.find_or_initialize_by(product: product)
        item.quantity = (item.new_record? ? 0 : item.quantity) + qty
        item.save!

        render json: serialize(item), status: :created
      end

      def update
        item = current_user.cart.items.find(params[:id])
        item.update!(quantity: params.require(:quantity).to_i.clamp(1, 99))
        render json: serialize(item)
      end

      def destroy
        item = current_user.cart.items.find(params[:id])
        item.destroy!
        head :no_content
      end

      private

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
