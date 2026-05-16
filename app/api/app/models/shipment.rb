class Shipment < ApplicationRecord
  STATUSES = %w[preparing shipped delivered].freeze

  belongs_to :order

  validates :status, inclusion: { in: STATUSES }
end
