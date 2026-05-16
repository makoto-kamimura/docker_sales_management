module Api
  module V1
    class AddressesController < BaseController
      before_action :authenticate!
      before_action :set_address, only: %i[show update destroy]

      def index
        render json: current_user.addresses.map { |a| serialize(a) }
      end

      def show
        render json: serialize(@address)
      end

      def create
        a = current_user.addresses.create!(address_params)
        render json: serialize(a), status: :created
      end

      def update
        @address.update!(address_params)
        render json: serialize(@address)
      end

      def destroy
        @address.destroy!
        head :no_content
      end

      private

      def set_address
        @address = current_user.addresses.find(params[:id])
      end

      def address_params
        params.permit(:label, :recipient, :postal_code, :prefecture, :city, :line1, :line2, :phone, :is_default)
      end

      def serialize(a)
        a.attributes.slice("id", "label", "recipient", "postal_code", "prefecture", "city", "line1", "line2", "phone", "is_default")
      end
    end
  end
end
