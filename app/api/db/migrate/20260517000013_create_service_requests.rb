class CreateServiceRequests < ActiveRecord::Migration[7.2]
  def change
    create_table :service_requests do |t|
      t.references :user, null: false, foreign_key: true
      t.references :product, foreign_key: true # 参照する整備メニュー / パーツ (任意)
      t.string   :kind, null: false                       # "maintenance" | "system"
      t.string   :status, null: false, default: "pending"
      t.string   :vehicle, null: false, default: ""       # 車種・型式
      t.datetime :preferred_at                            # 整備: 希望日時
      t.integer  :budget_cents                            # システム: 想定予算
      t.text     :body, null: false, default: ""          # 要件 / 相談内容
      t.string   :contact_phone, null: false, default: ""
      t.timestamps
    end

    add_index :service_requests, %i[user_id kind]
    add_index :service_requests, :status
  end
end
