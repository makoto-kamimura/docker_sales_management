class CreateProducts < ActiveRecord::Migration[7.2]
  def change
    create_table :products do |t|
      t.references :category, null: false, foreign_key: true
      t.string  :sku, null: false
      t.string  :name, null: false
      t.text    :description, null: false, default: ""
      t.string  :tags, array: true, default: []
      t.integer :price_cents, null: false
      t.string  :currency, null: false, default: "JPY"
      t.boolean :is_subscribable, null: false, default: false
      t.datetime :published_at
      t.timestamps
    end

    add_index :products, :sku, unique: true
    add_index :products, :published_at
    add_index :products, :tags, using: :gin
    # trigram index for name/description fuzzy search
    execute "CREATE INDEX index_products_on_name_trgm ON products USING gin (name gin_trgm_ops)"
    execute "CREATE INDEX index_products_on_description_trgm ON products USING gin (description gin_trgm_ops)"
  end
end
