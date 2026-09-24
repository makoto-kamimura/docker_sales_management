# 3Dモデルの写真。実モデル画像 (出力・組み立てた実物) と実利用画像 (使っている様子) を複数枚ずつ登録できる。
# featured のもの (モデルごとに最大3枚) を一覧・詳細・ショップの商品ページでプレビュー表示する
class ModelPhoto < ApplicationRecord
  KINDS = %w[real_model in_use].freeze
  KIND_LABELS = { "real_model" => "実モデル画像", "in_use" => "実利用画像" }.freeze
  CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  MAX_BYTES = 10.megabytes
  MAX_PER_KIND = 20
  MAX_FEATURED = 3
  CAPTION_MAX_LENGTH = 200

  belongs_to :model_asset, inverse_of: :photos, touch: true
  has_one_attached :image

  validates :kind, inclusion: { in: KINDS }
  validates :caption, length: { maximum: CAPTION_MAX_LENGTH }
  validates :position, numericality: { only_integer: true, greater_than: 0 }
  validate  :image_must_be_photo
  validate  :featured_within_limit, if: -> { featured? && will_save_change_to_featured? }
  validate  :kind_within_limit, if: -> { new_record? || will_save_change_to_kind? }

  before_validation :put_at_end_of_kind, if: -> { new_record? || will_save_change_to_kind? }
  after_update_commit :renumber_previous_kind, if: :saved_change_to_kind?

  # 実モデル画像 → 実利用画像 の順、種類の中は position 順
  scope :ordered, -> { order(Arel.sql("CASE model_photos.kind WHEN 'real_model' THEN 0 ELSE 1 END"), :position, :id) }

  def self.renumber!(model_asset_id, kind)
    where(model_asset_id: model_asset_id, kind: kind).order(:position, :id).each.with_index(1) do |photo, i|
      photo.update_columns(position: i) unless photo.position == i
    end
  end

  def kind_label
    KIND_LABELS.fetch(kind, kind)
  end

  # 同じ種類の中で並び順を変える (1 始まり。範囲外は端に寄せる)
  def move_to!(new_position)
    siblings = ModelPhoto.where(model_asset_id: model_asset_id, kind: kind).order(:position, :id).to_a
    siblings.reject! { |p| p.id == id }
    siblings.insert((new_position - 1).clamp(0, siblings.size), self)
    siblings.each.with_index(1) { |p, i| p.update_columns(position: i) unless p.position == i }
  end

  private

  def put_at_end_of_kind
    return unless KINDS.include?(kind)

    self.position = (ModelPhoto.where(model_asset_id: model_asset_id, kind: kind).where.not(id: id).maximum(:position) || 0) + 1
  end

  def renumber_previous_kind
    self.class.renumber!(model_asset_id, saved_change_to_kind.first)
  end

  def image_must_be_photo
    return errors.add(:image, "を選択してください") unless image.attached?

    errors.add(:image, "は JPEG / PNG / WebP にしてください") unless CONTENT_TYPES.include?(image.blob.content_type)
    errors.add(:image, "は #{MAX_BYTES / 1.megabyte}MB 以下にしてください") if image.blob.byte_size > MAX_BYTES
  end

  def featured_within_limit
    others = ModelPhoto.where(model_asset_id: model_asset_id, featured: true).where.not(id: id).count
    errors.add(:featured, "にできるのは #{MAX_FEATURED} 枚までです (ほかの写真のプレビュー表示を外してください)") if others >= MAX_FEATURED
  end

  def kind_within_limit
    count = ModelPhoto.where(model_asset_id: model_asset_id, kind: kind).where.not(id: id).count
    errors.add(:base, "#{kind_label}は #{MAX_PER_KIND} 枚までです") if count >= MAX_PER_KIND
  end
end
