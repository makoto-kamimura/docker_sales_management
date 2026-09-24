module Api
  module V1
    # 顧客からの 問い合わせ (inquiry) と オーダーメイド制作依頼 (custom) の受付。
    class ServiceRequestsController < BaseController
      before_action :authenticate!

      def index
        scope = current_user.service_requests.by_kind(params[:kind]).recent
        render json: scope.includes(:product).map { |r| serialize(r) }
      end

      def show
        render json: serialize(current_user.service_requests.find(params[:id]))
      end

      def create
        req = current_user.service_requests.create!(create_params)
        render json: serialize(req), status: :created
      end

      private

      def create_params
        permitted = params.permit(:kind, :subject, :product_id, :order_id, :preferred_at, :budget_cents, :body, :contact_phone)
        # status はクライアントから受け取らず常に pending から開始する
        permitted.to_h.symbolize_keys.merge(status: "pending")
      end

      def serialize(r)
        {
          id: r.id, kind: r.kind, status: r.status, subject: r.subject,
          preferred_at: r.preferred_at, budget_cents: r.budget_cents,
          body: r.body, contact_phone: r.contact_phone, created_at: r.created_at,
          order_id: r.order_id, reply: r.reply, replied_at: r.replied_at,
          product: r.product && { id: r.product.id, sku: r.product.sku, name: r.product.name }
        }
      end
    end
  end
end
