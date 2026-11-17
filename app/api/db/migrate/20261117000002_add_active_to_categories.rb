# カテゴリごとに「販売中」かを持つ。販売を止めたカテゴリは、商品の一覧・カート・注文・画面のメニューから外れる
class AddActiveToCategories < ActiveRecord::Migration[7.2]
  def change
    add_column :categories, :active, :boolean, null: false, default: true
  end
end
