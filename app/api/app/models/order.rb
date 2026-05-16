class Order < ApplicationRecord
  STATUSES = %w[pending paid shipped delivered cancelled].freeze

  belongs_to :user
  belongs_to :address
  belongs_to :payment_method, optional: true
  has_many :items, class_name: "OrderItem", dependent: :destroy
  has_one  :shipment, dependent: :destroy

  validates :status, inclusion: { in: STATUSES }

  scope :recent, -> { order(placed_at: :desc, id: :desc) }
  scope :for_period, ->(from, to) {
    s = self
    s = s.where("placed_at >= ?", from) if from.present?
    s = s.where("placed_at <  ?", to)   if to.present?
    s
  }

  def transition_to!(new_status)
    raise ArgumentError, "invalid status #{new_status}" unless STATUSES.include?(new_status)
    update!(status: new_status)
  end
end
