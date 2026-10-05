# カード決済を Stripe Checkout に切り替える。カード情報はこのサーバーに保存せず (payment_methods を廃止)、
# 支払いの状態は Stripe の Webhook で反映する。同じ Webhook を二度処理しないよう、処理済みのイベントを記録する
class SwitchToStripeCheckout < ActiveRecord::Migration[7.2]
  def up
    create_table :stripe_webhook_events, id: false do |t|
      t.string :event_id, null: false, primary_key: true
      t.string :event_type, null: false
      t.datetime :processed_at, null: false
    end

    # 注文: 支払い方法 (card / transfer / free)、Checkout のセッション、定期便の請求
    add_column :orders, :payment_kind, :string, null: false, default: "transfer"
    add_column :orders, :stripe_checkout_session_id, :string
    add_column :orders, :stripe_invoice_id, :string
    add_reference :orders, :subscription, foreign_key: true
    add_index :orders, :stripe_checkout_session_id
    add_index :orders, :stripe_invoice_id, unique: true
    execute <<~SQL
      UPDATE orders SET payment_kind = CASE
        WHEN total_cents = 0 THEN 'free'
        WHEN stripe_payment_intent_id IS NOT NULL THEN 'card'
        ELSE 'transfer' END
    SQL

    # 投げ銭: 支払い方法と Checkout のセッション
    add_column :tips, :payment_kind, :string, null: false, default: "transfer"
    add_column :tips, :stripe_checkout_session_id, :string
    add_column :tips, :stripe_payment_intent_id, :string
    add_index :tips, :stripe_checkout_session_id

    # 定期便: 申し込み時の割引後の単価 (請求ごとの注文に使う)、Checkout のセッション
    add_column :subscriptions, :unit_price_cents, :integer
    add_column :subscriptions, :stripe_checkout_session_id, :string
    add_index :subscriptions, :stripe_subscription_id, unique: true

    remove_reference :orders, :payment_method, foreign_key: true, index: true
    remove_reference :subscriptions, :payment_method, foreign_key: true, index: true
    drop_table :payment_methods
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
