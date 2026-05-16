class CreateInventories < ActiveRecord::Migration[7.2]
  def change
    create_table :inventories do |t|
      t.references :product, null: false, foreign_key: true, index: { unique: true }
      t.integer :stock, null: false, default: 0
      t.integer :reserved, null: false, default: 0
      t.timestamps
    end
  end
end
