# 版の中のファイルのカテゴリ (オールインワン / 分割)。キーは blob_id、値は all_in_one / parts。
# その他 (図面・説明書など) は保存しない。ファイルへのラベルなので、版を作った後も変えられる
class AddFileCategoriesToModelVersions < ActiveRecord::Migration[7.2]
  def change
    add_column :model_versions, :file_categories, :jsonb, null: false, default: {}
  end
end
