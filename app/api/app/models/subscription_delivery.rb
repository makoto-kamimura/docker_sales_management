class SubscriptionDelivery < ApplicationRecord
  STATUSES = %w[scheduled skipped delivered failed].freeze

  belongs_to :subscription
  belongs_to :order, optional: true

  validates :status, inclusion: { in: STATUSES }
end
