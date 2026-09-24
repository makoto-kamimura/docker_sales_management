# 3Dモデル管理 (制作権限): モデルファイルの版管理・3Dプレビュー画像・販売フラグ (商品と連動)・組み立て方法
class CreateModelAssets < ActiveRecord::Migration[7.2]
  def change
    create_table :model_assets do |t|
      t.string  :name, null: false
      t.text    :description, null: false, default: ""
      t.string  :license, null: false, default: ""
      t.text    :assembly_notes, null: false, default: ""  # 必要な部品・工具
      t.boolean :for_sale, null: false, default: false     # 販売フラグ (ショップの商品と連動)
      t.integer :price_cents, null: false, default: 0
      t.references :product, foreign_key: true, index: { unique: true } # 連動する商品 (3Dモデルデータ)
      t.references :created_by, foreign_key: { to_table: :users }
      t.timestamps
    end

    # モデルファイルの版。ファイルは ActiveStorage (file) に版ごとに残す
    create_table :model_versions do |t|
      t.references :model_asset, null: false, foreign_key: true
      t.integer :number, null: false
      t.text    :note, null: false, default: ""
      t.references :created_by, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :model_versions, %i[model_asset_id number], unique: true

    # 組み立て手順。画像は ActiveStorage (image)
    create_table :assembly_steps do |t|
      t.references :model_asset, null: false, foreign_key: true
      t.integer :position, null: false
      t.string  :title, null: false, default: ""
      t.text    :body, null: false, default: ""
      t.timestamps
    end
  end
end
