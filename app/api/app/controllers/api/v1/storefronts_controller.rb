module Api
  module V1
    # いま店頭で扱っているもの。画面はこれを見て、メニューやカテゴリの案内を出し分ける
    class StorefrontsController < BaseController
      def show
        render json: Storefront.as_json
      end
    end
  end
end
