# 3Dモデルの販売フラグをショップの商品 (カテゴリ 3d-models のデジタル商品) に反映する。
# オン: 商品を作成/更新して公開し、最新版のファイルを配布ファイルにする。
# オフ: 非公開にする (購入済みの人は引き続きダウンロードできる)。
class ModelListing
  class Error < StandardError; end

  CATEGORY_SLUG = "3d-models"

  def initialize(model_asset)
    @model = model_asset
  end

  def sync!
    @model.for_sale? ? publish! : unpublish!
  end

  private

  def publish!
    version = @model.current_version or raise Error, "販売するには3Dモデルファイルを登録してください"
    # 価格 0円は無料配布 (0円の注文は入金確認を省略し、購入者は投げ銭で応援できる)

    product = @model.product || Product.new(category: category, sku: "MDL-#{@model.id}")
    product.assign_attributes(name: @model.name, description: @model.description, license: @model.license,
                              price_cents: @model.price_cents, is_digital: true, is_subscribable: false)
    product.published_at = Time.current unless product.published_at && product.published_at <= Time.current
    blob = version.distribution_blob # 複数ファイルの版は ZIP にまとめて配布する
    product.model_file = blob unless product.model_file.attached? && product.model_file.blob_id == blob.id
    # 商品画像: プレビュー表示の写真の1枚目 → なければ 3Dプレビューから保存した画像
    image = @model.preview_photos.first&.image
    image = @model.preview_image if image.nil? && @model.preview_image.attached?
    product.image_url = image ? Rails.application.routes.url_helpers.rails_blob_path(image, only_path: true) : ""
    product.save!
    @model.update!(product: product) unless @model.product_id == product.id
  end

  def unpublish!
    @model.product&.update!(published_at: nil)
  end

  def category
    Category.find_by(slug: CATEGORY_SLUG) or raise Error, "カテゴリ「3Dモデルデータ」(#{CATEGORY_SLUG}) がありません"
  end
end
