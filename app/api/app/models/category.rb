class Category < ApplicationRecord
  # サービス系カテゴリ — カート購入ではなく依頼フローに誘導する
  SERVICE_SLUGS = { "maintenance" => "maintenance", "system" => "system" }.freeze

  belongs_to :parent, class_name: "Category", optional: true
  has_many :children, class_name: "Category", foreign_key: :parent_id, dependent: :nullify
  has_many :products, dependent: :restrict_with_error

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true,
                   format: { with: /\A[a-z0-9_\-]+\z/ }

  default_scope { order(:position, :id) }

  def service?
    SERVICE_SLUGS.key?(slug)
  end
end
