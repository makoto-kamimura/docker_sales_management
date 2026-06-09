module Api
  module V1
    module Admin
      # 店舗側: 整備予約 / 開発依頼の受付管理。
      class ServiceRequestsController < BaseController
        before_action :require_admin!

        def index
          page, per = pagination_params
          scope = ServiceRequest.by_kind(params[:kind]).recent
          scope = scope.where(status: params[:status]) if params[:status].present?
          set_pagination_headers(scope, page: page, per: per)
          render json: scope.includes(:user, :product).offset((page - 1) * per).limit(per).map { |r| serialize(r) }
        end

        def show
          render json: serialize(ServiceRequest.find(params[:id]))
        end

        def update
          req = ServiceRequest.find(params[:id])
          req.transition_to!(params.require(:status))
          render json: serialize(req)
        rescue ArgumentError => e
          render_error(code: "bad_status", message: e.message, status: :unprocessable_entity)
        end

        private

        def serialize(r)
          {
            id: r.id, kind: r.kind, status: r.status, vehicle: r.vehicle,
            preferred_at: r.preferred_at, budget_cents: r.budget_cents,
            body: r.body, contact_phone: r.contact_phone, created_at: r.created_at,
            user: { id: r.user_id, email: r.user.email, name: r.user.name },
            product: r.product && { id: r.product.id, sku: r.product.sku, name: r.product.name }
          }
        end
      end
    end
  end
end
