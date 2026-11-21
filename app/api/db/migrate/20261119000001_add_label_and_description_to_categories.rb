# カテゴリに、トップの「取り扱い」のカードに出す英字の見出しと、ひとこと説明を持たせる。
# これまで Web に直書きしていた文言を、いまあるカテゴリに入れる (管理画面で書き換えられる)
class AddLabelAndDescriptionToCategories < ActiveRecord::Migration[7.2]
  TEXTS = {
    "3d-prints" => ["3D PRINTS", "受注後に出力・仕上げてお届けする完成品。"],
    "3d-models" => ["3D MODELS", "自宅のプリンタで出力できるSTLデータ。購入後すぐダウンロード。"],
    "handmade" => ["HANDMADE", "手縫いのレザー小物や無垢材の木工品。"],
    "materials" => ["MATERIALS", "フィラメントやクラフトキット。定期便も。"],
    "diy-plans" => ["DIY PLANS", "家具や棚を自分で作れる図面データ (PDF / DXF)。"],
    "custom" => ["CUSTOM", "名入れ・サイズ変更・一点ものの制作を依頼。"]
  }.freeze

  def up
    add_column :categories, :label, :string, null: false, default: ""
    add_column :categories, :description, :string, null: false, default: ""

    TEXTS.each do |slug, (label, description)|
      execute <<~SQL.squish
        UPDATE categories SET label = #{quote(label)}, description = #{quote(description)}
        WHERE slug = #{quote(slug)}
      SQL
    end
  end

  def down
    remove_column :categories, :description
    remove_column :categories, :label
  end

  private

  def quote(value)
    connection.quote(value)
  end
end
