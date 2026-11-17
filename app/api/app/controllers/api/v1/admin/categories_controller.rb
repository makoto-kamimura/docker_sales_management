module Api
  module V1
    module Admin
      # カテゴリの販売の切り替え (販売権限)。カテゴリの追加・名前の変更はマイグレーションで行う
      class CategoriesController < BaseController
        requires_permission :sales

        def index
          render json: Category.all.map { |c| serialize(c) }
        end

        def update
          category = Category.find(params[:id])
          category.update!(active: ActiveModel::Type::Boolean.new.cast(params.require(:active)))
          render json: serialize(category)
        end

        private

        def serialize(c)
          {
            id: c.id, slug: c.slug, name: c.name, position: c.position, active: c.active, service: c.service?,
            published_products_count: c.products.published.count
          }
        end
      end
    end
  end
end
