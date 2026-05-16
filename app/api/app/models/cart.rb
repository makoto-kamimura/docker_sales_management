class Cart < ApplicationRecord
  belongs_to :user
  has_many :items, class_name: "CartItem", dependent: :destroy

  def subtotal_cents
    items.includes(:product).sum { |i| i.product.price_cents * i.quantity }
  end

  def total_items
    items.sum(:quantity)
  end
end
