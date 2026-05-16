module Api
  module V1
    module Admin
      class OrdersController < BaseController
        def index
          page, per = pagination_params
          scope = Order.recent
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.for_period(parse_date(params[:from]), parse_date(params[:to]))

          set_pagination_headers(scope, page: page, per: per)
          render json: scope.includes(:user).offset((page - 1) * per).limit(per).map { |o| serialize(o) }
        end

        def show
          render json: detail(Order.find(params[:id]))
        end

        def update
          order = Order.find(params[:id])
          if (new_status = params[:status])
            order.transition_to!(new_status)
            if new_status == "shipped"
              order.shipment&.update!(status: "shipped", shipped_at: Time.current,
                                      carrier: params[:carrier], tracking_number: params[:tracking_number])
            elsif new_status == "delivered"
              order.shipment&.update!(status: "delivered", delivered_at: Time.current)
            end
          end
          render json: detail(order.reload)
        end

        private

        def parse_date(s)
          s.present? ? Date.parse(s.to_s) : nil
        end

        def serialize(o)
          {
            id: o.id, user: { id: o.user_id, email: o.user.email, name: o.user.name },
            status: o.status, total_cents: o.total_cents, currency: o.currency,
            placed_at: o.placed_at
          }
        end

        def detail(o)
          serialize(o).merge(
            items: o.items.includes(:product).map { |i|
              { product_id: i.product_id, name: i.product.name, quantity: i.quantity, line_total_cents: i.line_total_cents }
            },
            shipment: o.shipment&.attributes&.slice("status", "carrier", "tracking_number", "shipped_at", "delivered_at")
          )
        end
      end
    end
  end
end
