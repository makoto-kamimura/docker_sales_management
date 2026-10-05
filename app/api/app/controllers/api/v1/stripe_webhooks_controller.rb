module Api
  module V1
    # Stripe からの通知 (Webhook)。ログイン不要で、署名の検証に本文そのものを使う
    class StripeWebhooksController < BaseController
      def create
        StripeWebhookHandler.new(request.raw_post, request.headers["Stripe-Signature"].to_s).call
        head :no_content
      rescue StripeWebhookHandler::InvalidSignature => e
        render_error(code: "bad_signature", message: e.message, status: :bad_request)
      end
    end
  end
end
