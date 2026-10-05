module Api
  module V1
    class BaseController < ApplicationController
      rescue_from StripeService::Disabled, with: :payment_unavailable
      rescue_from StripeService::Error, with: :payment_gateway_error

      private

      # 決済の画面 (Stripe Checkout) から戻る先。アプリ (client=app) は、アプリに戻るよう案内する Web のページへ戻す
      def checkout_return_urls(path)
        base = StripeService.app_base_url
        if params[:client] == "app"
          { success_url: "#{base}/checkout/return?result=success", cancel_url: "#{base}/checkout/return?result=cancel" }
        else
          { success_url: "#{base}#{path}?checkout=success", cancel_url: "#{base}#{path}?checkout=cancel" }
        end
      end

      def payment_unavailable(e)
        render_error(code: "payment_unavailable", message: e.message, status: :service_unavailable)
      end

      def payment_gateway_error(e)
        render_error(code: "payment_gateway_error", message: e.message, status: :bad_gateway)
      end
    end
  end
end
