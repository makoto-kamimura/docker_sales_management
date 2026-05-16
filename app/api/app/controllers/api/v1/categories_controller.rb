module Api
  module V1
    class CategoriesController < BaseController
      def index
        render json: Category.all.map { |c|
          c.attributes.slice("id", "name", "slug", "parent_id", "position")
        }
      end
    end
  end
end
