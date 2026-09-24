class ServiceRequest < ApplicationRecord
  # 顧客からの 問い合わせ (inquiry) と オーダーメイド制作依頼 (custom) を共通のテーブルで扱う。
  KINDS = %w[inquiry custom].freeze

  # kind ごとに取りうるステータス
  STATUSES = {
    "inquiry" => %w[pending answered closed].freeze,
    "custom"  => %w[pending quoted in_progress completed cancelled].freeze
  }.freeze

  belongs_to :user
  belongs_to :product, optional: true # オーダーメイド: 参考にする商品
  belongs_to :order, optional: true   # 問い合わせ: 対象の注文

  validates :kind, inclusion: { in: KINDS }
  validates :body, presence: true
  validates :subject, presence: true, if: -> { kind == "inquiry" }
  validate  :status_allowed_for_kind
  validate  :order_belongs_to_user

  scope :recent,  -> { order(created_at: :desc, id: :desc) }
  scope :by_kind, ->(kind) { kind.present? ? where(kind: kind) : all }
  scope :open,    -> { where(status: %w[pending quoted in_progress]) }

  def statuses
    STATUSES.fetch(kind, [])
  end

  def transition_to!(new_status)
    raise ArgumentError, "invalid status #{new_status}" unless statuses.include?(new_status)
    update!(status: new_status)
  end

  # 店舗からの回答。未対応の問い合わせは回答と同時に「回答済み」にする
  def reply!(text)
    attrs = { reply: text, replied_at: Time.current }
    attrs[:status] = "answered" if kind == "inquiry" && status == "pending"
    update!(attrs)
  end

  private

  def status_allowed_for_kind
    return if status.blank? || statuses.include?(status)
    errors.add(:status, "は#{kind}では使用できません")
  end

  def order_belongs_to_user
    errors.add(:order, "が見つかりません") if order && order.user_id != user_id
  end
end
