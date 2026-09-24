module Api
  module V1
    module Admin
      # 3Dモデル管理: モデルファイルの保存・3Dプレビュー画像・販売フラグ・組み立て説明書 PDF。
      # 版は ModelVersionsController、組み立て手順は AssemblyStepsController
      class ModelAssetsController < BaseController
        requires_permission :production
        include ModelAssetJson

        before_action :set_model_asset, only: %i[show update destroy preview assembly_pdf assembly_import]

        IMPORT_MODES = %w[replace append].freeze

        def index
          models = ModelAsset.includes(*MODEL_PRELOAD).order(updated_at: :desc)
          render json: models.map { |m| model_asset_summary(m) }
        end

        def show
          render json: model_asset_detail(@model_asset)
        end

        # multipart: name, description, license, files[] (初版のモデルファイル。複数可), note
        def create
          files = uploaded_files
          model = ActiveRecord::Base.transaction do
            m = ModelAsset.create!(params.permit(:name, :description, :license).merge(created_by: current_user))
            m.versions.create!(files: files, note: params[:note].presence || "初版", created_by: current_user)
            m
          end
          render json: model_asset_detail(find_model_asset(model.id)), status: :created
        end

        # name / description / license / assembly_notes / for_sale / price_cents
        # 販売中 (またはオフに切り替えた) なら、ショップの商品に反映する
        def update
          ActiveRecord::Base.transaction do
            @model_asset.update!(params.permit(:name, :description, :license, :assembly_notes, :for_sale, :price_cents))
            ModelListing.new(@model_asset).sync! if @model_asset.for_sale? || @model_asset.saved_change_to_for_sale?
          end
          render json: model_asset_detail(find_model_asset(@model_asset.id))
        rescue ModelListing::Error => e
          render_error(code: "listing_failed", message: e.message, status: :unprocessable_entity)
        end

        # 連動する商品は注文から参照されるので削除せず非公開にする
        def destroy
          ActiveRecord::Base.transaction do
            @model_asset.product&.update!(published_at: nil)
            @model_asset.destroy!
          end
          head :no_content
        end

        # ブラウザの3Dプレビューから保存した画像 (multipart: image)。販売中なら商品画像にも使う
        def preview
          ActiveRecord::Base.transaction do
            @model_asset.preview_image = params.require(:image)
            @model_asset.save!
            ModelListing.new(@model_asset).sync! if @model_asset.for_sale?
          end
          render json: model_asset_detail(find_model_asset(@model_asset.id))
        rescue ModelListing::Error => e
          render_error(code: "listing_failed", message: e.message, status: :unprocessable_entity)
        end

        def assembly_pdf
          guide = AssemblyGuidePdf.new(@model_asset)
          send_data guide.render, filename: guide.filename, type: "application/pdf", disposition: "attachment"
        end

        # Markdown ファイル1つから「必要な部品・工具」と手順を取り込む (AssemblyMarkdownImport)。
        # multipart: file (.md), dry_run (true なら取り込む内容だけ返す), mode (replace: 置き換え / append: 末尾に追加)
        def assembly_import
          file = params.require(:file)
          raise ActionController::ParameterMissing, :file unless file.respond_to?(:read)
          if file.size > AssemblyMarkdownImport::MAX_BYTES
            return render_error(code: "import_failed", message: "Markdown ファイルは 1MB 以下にしてください", status: :unprocessable_entity)
          end

          result = AssemblyMarkdownImport.parse(file.read)
          if ActiveModel::Type::Boolean.new.cast(params[:dry_run])
            return render json: { assembly_notes: result.assembly_notes, steps: result.steps.map(&:to_h), warnings: result.warnings }
          end

          mode = IMPORT_MODES.include?(params[:mode]) ? params[:mode] : "replace"
          ActiveRecord::Base.transaction { apply_import(result, mode) }
          render json: model_asset_detail(find_model_asset(@model_asset.id))
        rescue AssemblyMarkdownImport::Error => e
          render_error(code: "import_failed", message: e.message, status: :unprocessable_entity)
        end

        private

        # 部品・工具はファイルにあるときだけ (置き換え / 後ろに追加)、手順は置き換えなら既存を削除してから登録する
        def apply_import(result, mode)
          if result.assembly_notes
            current = @model_asset.assembly_notes
            notes = mode == "append" && current.present? ? "#{current}\n\n#{result.assembly_notes}" : result.assembly_notes
            @model_asset.update!(assembly_notes: notes)
          end
          @model_asset.assembly_steps.destroy_all if mode == "replace"
          result.steps.each { |s| AssemblyStep.create!(model_asset: @model_asset, title: s.title, body: s.body) }
        end

        def set_model_asset
          @model_asset = find_model_asset(params[:id])
        end
      end
    end
  end
end
