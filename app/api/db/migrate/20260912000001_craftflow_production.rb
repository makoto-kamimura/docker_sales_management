# CraftFlow: 制作管理 (制作ステータス / 製作担当 / 材料管理) と 顧客管理 (顧客メモ / 問い合わせ) の追加。
class CraftflowProduction < ActiveRecord::Migration[7.2]
  def up
    # --- 注文: 8段階の制作・発送フロー --------------------------------------
    # 注文受付(received) → 入金確認(paid) → 制作待ち → 制作中 → 検品 → 発送準備 → 発送済み → 完了
    change_column_default :orders, :status, from: "pending", to: "received"
    execute "UPDATE orders SET status = 'received'  WHERE status = 'pending'"
    execute "UPDATE orders SET status = 'completed' WHERE status = 'delivered'"

    add_column :orders, :paid_at, :datetime                 # 入金確認日時 (在庫の確定引き当てもこの時点)
    add_column :orders, :materials_consumed_at, :datetime   # 制作開始時に材料を消費済みか (二重消費防止)
    add_column :orders, :due_on, :date                      # 納期
    add_reference :orders, :assignee, foreign_key: { to_table: :users } # 製作担当
    execute "UPDATE orders SET paid_at = placed_at WHERE status IN ('paid', 'shipped', 'completed')"

    # ステータス遷移の履歴 (見える化・リードタイム分析用)
    create_table :order_events do |t|
      t.references :order, null: false, foreign_key: true
      t.references :actor, foreign_key: { to_table: :users } # 操作者 (システム自動遷移は NULL)
      t.string :from_status
      t.string :status, null: false
      t.string :note, null: false, default: ""
      t.datetime :created_at, null: false
    end
    add_index :order_events, %i[status created_at]

    # --- 材料管理 -------------------------------------------------------------
    create_table :materials do |t|
      t.string  :code, null: false
      t.string  :name, null: false
      t.string  :unit, null: false, default: "個"         # g / m / 枚 / ml など
      t.decimal :stock, precision: 12, scale: 2, null: false, default: 0
      t.decimal :reorder_point, precision: 12, scale: 2, null: false, default: 0 # これを下回ったら要発注
      t.integer :unit_cost_cents, null: false, default: 0
      t.string  :supplier, null: false, default: ""
      t.text    :note, null: false, default: ""
      t.timestamps
    end
    add_index :materials, :code, unique: true

    # 商品1個あたりに使う材料 (レシピ / BOM)
    create_table :product_materials do |t|
      t.references :product, null: false, foreign_key: true
      t.references :material, null: false, foreign_key: true
      t.decimal :quantity, precision: 12, scale: 3, null: false
      t.timestamps
    end
    add_index :product_materials, %i[product_id material_id], unique: true

    # --- 顧客管理 -------------------------------------------------------------
    add_column :users, :admin_note, :text, null: false, default: "" # 店舗側だけが見る顧客メモ

    # 問い合わせ / オーダーメイド依頼 (旧: 整備予約・開発依頼)
    rename_column :service_requests, :vehicle, :subject
    add_reference :service_requests, :order, foreign_key: true # 問い合わせ対象の注文 (任意)
    add_column :service_requests, :reply, :text, null: false, default: ""
    add_column :service_requests, :replied_at, :datetime
    execute "UPDATE service_requests SET status = 'in_progress' WHERE status = 'confirmed'"
    execute "UPDATE service_requests SET kind = 'custom' WHERE kind IN ('maintenance', 'system')"
  end

  def down
    execute "UPDATE service_requests SET kind = 'system' WHERE kind IN ('custom', 'inquiry')"
    remove_column :service_requests, :replied_at
    remove_column :service_requests, :reply
    remove_reference :service_requests, :order, foreign_key: true
    rename_column :service_requests, :subject, :vehicle
    remove_column :users, :admin_note
    drop_table :product_materials
    drop_table :materials
    drop_table :order_events
    remove_reference :orders, :assignee, foreign_key: { to_table: :users }
    remove_column :orders, :due_on
    remove_column :orders, :materials_consumed_at
    remove_column :orders, :paid_at
    execute "UPDATE orders SET status = 'pending' WHERE status IN ('received')"
    execute "UPDATE orders SET status = 'paid' WHERE status IN ('awaiting_production', 'in_production', 'inspection', 'ready_to_ship')"
    execute "UPDATE orders SET status = 'delivered' WHERE status = 'completed'"
    change_column_default :orders, :status, from: "received", to: "pending"
  end
end
