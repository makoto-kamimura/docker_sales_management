module Api
  module V1
    module Admin
      # 3Dモデルの版管理: 新しい版の登録 (複数ファイル可)・過去の版に戻す・プレビュー/ダウンロード用の期限付きURL
      class ModelVersionsController < BaseController
        requires_permission :production
        include ModelAssetJson

        URL_EXPIRES_IN = 10.minutes

        before_action :set_model_asset
        before_action :set_version, only: %i[restore file bundle]

        # multipart: files[] (複数可), note
        def create
          add_version(files: uploaded_files, note: params[:note].to_s)
          render json: model_asset_detail(find_model_asset(@model_asset.id)), status: :created
        rescue ModelListing::Error => e
          render_error(code: "listing_failed", message: e.message, status: :unprocessable_entity)
        end

        # 過去の版のファイルで新しい版を作る (履歴は消さない)
        def restore
          add_version(files: @version.files.blobs.to_a, note: "v#{@version.number} に戻す")
          render json: model_asset_detail(find_model_asset(@model_asset.id)), status: :created
        rescue ModelListing::Error => e
          render_error(code: "listing_failed", message: e.message, status: :unprocessable_entity)
        end

        # 版の中の1ファイル。params: file_id (省略時は最初のファイル), disposition (inline: 3Dプレビュー用 / attachment)
        def file
          attachment = params[:file_id].present? ? @version.files.find(params[:file_id]) : @version.files.first
          raise NotFoundError, "ファイルがありません" unless attachment

          render json: signed_url(attachment.blob, disposition: params[:disposition] == "inline" ? "inline" : "attachment")
        end

        # 版のファイルをまとめてダウンロード (複数なら ZIP、1つならそのファイル)
        def bundle
          render json: signed_url(@version.distribution_blob, disposition: "attachment")
        end

        private

        def set_model_asset
          @model_asset = ModelAsset.find(params[:model_asset_id])
        end

        def set_version
          @version = @model_asset.versions.find(params[:id])
        end

        def signed_url(blob, disposition:)
          url = Rails.application.routes.url_helpers.rails_service_blob_path(
            blob.signed_id(expires_in: URL_EXPIRES_IN), blob.filename, disposition: disposition
          )
          { url: url, filename: blob.filename.to_s, byte_size: blob.byte_size, expires_in: URL_EXPIRES_IN.to_i }
        end

        def add_version(files:, note:)
          @model_asset.versions.create!(files: files, note: note, created_by: current_user)
          # 販売中なら、購入者に配布するファイルを最新版に差し替える。
          # ファイルの実体はコミット後に保存されるので、ZIP を作る (ファイルを読む) のは版の保存が確定してから
          ModelListing.new(@model_asset.reload).sync! if @model_asset.for_sale?
        end
      end
    end
  end
end
