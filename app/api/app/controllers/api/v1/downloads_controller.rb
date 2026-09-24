module Api
  module V1
    # 購入済みデジタル商品 (3Dプリンタ用モデルデータ) のライブラリとダウンロード。
    # 支払い済み (入金確認以降・キャンセル除く) の注文に含まれる商品のみ対象。
    class DownloadsController < BaseController
      before_action :authenticate!

      # 払い出す署名付きURLの有効期限。URLが流出しても短時間で失効させる
      URL_EXPIRES_IN = 5.minutes

      def index
        products = current_user.purchased_digital_products
                               .includes({ model_file_attachment: :blob }, model_asset: :assembly_steps).order(:id)
        render json: products.map { |p| serialize(p) }
      end

      # GET /downloads/:id/assembly → 組み立て説明書 PDF の期限付きURL
      def assembly
        product = current_user.purchased_digital_products.find(params[:id])
        raise ApplicationController::NotFoundError, "この商品には組み立て説明書がありません" unless product.assembly_guide?

        model = product.model_asset
        url = Rails.application.routes.url_helpers.api_v1_assembly_pdf_path(AssemblyGuidePdf.signed_token(model))
        render json: { url: url, filename: AssemblyGuidePdf.new(model).filename,
                       expires_in: AssemblyGuidePdf::LINK_EXPIRES_IN.to_i }
      end

      # GET /downloads/:id (id = product_id) → 期限付きのダウンロードURLを返す
      def show
        product = current_user.purchased_digital_products.find(params[:id])
        raise ApplicationController::NotFoundError, "配布ファイルが未登録です" unless product.model_file.attached?

        blob = product.model_file.blob
        url = Rails.application.routes.url_helpers.rails_service_blob_path(
          blob.signed_id(expires_in: URL_EXPIRES_IN), blob.filename, disposition: "attachment"
        )
        render json: { url: url, filename: blob.filename.to_s, byte_size: blob.byte_size,
                       expires_in: URL_EXPIRES_IN.to_i }
      end

      private

      def serialize(p)
        blob = p.model_file.attached? ? p.model_file.blob : nil
        { product_id: p.id, sku: p.sku, name: p.name, license: p.license,
          file_format: p.model_file_format, filename: blob&.filename&.to_s, byte_size: blob&.byte_size,
          has_assembly: p.assembly_guide? }
      end
    end
  end
end
