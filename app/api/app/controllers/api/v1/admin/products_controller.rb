module Api
  module V1
    module Admin
      class ProductsController < BaseController
        before_action :set_product, only: %i[show update destroy upload_image]

        def index
          page, per = pagination_params
          scope = Product.order(id: :desc)
          set_pagination_headers(scope, page: page, per: per)
          render json: scope.offset((page - 1) * per).limit(per).map { |p| serialize(p) }
        end

        def show
          render json: serialize(@product, detail: true)
        end

        def create
          product = Product.create!(product_params)
          if params[:initial_stock].present?
            product.inventory.update!(stock: params[:initial_stock].to_i)
          end
          enqueue_embedding(product)
          render json: serialize(product, detail: true), status: :created
        end

        def update
          @product.update!(product_params)
          enqueue_embedding(@product) if @product.previous_changes.keys.intersect?(%w[name description])
          render json: serialize(@product, detail: true)
        end

        def destroy
          @product.destroy!
          head :no_content
        end

        # 画像アップロード (ActiveStorage)。保存後 image_url に配信パスを設定する。
        def upload_image
          @product.image.attach(params.require(:image))
          path = Rails.application.routes.url_helpers.rails_blob_path(@product.image, only_path: true)
          @product.update!(image_url: path)
          render json: serialize(@product, detail: true)
        end

        private

        def set_product
          @product = Product.find(params[:id])
        end

        def product_params
          params.permit(:category_id, :sku, :name, :description, :price_cents, :currency,
                        :is_subscribable, :published_at, :image_url, tags: [])
        end

        def enqueue_embedding(product)
          # 同期生成 (本番は ActiveJob 推奨)
          vec = EmbeddingService.embed("#{product.name}\n#{product.description}\n#{product.tags.join(',')}")
          embed = product.embedding || ProductEmbedding.new(product: product)
          embed.embedding = vec
          embed.indexed_at = Time.current
          embed.save!
        end

        def serialize(p, detail: false)
          base = p.attributes.slice("id", "sku", "name", "price_cents", "currency", "tags", "category_id", "is_subscribable", "published_at", "image_url")
          if detail
            base.merge!(description: p.description, stock: p.inventory&.stock || 0, reserved: p.inventory&.reserved || 0)
          end
          base
        end
      end
    end
  end
end
