class Subscription < ApplicationRecord
  STATUSES = %w[active paused cancelled].freeze

  belongs_to :user
  belongs_to :subscription_plan
  belongs_to :product
  belongs_to :address
  belongs_to :payment_method, optional: true
  has_many :deliveries, class_name: "SubscriptionDelivery", dependent: :destroy

  validates :status, inclusion: { in: STATUSES }
  validates :quantity, numericality: { greater_than: 0 }
  validates :next_delivery_on, presence: true

  scope :active, -> { where(status: "active") }

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
