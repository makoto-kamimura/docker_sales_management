class CreateCategories < ActiveRecord::Migration[7.2]
  def change
    create_table :categories do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.references :parent, foreign_key: { to_table: :categories }
      t.integer :position, default: 0
      t.timestamps
    end

    add_index :categories, :slug, unique: true
  end
end
