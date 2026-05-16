module Api
  module V1
    class SubscriptionsController < BaseController
      before_action :authenticate!
      before_action :set_subscription, only: %i[show update destroy skip]

      def index
        render json: current_user.subscriptions.includes(:subscription_plan, :product).map { |s| serialize(s) }
      end

      def show
        render json: serialize(@subscription)
      end

      # 新規購読 (要件6)
      def create
        plan = SubscriptionPlan.active.find(params.require(:subscription_plan_id))
        product = Product.find(params.require(:product_id))
        address = current_user.addresses.find(params.require(:address_id))
        pm = params[:payment_method_id] ? current_user.payment_methods.find(params[:payment_method_id]) : nil

        unless product.is_subscribable
          return render_error(code: "not_subscribable", message: "この商品はサブスク対象外です", status: :unprocessable_entity)
        end

        sub = nil
        ActiveRecord::Base.transaction do
          sub = current_user.subscriptions.create!(
            subscription_plan: plan,
            product: product,
            address: address,
            payment_method: pm,
            quantity: params.fetch(:quantity, 1).to_i.clamp(1, 10),
            interval_days: plan.interval_days,
            next_delivery_on: Date.current + plan.interval_days.days,
            status: "active"
          )

          # Stripeサブスク (任意 / payment_methodがあれば)
          if pm && current_user.stripe_customer_id
            begin
              stripe_sub = StripeService.new.create_subscription(current_user, plan: plan, product: product, payment_method_id: pm.stripe_payment_method_id)
              sub.update!(stripe_subscription_id: stripe_sub.id)
            rescue StripeService::Error => e
              Rails.logger.warn("Stripe subscription failed: #{e.message}")
            end
          end
        end
        render json: serialize(sub), status: :created
      end

      def update
        action = params[:action_type] # "pause" | "resume" | "change_next_date" | "change_address"
        case action
        when "pause"   then @subscription.pause!
        when "resume"  then @subscription.resume!
        when "change_next_date"
          @subscription.update!(next_delivery_on: Date.parse(params.require(:next_delivery_on)))
        when "change_address"
          addr = current_user.addresses.find(params.require(:address_id))
          @subscription.update!(address: addr)
        else
          return render_error(code: "bad_action", message: "action_type が不正です", status: :bad_request)
        end
        render json: serialize(@subscription)
      end

      def destroy
        @subscription.cancel!
        head :no_content
      end

      # 次回スキップ (要件6)
      def skip
        @subscription.skip_next!
        render json: serialize(@subscription)
      end

      private

      def set_subscription
        @subscription = current_user.subscriptions.find(params[:id])
      end

      def serialize(s)
        {
          id: s.id, status: s.status, quantity: s.quantity, interval_days: s.interval_days,
          next_delivery_on: s.next_delivery_on,
          plan: { id: s.subscription_plan.id, code: s.subscription_plan.code, name: s.subscription_plan.name },
          product: { id: s.product.id, sku: s.product.sku, name: s.product.name, price_cents: s.product.price_cents }
        }
      end
    end
  end
end
