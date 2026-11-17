class Category < ApplicationRecord
  # サービス系カテゴリ — カート購入ではなくオーダーメイド制作依頼フローに誘導する
  SERVICE_SLUGS = %w[custom].freeze

  belongs_to :parent, class_name: "Category", optional: true
  has_many :children, class_name: "Category", foreign_key: :parent_id, dependent: :nullify
  has_many :products, dependent: :restrict_with_error

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true,
                   format: { with: /\A[a-z0-9_\-]+\z/ }

  default_scope { order(:position, :id) }
  # 販売中のカテゴリ。販売を止めたカテゴリの商品は、一覧・カート・注文・AIコンシェルジュの案内から外れる
  scope :active, -> { where(active: true) }

  def self.active_slugs
    active.pluck(:slug)
  end

  def self.slug_active?(slug)
    active.exists?(slug: slug)
  end

  def service?
    SERVICE_SLUGS.include?(slug)
  end
end
