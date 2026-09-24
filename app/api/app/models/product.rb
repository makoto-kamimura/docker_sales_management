class Product < ApplicationRecord
  include PgSearch::Model

  # 3Dプリンタ用モデルデータとして受け付けるファイル形式 (content_type は当てにならないので拡張子で判定)
  MODEL_FILE_EXTENSIONS = %w[stl 3mf obj step stp zip].freeze
  MODEL_FILE_MAX_BYTES  = 100.megabytes

  belongs_to :category
  has_one_attached :image
  has_one_attached :model_file # デジタル商品の配布ファイル。公開URLは出さず DownloadsController 経由でのみ配布する
  has_one  :inventory, dependent: :destroy
  has_one  :embedding, class_name: "ProductEmbedding", dependent: :destroy
  has_many :cart_items, dependent: :restrict_with_error
  has_many :order_items, dependent: :restrict_with_error
  has_many :product_materials, dependent: :destroy # 制作に使う材料 (レシピ)
  has_many :materials, through: :product_materials
  has_one  :model_asset, dependent: :nullify # 3Dモデル管理から販売している場合の元モデル (版・組み立て説明書)

  validates :sku, :name, :price_cents, presence: true
  validates :sku, uniqueness: true
  validates :price_cents, numericality: { greater_than_or_equal_to: 0 }
  validates :currency, presence: true
  validate  :digital_not_subscribable
  validate  :validate_model_file, if: -> { model_file.attached? }

  pg_search_scope :keyword_search,
                  against: { name: "A", description: "B" },
                  using: {
                    trigram: { threshold: 0.2 },
                    tsearch: { prefix: true }
                  }

  scope :published, -> { where("published_at IS NOT NULL AND published_at <= ?", Time.current) }
  scope :by_category, ->(id) { where(category_id: id) if id.present? }
  scope :by_category_slug, ->(slug) {
    slug.present? ? joins(:category).where(categories: { slug: slug }) : all
  }
  scope :price_between, ->(min, max) {
    s = self
    s = s.where("price_cents >= ?", min.to_i) if min.present?
    s = s.where("price_cents <= ?", max.to_i) if max.present?
    s
  }
  scope :with_tags, ->(tags) {
    tags = Array(tags).reject(&:blank?)
    tags.empty? ? all : where("tags && ARRAY[?]::varchar[]", tags)
  }

  after_create :ensure_inventory

  # デジタル商品は在庫を持たず、配布ファイルがあれば販売可能
  def in_stock?(quantity = 1)
    return model_file.attached? if is_digital?
    (inventory&.stock || 0) - (inventory&.reserved || 0) >= quantity
  end

  def physical?
    !is_digital?
  end

  # 購入者に組み立て説明書 (PDF) を配布できるか
  def assembly_guide?
    model_asset.present? && model_asset.assembly_steps.any?
  end

  def model_file_format
    return unless model_file.attached?
    File.extname(model_file.filename.to_s).delete_prefix(".").upcase
  end

  private

  def digital_not_subscribable
    errors.add(:is_subscribable, "はデジタル商品では設定できません") if is_digital? && is_subscribable?
  end

  def validate_model_file
    ext = File.extname(model_file.filename.to_s).delete_prefix(".").downcase
    unless MODEL_FILE_EXTENSIONS.include?(ext)
      errors.add(:model_file, "は #{MODEL_FILE_EXTENSIONS.join('/')} のいずれかにしてください")
    end
    if model_file.blob.byte_size > MODEL_FILE_MAX_BYTES
      errors.add(:model_file, "は #{MODEL_FILE_MAX_BYTES / 1.megabyte}MB 以下にしてください")
    end
  end

  def ensure_inventory
    create_inventory!(stock: 0, reserved: 0) unless inventory
  end
end
