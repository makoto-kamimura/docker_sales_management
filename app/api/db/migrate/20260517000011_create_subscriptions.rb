class CreateSubscriptions < ActiveRecord::Migration[7.2]
  def change
    create_table :subscription_plans do |t|
      t.string :name, null: false
      t.string :code, null: false
      t.integer :interval_days, null: false
      t.integer :discount_percent, null: false, default: 0
      t.text :description, null: false, default: ""
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :subscription_plans, :code, unique: true

    create_table :subscriptions do |t|
      t.references :user, null: false, foreign_key: true
      t.references :subscription_plan, null: false, foreign_key: true
      t.references :product, null: false, foreign_key: true
      t.references :address, null: false, foreign_key: true
      t.references :payment_method, foreign_key: true
      t.string :status, null: false, default: "active"
      t.integer :quantity, null: false, default: 1
      t.integer :interval_days, null: false
      t.date :next_delivery_on, null: false
      t.string :stripe_subscription_id
      t.timestamps
    end
    add_index :subscriptions, :status
    add_index :subscriptions, :next_delivery_on

    create_table :subscription_deliveries do |t|
      t.references :subscription, null: false, foreign_key: true
      t.references :order, foreign_key: true
      t.date :scheduled_on, null: false
      t.string :status, null: false, default: "scheduled"
      t.timestamps
    end
    add_index :subscription_deliveries, %i[subscription_id scheduled_on], unique: true
  end
end
