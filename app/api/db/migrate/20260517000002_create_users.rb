class CreateUsers < ActiveRecord::Migration[7.2]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :name, null: false, default: ""
      t.string :role, null: false, default: "member"
      t.string :stripe_customer_id
      t.timestamps
    end

    add_index :users, :email, unique: true
    add_index :users, :role
  end
end
