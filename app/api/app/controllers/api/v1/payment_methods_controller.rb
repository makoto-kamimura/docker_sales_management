module Api
  module V1
    class PaymentMethodsController < BaseController
      before_action :authenticate!

      def index
        render json: current_user.payment_methods.map { |pm| serialize(pm) }
      end

      def create
        # Stripe.js などで作成した payment_method_id を保存する想定
        StripeService.new.ensure_customer(current_user)
        pm = current_user.payment_methods.create!(
          stripe_payment_method_id: params.require(:stripe_payment_method_id),
          brand: params[:brand],
          last4: params[:last4],
          exp_month: params[:exp_month],
          exp_year: params[:exp_year],
          is_default: params[:is_default] || current_user.payment_methods.none?
        )
        render json: serialize(pm), status: :created
      end

      def destroy
        pm = current_user.payment_methods.find(params[:id])
        pm.destroy!
        head :no_content
      end

      private

      def serialize(pm)
        pm.attributes.slice("id", "brand", "last4", "exp_month", "exp_year", "is_default")
      end
    end
  end
end
