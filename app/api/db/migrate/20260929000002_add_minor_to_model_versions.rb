# 版の枝番。最新版のファイルを引き継いでファイルを追加した版は v3.1, v3.2 … とする (通常の新しい版は次の整数で枝番 0)
class AddMinorToModelVersions < ActiveRecord::Migration[7.2]
  def change
    add_column :model_versions, :minor, :integer, null: false, default: 0
    remove_index :model_versions, %i[model_asset_id number], unique: true
    add_index :model_versions, %i[model_asset_id number minor], unique: true
  end
end
