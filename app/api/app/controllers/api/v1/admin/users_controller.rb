module Api
  module V1
    module Admin
      # スタッフ・権限設定 (管理者専用): ユーザーのロールと権限 (販売 / 制作 / 注文) を設定する
      class UsersController < BaseController
        # 検索語なしは管理画面を使うユーザー (スタッフ・管理者)、検索時は会員も含めて探す
        def index
          page, per = pagination_params
          scope = User.order(:id)
          if params[:q].present?
            q = "%#{User.sanitize_sql_like(params[:q])}%"
            scope = scope.where("users.name ILIKE :q OR users.email ILIKE :q", q: q)
          else
            scope = scope.where(role: %w[staff admin])
          end

          set_pagination_headers(scope, page: page, per: per)
          render json: scope.offset((page - 1) * per).limit(per).map { |u| user_json(u) }
        end

        # body: role (member / staff / admin), permissions (スタッフのみ有効: sales / production / orders)
        def update
          user = User.find(params[:id])
          attrs = params.permit(:role, permissions: [])
          # 自分の管理者権限を外すと誰も権限設定できなくなり得るため、自分のロールは変えられない
          if user == current_user && attrs.key?(:role) && attrs[:role] != user.role
            return render_error(code: "own_role", message: "自分自身のロールは変更できません", status: :unprocessable_entity)
          end

          user.update!(attrs)
          render json: user_json(user)
        end

        private

        def user_json(u)
          { id: u.id, name: u.name, email: u.email, role: u.role, permissions: u.effective_permissions, created_at: u.created_at }
        end
      end
    end
  end
end
