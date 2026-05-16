class CreatePaymentMethods < ActiveRecord::Migration[7.2]
  def change
    create_table :payment_methods do |t|
      t.references :user, null: false, foreign_key: true
      t.string :stripe_payment_method_id, null: false
      t.string :brand
      t.string :last4
      t.integer :exp_month
      t.integer :exp_year
      t.boolean :is_default, null: false, default: false
      t.timestamps
    end

    add_index :payment_methods, :stripe_payment_method_id, unique: true
  end
end
