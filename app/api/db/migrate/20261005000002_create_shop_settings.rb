# ショップ情報 (1行だけ)。特定商取引法に基づく表記の販売者の情報と、店舗の方針 (振込の期限・発送の目安・返品の条件)。
# 販売者の氏名・住所などは公開リポジトリに書かず、管理者が管理画面で入力する
class CreateShopSettings < ActiveRecord::Migration[7.2]
  def change
    create_table :shop_settings do |t|
      t.string :seller_name, null: false, default: ""
      t.string :representative_name, null: false, default: ""
      t.string :address, null: false, default: ""
      t.string :phone, null: false, default: ""
      t.string :email, null: false, default: ""
      # true なら住所・電話番号を載せず「請求があった場合には遅滞なく開示します」と表示する
      t.boolean :disclose_on_request, null: false, default: false
      t.string :contact_hours, null: false, default: ""
      t.text :transfer_payment_due, null: false, default: ""
      t.text :shipping_lead_time, null: false, default: ""
      t.text :returns_policy, null: false, default: ""
      t.text :extra_notes, null: false, default: ""
      t.timestamps
    end
  end
end
