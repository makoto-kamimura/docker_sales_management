class Inventory < ApplicationRecord
  belongs_to :product

  validates :stock, :reserved, numericality: { greater_than_or_equal_to: 0 }

  def available
    stock - reserved
  end

  def reserve!(qty)
    with_lock do
      raise ApplicationController::NotFoundError, "在庫不足: #{product.name}" if available < qty
      update!(reserved: reserved + qty)
    end
  end

  def release!(qty)
    with_lock { update!(reserved: [reserved - qty, 0].max) }
  end

  def consume!(qty)
    with_lock do
      raise ApplicationController::NotFoundError, "在庫不足: #{product.name}" if stock < qty
      update!(stock: stock - qty, reserved: [reserved - qty, 0].max)
    end
  end
end
