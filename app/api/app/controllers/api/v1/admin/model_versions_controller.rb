module Api
  module V1
    module Admin
      # 3Dモデル・DIY設計図の版管理: 新しい版の登録 (複数ファイル可)・最新版へのファイル追加・過去の版に戻す・
      # ファイルのカテゴリの変更・プレビュー/ダウンロード用の期限付きURL
      class ModelVersionsController < BaseController
        requires_permission :production
        include ModelAssetJson

        URL_EXPIRES_IN = 10.minutes

        before_action :set_model_asset
        before_action :set_version, only: %i[update restore file bundle]

        # multipart: all_in_one_files[] / parts_files[] / files[] (その他) (それぞれ複数可), note, append
        # append=true: 最新版のファイル (カテゴリも) を引き継いでファイルを足した枝番の版 (v3 → v3.1) を作る。
        # 版のファイルは後から変えないので、最新版そのものには足さない
        def create
          entries = uploaded_entries
          if ActiveModel::Type::Boolean.new.cast(params[:append])
            base = @model_asset.current_version or raise NotFoundError, "ファイルを追加する版がありません"
            add_version(entries: entries_of(base) + entries, note: params[:note].presence || "ファイルを追加",
                        number: base.number, minor: base.minor + 1)
          else
            add_version(entries: entries, note: params[:note].to_s)
          end
          render json: model_asset_detail(find_model_asset(@model_asset.id)), status: :created
        rescue ModelListing::Error => e
          render_error(code: "listing_failed", message: e.message, status: :unprocessable_entity)
        end

        # ファイルのカテゴリを変える (JSON: categories = { "<file_id>": "all_in_one" | "parts" | "other" })。
        # ファイル自体は変えない。販売中の最新版なら、フォルダ分けを変えた ZIP に配布ファイルを差し替える
        def update
          categories = params.require(:categories).permit!.to_h
          ActiveRecord::Base.transaction do
            @version.recategorize!(categories)
            ModelListing.new(@model_asset.reload).sync! if @model_asset.for_sale? && @model_asset.current_version == @version
          end
          render json: model_asset_detail(find_model_asset(@model_asset.id))
        rescue ModelListing::Error => e
          render_error(code: "listing_failed", message: e.message, status: :unprocessable_entity)
        end

        # 過去の版のファイル (カテゴリも) で新しい版を作る (履歴は消さない)
        def restore
          add_version(entries: entries_of(@version), note: "v#{@version.label} に戻す")
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

        # 版のファイルを引き継ぐ (再アップロードせず同じ blob を使う)
        def entries_of(version)
          version.files.map { |f| [f.blob, version.category_of(f)] }
        end

        # number / minor の省略時は次の整数の版 (枝番 0)
        def add_version(entries:, note:, number: nil, minor: 0)
          @model_asset.versions.create_with_categories!(entries: entries, note: note, number: number, minor: minor, created_by: current_user)
          # 販売中なら、購入者に配布するファイルを最新版に差し替える。
          # ファイルの実体はコミット後に保存されるので、ZIP を作る (ファイルを読む) のは版の保存が確定してから
          ModelListing.new(@model_asset.reload).sync! if @model_asset.for_sale?
        end
      end
    end
  end
end
