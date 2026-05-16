module Api
  module V1
    class SubscriptionPlansController < BaseController
      def index
        render json: SubscriptionPlan.active.map { |p| serialize(p) }
      end

      def show
        render json: serialize(SubscriptionPlan.find(params[:id]))
      end

      private

      def serialize(p)
        p.attributes.slice("id", "name", "code", "interval_days", "discount_percent", "description", "active")
      end
    end
  end
end
