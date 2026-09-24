module Api
  module V1
    module Admin
      class ProductsController < BaseController
        requires_permission :sales
        before_action :set_product, only: %i[show update destroy upload_image upload_model_file]

        def index
          page, per = pagination_params
          scope = Product.order(id: :desc)
          set_pagination_headers(scope, page: page, per: per)
          render json: scope.includes(:inventory, model_file_attachment: :blob).offset((page - 1) * per).limit(per).map { |p| serialize(p) }
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

        # 3Dモデルデータ (STL/3MF/OBJ/STEP/ZIP) のアップロード。購入者のみ DownloadsController 経由で取得できる
        def upload_model_file
          unless @product.is_digital?
            return render_error(code: "not_digital", message: "デジタル商品ではありません", status: :unprocessable_entity)
          end
          @product.model_file = params.require(:model_file)
          @product.save! # 形式・サイズ不正は RecordInvalid → 422
          render json: serialize(@product, detail: true)
        end

        private

        def set_product
          @product = Product.find(params[:id])
        end

        def product_params
          params.permit(:category_id, :sku, :name, :description, :price_cents, :currency,
                        :is_subscribable, :is_digital, :license, :published_at, :image_url, tags: [])
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
          base = p.attributes.slice("id", "sku", "name", "price_cents", "currency", "tags", "category_id", "is_subscribable",
                                    "is_digital", "license", "published_at", "image_url")
          base[:stock] = p.inventory&.stock || 0
          base[:file_format] = p.model_file_format
          base[:file_name] = p.model_file.attached? ? p.model_file.filename.to_s : nil
          if detail
            base.merge!(description: p.description, reserved: p.inventory&.reserved || 0)
          end
          base
        end
      end
    end
  end
end
