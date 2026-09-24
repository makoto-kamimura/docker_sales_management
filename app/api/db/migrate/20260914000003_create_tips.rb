# 投げ銭: 0円で販売した商品を含む注文に、購入者が任意の金額で応援できる。入金 (振込など) は店舗が確認する
class CreateTips < ActiveRecord::Migration[7.2]
  def change
    create_table :tips do |t|
      t.references :order, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.integer :amount_cents, null: false
      t.text    :message, null: false, default: ""
      t.string  :status, null: false, default: "pending" # pending 入金待ち / paid 入金確認済み / cancelled 取り消し
      t.datetime :paid_at
      t.references :confirmed_by, foreign_key: { to_table: :users } # 入金確認・取り消しをした店舗側のユーザー
      t.timestamps
    end
    add_index :tips, %i[status created_at]
  end
end
