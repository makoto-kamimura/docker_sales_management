module Api
  module V1
    class OrdersController < BaseController
      before_action :authenticate!

      def index
        page, per = pagination_params
        scope = current_user.orders.recent
        set_pagination_headers(scope, page: page, per: per)
        render json: scope.includes(:items).offset((page - 1) * per).limit(per).map { |o| summary(o) }
      end

      def show
        order = current_user.orders.includes(:events, :shipment, items: { product: { model_asset: :assembly_steps } }).find(params[:id])
        render json: detail(order)
      end

      # 注文確定 (要件1)。address_id はデジタル商品のみの注文なら省略可
      def create
        address = params[:address_id].present? ? current_user.addresses.find(params[:address_id]) : nil
        pm = params[:payment_method_id] ? current_user.payment_methods.find(params[:payment_method_id]) : nil

        cart = current_user.cart || raise(ApplicationController::NotFoundError, "カートが見つかりません")
        order = OrderCreator.new(user: current_user, address: address, payment_method: pm).call(cart)
        render json: detail(order), status: :created
      rescue OrderCreator::Error => e
        render_error(code: "order_failed", message: e.message, status: :unprocessable_entity)
      end

      private

      def summary(o)
        { id: o.id, status: o.status, status_label: o.status_label, total_cents: o.total_cents, currency: o.currency,
          placed_at: o.placed_at, item_count: o.items.size }
      end

      def detail(o)
        summary(o).merge(
          subtotal_cents: o.subtotal_cents,
          tax_cents: o.tax_cents,
          shipping_cents: o.shipping_cents,
          stripe_payment_intent_id: o.stripe_payment_intent_id,
          downloadable: o.downloadable?,
          # 0円の商品を含む注文は投げ銭できる
          accepts_tips: o.accepts_tips?,
          tips: o.tips.recent.map(&:api_attributes),
          # 制作・発送の進捗 (見える化)。物販品を含まない注文は制作工程がない
          physical: o.physical?,
          due_on: o.due_on,
          events: o.events.reject { |e| e.from_status == e.status } # 担当変更などステータスが変わらない履歴は除く
                   .map { |e| { status: e.status, status_label: Order::STATUS_LABELS[e.status], created_at: e.created_at } },
          shipment: o.shipment && o.shipment.attributes.slice("status", "carrier", "tracking_number", "shipped_at", "delivered_at"),
          items: o.items.map { |i|
            { product_id: i.product_id, name: i.product.name, quantity: i.quantity,
              unit_price_cents: i.unit_price_cents, line_total_cents: i.line_total_cents,
              is_digital: i.product.is_digital, has_assembly: i.product.assembly_guide? }
          }
        )
      end
    end
  end
end
