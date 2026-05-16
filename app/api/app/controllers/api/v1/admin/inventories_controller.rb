module Api
  module V1
    module Admin
      class InventoriesController < BaseController
        def update
          inventory = Inventory.find_by!(product_id: params[:product_id])
          inventory.update!(stock: params.require(:stock).to_i)
          render json: inventory.attributes.slice("product_id", "stock", "reserved")
        end
      end
    end
  end
end
