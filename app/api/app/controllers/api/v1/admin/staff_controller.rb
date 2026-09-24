module Api
  module V1
    module Admin
      # 製作担当に指定できるユーザー (制作権限を持つスタッフ・管理者)。注文詳細の担当割り当てでも使う
      class StaffController < BaseController
        requires_permission :production, :orders

        def index
          render json: User.with_permission(:production).order(:id).map { |u| { id: u.id, name: u.name, role: u.role } }
        end
      end
    end
  end
end
