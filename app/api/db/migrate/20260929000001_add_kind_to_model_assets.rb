# 3Dモデル管理で DIY設計図も扱えるように種別を持たせる (model: 3Dモデル / blueprint: DIY設計図)。
# 設計図の販売先カテゴリ (diy-plans) もここで作る。本番は db:seed を流さない運用なので、マイグレーションで入れておく
class AddKindToModelAssets < ActiveRecord::Migration[7.2]
  def up
    add_column :model_assets, :kind, :string, null: false, default: "model"
    add_index :model_assets, :kind

    execute <<~SQL
      INSERT INTO categories (name, slug, position, created_at, updated_at)
      VALUES ('DIY設計図', 'diy-plans', 6, NOW(), NOW())
      ON CONFLICT (slug) DO NOTHING
    SQL
  end

  # カテゴリは商品から参照されている可能性があるので残す
  def down
    remove_index :model_assets, :kind
    remove_column :model_assets, :kind
  end
end
