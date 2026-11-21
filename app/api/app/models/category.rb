class Category < ApplicationRecord
  # サービス系カテゴリ — カート購入ではなくオーダーメイド制作依頼フローに誘導する
  SERVICE_SLUGS = %w[custom].freeze
  # コードが slug で使っているカテゴリ (オーダーメイドの受付・3Dプリントのページ・3Dモデルと DIY設計図の販売先)。
  # 消せない (止めることはできる)
  SYSTEM_SLUGS = %w[custom 3d-prints 3d-models diy-plans].freeze

  belongs_to :parent, class_name: "Category", optional: true
  has_many :children, class_name: "Category", foreign_key: :parent_id, dependent: :nullify
  has_many :products, dependent: :restrict_with_error

  # slug は URL と、コードの出し分けに結びついているので、作ったあとは変えない
  attr_readonly :slug

  validates :name, presence: true, length: { maximum: 40 }
  validates :slug, presence: true, uniqueness: true, length: { maximum: 40 },
                   format: { with: /\A[a-z0-9_\-]+\z/, message: "は英小文字・数字・ - _ で入力してください" }
  validates :label, length: { maximum: 30 }
  validates :description, length: { maximum: 120 }

  before_destroy :ensure_deletable, prepend: true

  default_scope { order(:position, :id) }
  # 販売中のカテゴリ。販売を止めたカテゴリの商品は、一覧・カート・注文・AIコンシェルジュの案内から外れる
  scope :active, -> { where(active: true) }

  def self.active_slugs
    active.pluck(:slug)
  end

  def self.slug_active?(slug)
    active.exists?(slug: slug)
  end

  # 並びの最後に足すときの position
  def self.next_position
    (unscoped.maximum(:position) || 0) + 1
  end

  # 1つ上 (-1) か下 (+1) へ動かし、全体の position を 1 から振り直す
  def self.move!(category, offset)
    transaction do
      list = lock.to_a
      from = list.index { |c| c.id == category.id }
      to = from + offset
      if to.between?(0, list.size - 1)
        list.insert(to, list.delete_at(from))
        list.each_with_index { |c, i| c.update_column(:position, i + 1) if c.position != i + 1 }
      end
    end
  end

  def service?
    SERVICE_SLUGS.include?(slug)
  end

  def system?
    SYSTEM_SLUGS.include?(slug)
  end

  private

  def ensure_deletable
    return unless system?

    errors.add(:base, "#{name}は消せません（販売を止めることはできます）")
    throw :abort
  end
end
