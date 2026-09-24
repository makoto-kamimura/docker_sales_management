# 商品1個の制作に使う材料と数量 (レシピ / BOM)
class ProductMaterial < ApplicationRecord
  belongs_to :product
  belongs_to :material

  validates :quantity, numericality: { greater_than: 0 }
  validates :material_id, uniqueness: { scope: :product_id }
end
