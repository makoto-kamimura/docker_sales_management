class ProductEmbedding < ApplicationRecord
  self.primary_key = :product_id

  belongs_to :product

  has_neighbors :embedding
end
