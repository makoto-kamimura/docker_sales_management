# 3Dモデルの写真: 実モデル画像 (出力した実物) と実利用画像 (使っている様子) を複数枚ずつ。
# featured (最大3枚) を一覧・ショップの商品ページでプレビュー表示する
class CreateModelPhotos < ActiveRecord::Migration[7.2]
  def change
    create_table :model_photos do |t|
      t.references :model_asset, null: false, foreign_key: true
      t.string  :kind, null: false                       # real_model 実モデル画像 / in_use 実利用画像
      t.string  :caption, null: false, default: ""
      t.integer :position, null: false                   # 種類ごとの並び順 (1 始まり)
      t.boolean :featured, null: false, default: false   # プレビュー表示 (モデルごとに最大3枚)
      t.timestamps
    end
    add_index :model_photos, %i[model_asset_id kind position]
  end
end
