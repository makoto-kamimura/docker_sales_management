module Api
  module V1
    module Admin
      # 3Dモデルの組み立て手順 (見出し・説明・画像・並び順)。組み立て説明書 PDF に出力される
      class AssemblyStepsController < BaseController
        requires_permission :production
        include ModelAssetJson

        before_action :set_model_asset
        before_action :set_step, only: %i[update destroy]

        # multipart: title, body, image
        def create
          step = @model_asset.assembly_steps.new(params.permit(:title, :body))
          step.image = params[:image] if params[:image].present?
          step.save!
          render json: model_asset_detail(find_model_asset(@model_asset.id)), status: :created
        end

        # title / body / image / remove_image / position (1 始まりの並び順)
        def update
          ActiveRecord::Base.transaction do
            @step.assign_attributes(params.permit(:title, :body))
            if params[:image].present?
              @step.image = params[:image]
            elsif ActiveModel::Type::Boolean.new.cast(params[:remove_image])
              @step.image.purge_later
            end
            @step.save!
            @step.move_to!(params[:position].to_i) if params[:position].present?
          end
          render json: model_asset_detail(find_model_asset(@model_asset.id))
        end

        def destroy
          @step.destroy!
          @model_asset.renumber_assembly_steps!
          render json: model_asset_detail(find_model_asset(@model_asset.id))
        end

        private

        def set_model_asset
          @model_asset = ModelAsset.find(params[:model_asset_id])
        end

        def set_step
          @step = @model_asset.assembly_steps.find(params[:id])
        end
      end
    end
  end
end
