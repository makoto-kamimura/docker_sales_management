module Api
  module V1
    class CategoriesController < BaseController
      def index
        render json: Category.all.map { |c|
          c.attributes.slice("id", "name", "slug", "label", "description", "parent_id", "position", "active")
        }
      end
    end
  end
end
