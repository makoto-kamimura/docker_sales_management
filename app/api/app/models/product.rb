class Product < ApplicationRecord
  include PgSearch::Model

  belongs_to :category
  has_one  :inventory, dependent: :destroy
  has_one  :embedding, class_name: "ProductEmbedding", dependent: :destroy
  has_many :cart_items, dependent: :restrict_with_error
  has_many :order_items, dependent: :restrict_with_error

  validates :sku, :name, :price_cents, presence: true
  validates :sku, uniqueness: true
  validates :price_cents, numericality: { greater_than_or_equal_to: 0 }
  validates :currency, presence: true

  pg_search_scope :keyword_search,
                  against: { name: "A", description: "B" },
                  using: {
                    trigram: { threshold: 0.2 },
                    tsearch: { prefix: true }
                  }

  scope :published, -> { where("published_at IS NOT NULL AND published_at <= ?", Time.current) }
  scope :by_category, ->(id) { where(category_id: id) if id.present? }
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

  def in_stock?(quantity = 1)
    (inventory&.stock || 0) - (inventory&.reserved || 0) >= quantity
  end

  private

  def ensure_inventory
    create_inventory!(stock: 0, reserved: 0) unless inventory
  end
end
