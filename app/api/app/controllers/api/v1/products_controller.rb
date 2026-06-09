module Api
  module V1
    class ProductsController < BaseController
      # 商品検索 (要件5) - 公開エンドポイント
      def index
        page, per = pagination_params
        scope = Product.published
                       .by_category(params[:category_id])
                       .by_category_slug(params[:category_slug])
                       .price_between(params[:min_price], params[:max_price])
                       .with_tags(params[:tags])
        scope = scope.keyword_search(params[:q]) if params[:q].present?
        scope = apply_sort(scope, params[:sort])

        set_pagination_headers(scope, page: page, per: per)
        rows = scope.includes(:category, :inventory).offset((page - 1) * per).limit(per)
        render json: rows.map { |p| serialize(p) }
      end

      def show
        product = Product.find(params[:id])
        render json: serialize(product, detail: true)
      end

      # ベクトル検索 (要件5 / RAG)
      def search
        q = params.require(:q)
        embedding = EmbeddingService.embed(q)
        ids = ProductEmbedding
                .nearest_neighbors(:embedding, embedding, distance: "cosine")
                .limit(20)
                .pluck(:product_id)
        products = Product.where(id: ids).includes(:category, :inventory).index_by(&:id)
        render json: ids.filter_map { |id| products[id] }.map { |p| serialize(p) }
      end

      private

      def apply_sort(scope, sort)
        case sort
        when "price_asc"   then scope.order(price_cents: :asc)
        when "price_desc"  then scope.order(price_cents: :desc)
        when "newest"      then scope.order(published_at: :desc)
        else scope.order(id: :asc)
        end
      end

      def serialize(p, detail: false)
        base = {
          id: p.id, sku: p.sku, name: p.name, price_cents: p.price_cents,
          currency: p.currency, tags: p.tags, category_id: p.category_id,
          category_slug: p.category.slug, image_url: p.image_url,
          is_subscribable: p.is_subscribable,
          in_stock: p.in_stock?(1)
        }
        base[:description] = p.description if detail
        base[:stock] = p.inventory&.available if detail
        base
      end
    end
  end
end
