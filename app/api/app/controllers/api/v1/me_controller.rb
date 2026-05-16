module Api
  module V1
    class MeController < BaseController
      before_action :authenticate!

      def show
        render json: user_json(current_user)
      end

      def update
        current_user.update!(me_params)
        render json: user_json(current_user)
      end

      private

      def me_params
        params.permit(:name, :email)
      end

      def user_json(u)
        {
          id: u.id, email: u.email, name: u.name, role: u.role,
          default_address_id: u.default_address&.id,
          default_payment_method_id: u.default_payment_method&.id
        }
      end
    end
  end
end
