class Address < ApplicationRecord
  belongs_to :user

  validates :recipient, :postal_code, :prefecture, :city, :line1, presence: true
  validates :postal_code, format: { with: /\A\d{3}-?\d{4}\z/, message: "は郵便番号形式で入力してください" }

  before_save :unset_other_defaults, if: -> { is_default? }

  private

  def unset_other_defaults
    user.addresses.where.not(id: id).update_all(is_default: false)
  end
end
