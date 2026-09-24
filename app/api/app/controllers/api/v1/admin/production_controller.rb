module Api
  module V1
    module Admin
      # 制作ボード (Kanban): 注文を制作・発送のステータス列に並べ、ドラッグで工程を進める。
      class ProductionController < BaseController
        requires_permission :production
        include OrderJson

        # 完了列は直近のものだけ表示する
        COMPLETED_LIMIT = 20

        def index
          open_orders = Order.where(status: Order::OPEN_STATUSES)
          open_orders = open_orders.where(assignee_id: params[:assignee_id]) if params[:assignee_id].present?
          completed = Order.where(status: "completed").order(updated_at: :desc).limit(COMPLETED_LIMIT)

          orders = (open_orders.includes(*ORDER_PRELOAD).order(Arel.sql("due_on IS NULL"), :due_on, :placed_at) +
                    completed.includes(*ORDER_PRELOAD)).group_by(&:status)

          render json: {
            columns: (Order::STATUSES - %w[cancelled]).map { |s|
              { status: s, label: Order::STATUS_LABELS[s], orders: (orders[s] || []).map { |o| order_card(o) } }
            },
            staff: User.with_permission(:production).order(:id).map { |u| { id: u.id, name: u.name, role: u.role } },
            low_materials: Material.all.select(&:low?).map { |m| { id: m.id, name: m.name, stock: m.stock.to_f, unit: m.unit } }
          }
        end

        # status (工程の移動) / assignee_id (製作担当) / due_on (納期) / carrier・tracking_number (発送時)
        def update
          order = Order.find(params[:id])
          workflow = OrderWorkflow.new(order, actor: current_user)
          workflow.plan!(params.permit(:assignee_id, :due_on))
          if params[:status].present?
            workflow.transition!(
              params[:status], note: params[:note], carrier: params[:carrier], tracking_number: params[:tracking_number]
            )
          end
          render json: order_card(Order.includes(*ORDER_PRELOAD).find(order.id))
        rescue OrderWorkflow::Error => e
          render_error(code: "bad_transition", message: e.message, status: :unprocessable_entity)
        end
      end
    end
  end
end
