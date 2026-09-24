class Order < ApplicationRecord
  # 注文受付 → 入金確認 → 制作待ち → 制作中 → 検品 → 発送準備 → 発送済み → 完了 (+ キャンセル)
  # 遷移と副作用 (在庫・材料の消費、発送情報、履歴) は OrderWorkflow が担う。
  STATUSES = %w[
    received paid awaiting_production in_production inspection ready_to_ship shipped completed cancelled
  ].freeze
  STATUS_LABELS = {
    "received" => "注文受付", "paid" => "入金確認", "awaiting_production" => "制作待ち",
    "in_production" => "制作中", "inspection" => "検品", "ready_to_ship" => "発送準備",
    "shipped" => "発送済み", "completed" => "完了", "cancelled" => "キャンセル"
  }.freeze
  # 制作ボードの制作工程
  PRODUCTION_STATUSES = %w[awaiting_production in_production inspection ready_to_ship].freeze
  # 入金確認以降 (キャンセル除く)。売上計上・デジタル商品のダウンロード可否に使う
  PAID_STATUSES = (STATUSES - %w[received cancelled]).freeze
  DOWNLOADABLE_STATUSES = PAID_STATUSES
  OPEN_STATUSES = (STATUSES - %w[completed cancelled]).freeze

  belongs_to :user
  belongs_to :address, optional: true # デジタル商品のみの注文は配送先なし (OrderCreator で検証)
  belongs_to :payment_method, optional: true
  belongs_to :assignee, class_name: "User", optional: true # 製作担当
  has_many :items, class_name: "OrderItem", dependent: :destroy
  has_many :events, -> { order(:created_at, :id) }, class_name: "OrderEvent", dependent: :destroy
  has_one  :shipment, dependent: :destroy
  has_many :tips, dependent: :destroy # 投げ銭 (0円の商品を含む注文)

  validates :status, inclusion: { in: STATUSES }
  # 担当を変えるときだけ検証する (後から制作権限を外されたスタッフが担当の注文も工程は進められる)
  validate  :assignee_must_be_staff, if: :will_save_change_to_assignee_id?

  scope :recent, -> { order(placed_at: :desc, id: :desc) }
  scope :paid, -> { where(status: PAID_STATUSES) }
  scope :downloadable, -> { where(status: DOWNLOADABLE_STATUSES) }
  scope :for_period, ->(from, to) {
    s = self
    s = s.where("placed_at >= ?", from) if from.present?
    s = s.where("placed_at <  ?", to)   if to.present?
    s
  }

  def status_label
    STATUS_LABELS.fetch(status, status)
  end

  def downloadable?
    DOWNLOADABLE_STATUSES.include?(status)
  end

  # 物販品 (配送・制作が必要な商品) を含むか
  def physical?
    items.any? { |i| i.product.physical? }
  end

  # 0円で販売した商品 (無料配布) を含む注文は、購入者が投げ銭で応援できる
  def accepts_tips?
    status != "cancelled" && items.any? { |i| i.unit_price_cents.zero? }
  end

  def overdue?
    due_on.present? && due_on < Date.current && OPEN_STATUSES.include?(status)
  end

  private

  def assignee_must_be_staff
    errors.add(:assignee, "は制作権限を持つスタッフまたは管理者を指定してください") if assignee && !assignee.can?(:production)
  end
end
