class PaymentMethod < ApplicationRecord
  belongs_to :user

  validates :stripe_payment_method_id, presence: true, uniqueness: true
  validates :exp_month, inclusion: { in: 1..12 }, allow_nil: true
  validates :exp_year, numericality: { greater_than: 2000 }, allow_nil: true

  before_save :unset_other_defaults, if: -> { is_default? }

  private

  def unset_other_defaults
    user.payment_methods.where.not(id: id).update_all(is_default: false)
  end
end
