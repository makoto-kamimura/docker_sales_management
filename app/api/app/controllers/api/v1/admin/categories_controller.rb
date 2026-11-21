module Api
  module V1
    module Admin
      # カテゴリの設定 (販売権限)。追加・名前などの変更・販売の切り替え・並べ替え・削除。
      # slug は追加するときだけ決め、あとから変えない。削除は商品が 0 件で、コードが使っていないカテゴリだけ
      class CategoriesController < BaseController
        requires_permission :sales

        before_action :set_category, only: %i[update destroy move]

        def index
          render json: Category.all.map { |c| serialize(c) }
        end

        def create
          category = Category.new(category_params.merge(slug: params.require(:slug).to_s.strip))
          category.active = false if params[:active].nil? # 商品を並べてから販売に切り替える
          category.position = Category.next_position
          category.save!
          render json: serialize(category), status: :created
        end

        def update
          @category.update!(category_params)
          render json: serialize(@category)
        end

        def destroy
          if @category.destroy
            head :no_content
          else
            message = @category.errors.full_messages.first || "削除できませんでした"
            message = "商品があるカテゴリは消せません（販売を止めることはできます）" if @category.products.exists?
            render_error(code: "category_in_use", message: message, status: :unprocessable_entity)
          end
        end

        # 並べ替え。direction は up / down
        def move
          offset = { "up" => -1, "down" => 1 }[params.require(:direction).to_s]
          unless offset
            return render_error(code: "bad_request", message: "direction は up か down を指定してください", status: :bad_request)
          end

          Category.move!(@category, offset)
          render json: Category.all.map { |c| serialize(c) }
        end

        private

        def set_category
          @category = Category.find(params[:id])
        end

        def category_params
          permitted = params.permit(:name, :label, :description, :active).to_h.symbolize_keys
          permitted[:active] = ActiveModel::Type::Boolean.new.cast(permitted[:active]) if permitted.key?(:active)
          %i[name label description].each { |k| permitted[k] = permitted[k].to_s.strip if permitted.key?(k) }
          permitted
        end

        def serialize(c)
          {
            id: c.id, slug: c.slug, name: c.name, label: c.label, description: c.description,
            position: c.position, active: c.active, service: c.service?,
            products_count: c.products.count, published_products_count: c.products.published.count,
            deletable: !c.system? && !c.products.exists?
          }
        end
      end
    end
  end
end
