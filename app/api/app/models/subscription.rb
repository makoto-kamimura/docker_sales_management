# 定期便。カード (Stripe のサブスクリプション) で、お届けの間隔ごとに請求する。
# 請求が済むたびに Webhook (invoice.paid) でお届け分の注文を作る (SubscriptionOrderCreator)。
# 状態・次回お届け日は Stripe の契約の状態に合わせる。stripe_subscription_id のない古い購読は、この DB の中だけで管理する
class Subscription < ApplicationRecord
  # incomplete: 申し込み手続き中 (カードの決済待ち) / past_due: 支払いに失敗し、Stripe が再試行している
  STATUSES = %w[incomplete active paused past_due cancelled].freeze
  STATUS_LABELS = {
    "incomplete" => "申し込み手続き中", "active" => "お届け中", "paused" => "一時停止中",
    "past_due" => "支払いの確認待ち", "cancelled" => "解約済み"
  }.freeze

  belongs_to :user
  belongs_to :subscription_plan
  belongs_to :product
  belongs_to :address
  has_many :deliveries, class_name: "SubscriptionDelivery", dependent: :destroy
  has_many :orders, dependent: :nullify

  validates :status, inclusion: { in: STATUSES }
  validates :quantity, numericality: { greater_than: 0 }
  validates :next_delivery_on, presence: true

  scope :active, -> { where(status: "active") }

  def self.discounted_unit_price(product, plan)
    ((product.price_cents * (100 - plan.discount_percent)) / 100.0).round
  end

  def status_label
    STATUS_LABELS.fetch(status, status)
  end

  # Stripe が請求する購読か
  def card?
    stripe_subscription_id.present?
  end

  def unit_price
    unit_price_cents || self.class.discounted_unit_price(product, subscription_plan)
  end

  # 1回のお届けの金額 (税・送料込み)
  def charge_totals
    Pricing.calc([{ product: product, unit_price_cents: unit_price, quantity: quantity }])
  end

  def charge_cents
    charge_totals[:total_cents]
  end

  def pause!
    update!(status: "paused")
  end

  def resume!
    update!(status: "active")
  end

  def cancel!
    update!(status: "cancelled")
  end

  def skip_next!
    update!(next_delivery_on: next_delivery_on + interval_days.days)
  end
end
