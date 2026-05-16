module Api
  module V1
    class OrdersController < BaseController
      before_action :authenticate!

      def index
        page, per = pagination_params
        scope = current_user.orders.recent
        set_pagination_headers(scope, page: page, per: per)
        render json: scope.offset((page - 1) * per).limit(per).map { |o| summary(o) }
      end

      def show
        order = current_user.orders.find(params[:id])
        render json: detail(order)
      end

      # 注文確定 (要件1)
      def create
        address = current_user.addresses.find(params.require(:address_id))
        pm = params[:payment_method_id] ? current_user.payment_methods.find(params[:payment_method_id]) : nil

        cart = current_user.cart || raise(ApplicationController::NotFoundError, "カートが見つかりません")
        order = OrderCreator.new(user: current_user, address: address, payment_method: pm).call(cart)
        render json: detail(order), status: :created
      rescue OrderCreator::Error => e
        render_error(code: "order_failed", message: e.message, status: :unprocessable_entity)
      end

      private

      def summary(o)
        { id: o.id, status: o.status, total_cents: o.total_cents, currency: o.currency,
          placed_at: o.placed_at, item_count: o.items.size }
      end

      def detail(o)
        summary(o).merge(
          subtotal_cents: o.subtotal_cents,
          tax_cents: o.tax_cents,
          shipping_cents: o.shipping_cents,
          stripe_payment_intent_id: o.stripe_payment_intent_id,
          shipment: o.shipment && o.shipment.attributes.slice("status", "carrier", "tracking_number", "shipped_at", "delivered_at"),
          items: o.items.includes(:product).map { |i|
            { product_id: i.product_id, name: i.product.name, quantity: i.quantity,
              unit_price_cents: i.unit_price_cents, line_total_cents: i.line_total_cents }
          }
        )
      end
    end
  end
end
