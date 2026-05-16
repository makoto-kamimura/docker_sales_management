class SubscriptionPlan < ApplicationRecord
  has_many :subscriptions, dependent: :restrict_with_error

  validates :name, :code, presence: true
  validates :code, uniqueness: true
  validates :interval_days, numericality: { greater_than: 0 }
  validates :discount_percent, numericality: { in: 0..100 }

  scope :active, -> { where(active: true) }
end
