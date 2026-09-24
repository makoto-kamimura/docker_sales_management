module Api
  module V1
    module Admin
      # 注文管理: 一覧・詳細・ステータス/発送の更新
      class OrdersController < BaseController
        requires_permission :orders
        include OrderJson

        def index
          page, per = pagination_params
          scope = Order.recent
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(assignee_id: params[:assignee_id]) if params[:assignee_id].present?
          scope = scope.for_period(parse_date(params[:from]), parse_date(params[:to]))

          set_pagination_headers(scope, page: page, per: per)
          rows = scope.includes(*ORDER_PRELOAD).offset((page - 1) * per).limit(per)
          render json: rows.map { |o| order_card(o) }
        end

        def show
          render json: order_detail(find_order)
        end

        # status / assignee_id / due_on / carrier / tracking_number
        def update
          order = find_order
          workflow = OrderWorkflow.new(order, actor: current_user)
          workflow.plan!(params.permit(:assignee_id, :due_on))
          if params[:status].present?
            workflow.transition!(
              params[:status], note: params[:note], carrier: params[:carrier], tracking_number: params[:tracking_number]
            )
          end
          render json: order_detail(find_order)
        rescue OrderWorkflow::Error => e
          render_error(code: "bad_transition", message: e.message, status: :unprocessable_entity)
        end

        private

        def find_order
          Order.includes(*ORDER_PRELOAD, :address, :shipment, events: :actor).find(params[:id])
        end

        def parse_date(s)
          s.present? ? Date.parse(s.to_s) : nil
        end
      end
    end
  end
end
