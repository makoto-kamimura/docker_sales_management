module Api
  module V1
    # カード決済が使えるか (Stripe の設定の有無)。使えなければ、画面はカードの選択肢を出さない
    class PaymentSettingsController < BaseController
      def show
        render json: { card_enabled: StripeService.enabled? }
      end
    end
  end
end
