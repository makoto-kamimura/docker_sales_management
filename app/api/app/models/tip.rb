# 投げ銭。0円で販売した商品を含む注文に、購入者が任意の金額 (100〜100,000円) で応援できる。
# カード決済はせず、入金 (振込など) を店舗が管理画面で確認する
class Tip < ApplicationRecord
  STATUSES = %w[pending paid cancelled].freeze
  STATUS_LABELS = { "pending" => "入金待ち", "paid" => "入金確認済み", "cancelled" => "取り消し" }.freeze
  MIN_AMOUNT_CENTS = 100
  MAX_AMOUNT_CENTS = 100_000
  MESSAGE_MAX_LENGTH = 500

  belongs_to :order
  belongs_to :user
  belongs_to :confirmed_by, class_name: "User", optional: true

  validates :status, inclusion: { in: STATUSES }
  validates :amount_cents, numericality: { only_integer: true, greater_than_or_equal_to: MIN_AMOUNT_CENTS,
                                           less_than_or_equal_to: MAX_AMOUNT_CENTS }
  validates :message, length: { maximum: MESSAGE_MAX_LENGTH }
  validate  :order_must_accept_tips, on: :create

  scope :recent,  -> { order(created_at: :desc, id: :desc) }
  scope :pending, -> { where(status: "pending") }
  scope :paid,    -> { where(status: "paid") }

  def status_label
    STATUS_LABELS.fetch(status, status)
  end

  def api_attributes
    { id: id, order_id: order_id, amount_cents: amount_cents, message: message, status: status,
      status_label: status_label, created_at: created_at, paid_at: paid_at }
  end

  private

  def order_must_accept_tips
    return errors.add(:base, "この注文には投げ銭できません (0円の商品を含む注文だけが対象です)") unless order&.accepts_tips?

    errors.add(:base, "自分の注文にだけ投げ銭できます") unless order.user_id == user_id
  end
end
