# 1つの版に複数の3Dモデルファイルを保存できるようにする (has_one_attached :file → has_many_attached :files)
class RenameModelVersionFileAttachments < ActiveRecord::Migration[7.2]
  def up
    execute "UPDATE active_storage_attachments SET name = 'files' WHERE record_type = 'ModelVersion' AND name = 'file'"
  end

  def down
    execute "UPDATE active_storage_attachments SET name = 'file' WHERE record_type = 'ModelVersion' AND name = 'files'"
  end
end
