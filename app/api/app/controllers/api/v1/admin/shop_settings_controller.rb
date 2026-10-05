module Api
  module V1
    module Admin
      # ショップ情報 (管理者専用): 特定商取引法に基づく表記の販売者の情報と、店舗の方針の文面
      class ShopSettingsController < BaseController
        def show
          render json: serialize(ShopSetting.current)
        end

        def update
          setting = ShopSetting.current
          setting.update!(params.permit(*ShopSetting::EDITABLE))
          render json: serialize(setting)
        end

        private

        def serialize(s)
          s.attributes.slice(*ShopSetting::EDITABLE.map(&:to_s)).merge("complete" => s.complete?, "updated_at" => s.updated_at)
        end
      end
    end
  end
end
