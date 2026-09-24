module Api
  module V1
    module Admin
      # 商品のレシピ (1個あたりに使う材料と数量)。制作開始時の材料消費に使う
      class ProductMaterialsController < BaseController
        requires_permission :production
        before_action :set_product

        def show
          render json: serialize
        end

        # body: { items: [{ material_id, quantity }] } で丸ごと置き換える
        def update
          items = params.permit(items: %i[material_id quantity]).fetch(:items, [])
          ProductMaterial.transaction do
            @product.product_materials.destroy_all
            items.each { |i| @product.product_materials.create!(material_id: i[:material_id], quantity: i[:quantity]) }
          end
          render json: serialize
        end

        private

        def set_product
          @product = Product.find(params[:product_id])
        end

        def serialize
          {
            product_id: @product.id,
            items: @product.product_materials.includes(:material).map { |pm|
              { material_id: pm.material_id, name: pm.material.name, unit: pm.material.unit, quantity: pm.quantity.to_f }
            }
          }
        end
      end
    end
  end
end
