class CreateOrders < ActiveRecord::Migration[7.2]
  def change
    create_table :orders do |t|
      t.references :user, null: false, foreign_key: true
      t.references :address, null: false, foreign_key: true
      t.references :payment_method, foreign_key: true
      t.string :status, null: false, default: "pending"
      t.integer :subtotal_cents, null: false, default: 0
      t.integer :tax_cents, null: false, default: 0
      t.integer :shipping_cents, null: false, default: 0
      t.integer :total_cents, null: false, default: 0
      t.string :currency, null: false, default: "JPY"
      t.string :stripe_payment_intent_id
      t.datetime :placed_at
      t.timestamps
    end
    add_index :orders, :status
    add_index :orders, :placed_at

    create_table :order_items do |t|
      t.references :order, null: false, foreign_key: true
      t.references :product, null: false, foreign_key: true
      t.integer :quantity, null: false
      t.integer :unit_price_cents, null: false
      t.integer :line_total_cents, null: false
      t.timestamps
    end

    create_table :shipments do |t|
      t.references :order, null: false, foreign_key: true, index: { unique: true }
      t.string :carrier
      t.string :tracking_number
      t.string :status, null: false, default: "preparing"
      t.datetime :shipped_at
      t.datetime :delivered_at
      t.timestamps
    end
  end
end
