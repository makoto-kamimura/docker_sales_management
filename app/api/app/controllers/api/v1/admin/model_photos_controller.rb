module Api
  module V1
    module Admin
      # 3Dモデルの写真 (実モデル画像 / 実利用画像): 追加・説明・プレビュー表示 (最大3枚)・並び替え・削除
      class ModelPhotosController < BaseController
        requires_permission :production
        include ModelAssetJson

        before_action :set_model_asset
        before_action :set_photo, only: %i[update destroy]

        # multipart: files[] (複数可), kind (real_model / in_use)。
        # プレビュー表示が3枚に満たなければ、追加した写真から順にプレビュー表示にする
        def create
          files = uploaded_files
          ActiveRecord::Base.transaction do
            files.each do |file|
              featured = @model_asset.photos.where(featured: true).count < ModelPhoto::MAX_FEATURED
              @model_asset.photos.create!(kind: params[:kind], image: file, featured: featured)
            end
          end
          render_detail(status: :created)
        end

        # caption / featured / kind / position (種類ごとの並び順、1 始まり)
        def update
          ActiveRecord::Base.transaction do
            @photo.update!(params.permit(:caption, :featured, :kind))
            @photo.move_to!(params[:position].to_i) if params[:position].present?
          end
          render_detail
        end

        def destroy
          @photo.destroy!
          ModelPhoto.renumber!(@model_asset.id, @photo.kind)
          render_detail
        end

        private

        def set_model_asset
          @model_asset = ModelAsset.find(params[:model_asset_id])
        end

        def set_photo
          @photo = @model_asset.photos.find(params[:id])
        end

        # 販売中なら、ショップの商品画像 (プレビュー表示の1枚目) も更新する
        def render_detail(status: :ok)
          ModelListing.new(@model_asset.reload).sync! if @model_asset.for_sale?
          render json: model_asset_detail(find_model_asset(@model_asset.id)), status: status
        end
      end
    end
  end
end
