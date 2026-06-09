class ServiceRequest < ApplicationRecord
  # 整備の予約 (maintenance) と システムの開発依頼 (system) を共通のテーブルで扱う。
  KINDS = %w[maintenance system].freeze

  # kind ごとに取りうるステータス遷移を定義
  STATUSES = {
    "maintenance" => %w[pending confirmed completed cancelled].freeze,
    "system"      => %w[pending quoted in_progress completed cancelled].freeze
  }.freeze

  belongs_to :user
  belongs_to :product, optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :body, presence: true
  validate  :status_allowed_for_kind
  validate  :preferred_at_for_maintenance

  scope :recent,  -> { order(created_at: :desc, id: :desc) }
  scope :by_kind, ->(kind) { kind.present? ? where(kind: kind) : all }

  def statuses
    STATUSES.fetch(kind, [])
  end

  def transition_to!(new_status)
    raise ArgumentError, "invalid status #{new_status}" unless statuses.include?(new_status)
    update!(status: new_status)
  end

  private

  def status_allowed_for_kind
    return if status.blank? || statuses.include?(status)
    errors.add(:status, "は#{kind}では使用できません")
  end

  # 整備予約は希望日時を必須にする
  def preferred_at_for_maintenance
    return unless kind == "maintenance"
    errors.add(:preferred_at, "を指定してください") if preferred_at.blank?
  end
end
