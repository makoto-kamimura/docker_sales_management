module Api
  module V1
    module Admin
      # 投げ銭の管理 (注文権限): 一覧・入金確認・取り消し
      class TipsController < BaseController
        requires_permission :orders
        include OrderJson

        # params: status (pending / paid / cancelled)
        def index
          page, per = pagination_params
          scope = Tip.recent
          scope = scope.where(status: params[:status]) if Tip::STATUSES.include?(params[:status])
          set_pagination_headers(scope, page: page, per: per)
          render json: {
            summary: {
              pending_count: Tip.pending.count, pending_cents: Tip.pending.sum(:amount_cents),
              paid_count: Tip.paid.count, paid_cents: Tip.paid.sum(:amount_cents)
            },
            tips: scope.includes(:user, :confirmed_by).offset((page - 1) * per).limit(per).map { |t| tip_json(t) }
          }
        end

        # status: paid (入金確認) / cancelled (取り消し) / pending (入金待ちに戻す)
        def update
          tip = Tip.find(params[:id])
          case params.require(:status)
          when "paid"      then tip.update!(status: "paid", paid_at: Time.current, confirmed_by: current_user)
          when "cancelled" then tip.update!(status: "cancelled", paid_at: nil, confirmed_by: current_user)
          when "pending"   then tip.update!(status: "pending", paid_at: nil, confirmed_by: nil)
          else
            return render_error(code: "bad_status", message: "status が不正です", status: :unprocessable_entity)
          end
          render json: tip_json(tip)
        end
      end
    end
  end
end
