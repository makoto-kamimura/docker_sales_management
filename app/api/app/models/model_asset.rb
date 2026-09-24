# 3Dモデル (制作権限で管理)。モデルファイルは版 (ModelVersion) ごとに保存し、最新版を販売・配布に使う。
# 販売フラグ (for_sale) はショップの商品 (3Dモデルデータ) と連動する (ModelListing)。
class ModelAsset < ApplicationRecord
  include PdfEmbeddableImage

  belongs_to :product, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many :versions, -> { order(number: :desc) }, class_name: "ModelVersion", dependent: :destroy, inverse_of: :model_asset
  has_many :assembly_steps, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :model_asset
  has_many :photos, -> { ordered }, class_name: "ModelPhoto", dependent: :destroy, inverse_of: :model_asset # 実モデル画像・実利用画像
  has_one_attached :preview_image # ブラウザの3Dプレビューから保存した画像

  validates :name, presence: true
  validates :price_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :product_id, uniqueness: true, allow_nil: true
  validates_pdf_image :preview_image

  def current_version
    versions.max_by(&:number)
  end

  # プレビュー表示する写真 (最大3枚。実モデル画像 → 実利用画像 の順)
  def preview_photos
    photos.select(&:featured).first(ModelPhoto::MAX_FEATURED)
  end

  # 手順の削除後などに position を 1 から詰め直す
  def renumber_assembly_steps!
    assembly_steps.reload.each.with_index(1) { |s, i| s.update_columns(position: i) unless s.position == i }
  end
end
