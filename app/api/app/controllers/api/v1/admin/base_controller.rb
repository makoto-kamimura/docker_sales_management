module Api
  module V1
    module Admin
      # 管理APIの基底クラス。コントローラごとに必要な権限 (販売 / 制作 / 注文) を宣言する。
      # 宣言のないコントローラ (権限設定など) は管理者専用。
      class BaseController < Api::V1::BaseController
        class_attribute :required_permissions, instance_writer: false, default: []

        before_action :authorize_admin_area!

        # 複数指定した場合はいずれか1つを持っていればよい
        def self.requires_permission(*permissions)
          self.required_permissions = permissions.map(&:to_s)
        end

        private

        def authorize_admin_area!
          required_permissions.empty? ? require_admin! : require_permission!(*required_permissions)
        end
      end
    end
  end
end
