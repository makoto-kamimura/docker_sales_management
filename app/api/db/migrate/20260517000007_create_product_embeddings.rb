class CreateProductEmbeddings < ActiveRecord::Migration[7.2]
  def change
    create_table :product_embeddings, id: false do |t|
      t.references :product, primary_key: true, null: false, foreign_key: true
      t.column :embedding, "vector(1536)"
      t.datetime :indexed_at
    end

    execute <<~SQL
      CREATE INDEX index_product_embeddings_on_embedding
        ON product_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    SQL
  end
end
