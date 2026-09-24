# 制作に使う材料 (フィラメント・革・木材など) の在庫。販売商品の在庫 (Inventory) とは別管理。
class Material < ApplicationRecord
  has_many :product_materials, dependent: :destroy
  has_many :products, through: :product_materials

  validates :code, presence: true, uniqueness: true
  validates :name, :unit, presence: true
  validates :reorder_point, :unit_cost_cents, numericality: { greater_than_or_equal_to: 0 }

  default_scope { order(:code) }

  # 在庫が発注点以下 (材料の実在庫と記録がずれることもあるため、マイナス在庫も許容して警告で知らせる)
  def low?
    stock <= reorder_point
  end

  # 入荷・棚卸し・制作での消費による在庫の増減
  def adjust!(delta)
    with_lock { update!(stock: stock + delta.to_d) }
  end

  # 制作待ちの注文 (まだ材料を消費していないもの) に必要な数量
  def self.required_for_queue
    ProductMaterial.joins(product: { order_items: :order })
                   .where(orders: { status: %w[paid awaiting_production], materials_consumed_at: nil })
                   .group(:material_id)
                   .sum("product_materials.quantity * order_items.quantity")
  end
end
