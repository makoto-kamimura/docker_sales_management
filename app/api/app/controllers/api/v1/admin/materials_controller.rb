module Api
  module V1
    module Admin
      # 材料管理: 材料マスタと在庫 (入荷・棚卸し)、制作待ち注文に必要な数量の見込み
      class MaterialsController < BaseController
        requires_permission :production
        before_action :set_material, only: %i[update destroy adjust]

        def index
          required = Material.required_for_queue
          materials = Material.includes(:products).to_a
          render json: materials.map { |m| serialize(m, required: required[m.id] || 0) }
        end

        def create
          material = Material.create!(material_params)
          render json: serialize(material), status: :created
        end

        def update
          @material.update!(material_params)
          render json: serialize(@material)
        end

        def destroy
          @material.destroy!
          head :no_content
        end

        # 在庫の増減 (body: delta。入荷は正、廃棄・棚卸し差異は負)
        def adjust
          @material.adjust!(params.require(:delta))
          render json: serialize(@material)
        end

        private

        def set_material
          @material = Material.find(params[:id])
        end

        def material_params
          params.permit(:code, :name, :unit, :stock, :reorder_point, :unit_cost_cents, :supplier, :note)
        end

        def serialize(m, required: nil)
          required ||= Material.required_for_queue[m.id] || 0
          m.attributes.slice("id", "code", "name", "unit", "unit_cost_cents", "supplier", "note").merge(
            stock: m.stock.to_f, reorder_point: m.reorder_point.to_f, low: m.low?,
            # 制作待ちの注文で使う予定の数量と、それを差し引いた見込み在庫
            required_for_queue: required.to_f, projected_stock: (m.stock - required).to_f,
            products: m.products.map { |p| { id: p.id, sku: p.sku, name: p.name } }
          )
        end
      end
    end
  end
end
