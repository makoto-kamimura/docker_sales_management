class AddDigitalToProducts < ActiveRecord::Migration[7.2]
  def change
    # 3Dモデルデータ等のダウンロード販売品。ファイル本体は ActiveStorage (model_file) に保存する。
    add_column :products, :is_digital, :boolean, null: false, default: false
    add_column :products, :license, :string, null: false, default: "" # 利用許諾 (例: 個人利用のみ)
    add_index  :products, :is_digital

    # デジタル商品のみの注文は配送先を持たない
    change_column_null :orders, :address_id, true
  end
end
