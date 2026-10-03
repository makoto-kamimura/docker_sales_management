# 3Dモデル・DIY設計図 (制作権限で管理)。ファイルは版 (ModelVersion) ごとに保存し、最新版を販売・配布に使う。
# 販売フラグ (for_sale) はショップの商品 (種別ごとのカテゴリのデジタル商品) と連動する (ModelListing)。
class ModelAsset < ApplicationRecord
  include PdfEmbeddableImage

  # 種別ごとに違うのは、受け付ける形式・ブラウザでプレビューできる形式・販売先のカテゴリと SKU だけ。
  # 版・写真・組み立て手順・販売・配布の仕組みは共通
  Kind = Data.define(:label, :extensions, :previewable_formats, :category_slug, :sku_prefix)
  KINDS = {
    "model" => Kind.new(label: "3Dモデル", extensions: Product::MODEL_FILE_EXTENSIONS,
                        previewable_formats: %w[STL OBJ 3MF], category_slug: "3d-models", sku_prefix: "MDL"),
    "blueprint" => Kind.new(label: "DIY設計図", extensions: Product::BLUEPRINT_FILE_EXTENSIONS,
                            previewable_formats: %w[PDF PNG JPG JPEG SVG DXF STL OBJ 3MF], category_slug: "diy-plans", sku_prefix: "DIY")
  }.freeze

  belongs_to :product, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many :versions, -> { order(number: :desc, minor: :desc) }, class_name: "ModelVersion", dependent: :destroy, inverse_of: :model_asset
  has_many :assembly_steps, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :model_asset
  has_many :photos, -> { ordered }, class_name: "ModelPhoto", dependent: :destroy, inverse_of: :model_asset # 実モデル画像・実利用画像
  has_one_attached :preview_image # ブラウザのプレビュー (3D表示・図面) から保存した画像

  attr_readonly :kind # 作成後に種別を変えると、登録済みのファイル形式や販売先カテゴリと食い違う

  validates :name, presence: true
  validates :kind, inclusion: { in: KINDS.keys }
  validates :price_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :product_id, uniqueness: true, allow_nil: true
  validates_pdf_image :preview_image

  scope :of_kind, ->(kind) { where(kind: kind) }

  def kind_config
    KINDS.fetch(kind)
  end

  def blueprint?
    kind == "blueprint"
  end

  def current_version
    versions.max_by { |v| [v.number, v.minor] }
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
