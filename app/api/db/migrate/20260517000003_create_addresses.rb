class CreateAddresses < ActiveRecord::Migration[7.2]
  def change
    create_table :addresses do |t|
      t.references :user, null: false, foreign_key: true
      t.string :label, null: false, default: "default"
      t.string :recipient, null: false
      t.string :postal_code, null: false
      t.string :prefecture, null: false
      t.string :city, null: false
      t.string :line1, null: false
      t.string :line2
      t.string :phone
      t.boolean :is_default, null: false, default: false
      t.timestamps
    end
  end
end
