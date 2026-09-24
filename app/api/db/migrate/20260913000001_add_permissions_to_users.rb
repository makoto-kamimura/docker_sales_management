# スタッフごとの権限 (販売 / 制作 / 注文)。管理者 (admin) は常にすべての権限を持つ。
class AddPermissionsToUsers < ActiveRecord::Migration[7.2]
  def up
    add_column :users, :permissions, :string, array: true, null: false, default: []
    # 従来の staff (制作スタッフ) は制作権限を引き継ぐ
    execute "UPDATE users SET permissions = ARRAY['production'] WHERE role = 'staff'"
  end

  def down
    remove_column :users, :permissions
  end
end
