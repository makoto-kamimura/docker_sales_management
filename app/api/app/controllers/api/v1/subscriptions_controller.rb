module Api
  module V1
    # 定期便 (要件6)。カード (Stripe のサブスクリプション) で、お届けの間隔ごとに請求する。
    # 申し込みは決済の画面 (Stripe Checkout) で行い、請求が済むたびに Webhook でお届け分の注文を作る。
    # 一時停止・再開・スキップ・次回日の変更・解約は Stripe に反映してから記録する。
    # stripe_subscription_id のない古い購読は、この DB の中だけで操作する
    class SubscriptionsController < BaseController
      before_action :authenticate!
      before_action :set_subscription, only: %i[show update destroy skip]
      before_action :require_open!, only: %i[update skip]

      def index
        render json: current_user.subscriptions.includes(:subscription_plan, :product).order(created_at: :desc).map { |s| serialize(s) }
      end

      def show
        render json: serialize(@subscription)
      end

      # 新規購読。申し込み手続き中 (incomplete) で記録し、決済の画面の URL (checkout_url) を返す
      def create
        stripe = StripeService.new # 定期便はカード払いだけ (未設定なら 503)
        plan = SubscriptionPlan.active.find(params.require(:subscription_plan_id))
        product = Product.find(params.require(:product_id))
        address = current_user.addresses.find(params.require(:address_id))

        unless product.is_subscribable
          return render_error(code: "not_subscribable", message: "この商品はサブスク対象外です", status: :unprocessable_entity)
        end

        sub = current_user.subscriptions.create!(
          subscription_plan: plan,
          product: product,
          address: address,
          quantity: params.fetch(:quantity, 1).to_i.clamp(1, 10),
          interval_days: plan.interval_days,
          unit_price_cents: Subscription.discounted_unit_price(product, plan),
          next_delivery_on: Date.current, # 1回目は申し込みの決済と同時。以後は Stripe の次の請求日に合わせる
          status: "incomplete"
        )
        begin
          session = stripe.create_subscription_checkout(sub, **checkout_return_urls("/subscriptions"))
        rescue StripeService::Error
          sub.destroy!
          raise
        end
        sub.update!(stripe_checkout_session_id: session.id)
        render json: serialize(sub).merge(checkout_url: session.url), status: :created
      end

      def update
        action = params[:action_type] # "pause" | "resume" | "change_next_date" | "change_address"
        case action
        when "pause"
          return invalid_state("お届け中の定期便だけ一時停止できます") unless @subscription.status == "active"

          stripe&.pause_subscription(@subscription.stripe_subscription_id)
          @subscription.pause!
        when "resume"
          return invalid_state("一時停止中の定期便だけ再開できます") unless @subscription.status == "paused"

          stripe&.resume_subscription(@subscription.stripe_subscription_id)
          @subscription.resume!
        when "change_next_date"
          next_on = Date.parse(params.require(:next_delivery_on))
          return invalid_state("次回お届け日は明日以降の日付にしてください") unless next_on > Date.current

          reschedule!(next_on)
        when "change_address"
          addr = current_user.addresses.find(params.require(:address_id))
          @subscription.update!(address: addr)
        else
          return render_error(code: "bad_action", message: "action_type が不正です", status: :bad_request)
        end
        render json: serialize(@subscription)
      rescue Date::Error
        render_error(code: "bad_date", message: "次回お届け日が不正です", status: :bad_request)
      end

      # 解約。申し込み手続き中なら決済の画面を閉じる
      def destroy
        if @subscription.status == "incomplete"
          StripeService.new.expire_checkout_session(@subscription.stripe_checkout_session_id) if StripeService.enabled?
        elsif @subscription.status != "cancelled"
          stripe&.cancel_subscription(@subscription.stripe_subscription_id)
        end
        @subscription.cancel!
        head :no_content
      end

      # 次回スキップ (要件6)。次回日を1間隔後ろへ
      def skip
        reschedule!(@subscription.next_delivery_on + @subscription.interval_days.days)
        render json: serialize(@subscription)
      end

      # 支払いカードの変更 (Stripe Customer Portal) の URL
      def portal_session
        base = StripeService.app_base_url
        return_url = params[:client] == "app" ? "#{base}/checkout/return" : "#{base}/subscriptions"
        session = StripeService.new.create_portal_session(current_user, return_url: return_url)
        render json: { url: session.url }
      end

      private

      def set_subscription
        @subscription = current_user.subscriptions.find(params[:id])
      end

      # Stripe が請求する購読なら Stripe の操作に使う (古い購読は nil)
      def stripe
        @subscription.card? ? StripeService.new : nil
      end

      def require_open!
        return unless %w[incomplete cancelled].include?(@subscription.status)

        invalid_state("#{@subscription.status_label}の定期便は変更できません")
      end

      def invalid_state(message)
        render_error(code: "invalid_state", message: message, status: :unprocessable_entity)
      end

      # 次回お届け日を変える。Stripe の購読は次の請求日もずらす (それまでは請求しない)
      def reschedule!(next_on)
        stripe&.reschedule_subscription(@subscription.stripe_subscription_id, next_on)
        @subscription.update!(next_delivery_on: next_on)
      end

      def serialize(s)
        {
          id: s.id, status: s.status, status_label: s.status_label, quantity: s.quantity, interval_days: s.interval_days,
          next_delivery_on: s.next_delivery_on, card: s.card?,
          unit_price_cents: s.unit_price, charge_cents: s.charge_cents,
          plan: { id: s.subscription_plan.id, code: s.subscription_plan.code, name: s.subscription_plan.name },
          product: { id: s.product.id, sku: s.product.sku, name: s.product.name, price_cents: s.product.price_cents }
        }
      end
    end
  end
end
