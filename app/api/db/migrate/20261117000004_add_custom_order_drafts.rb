# AIコンシェルジュからのオーダーメイド依頼。
# ai_messages.order_draft: 応答で提示した依頼の下書き (確認カードに出し、「はい」でそのまま依頼にする)
# service_requests.ai_message_id: どの下書きから作った依頼か (二重の依頼を防ぎ、AIコンシェルジュ経由の目印にする)
class AddCustomOrderDrafts < ActiveRecord::Migration[7.2]
  def change
    add_column :ai_messages, :order_draft, :jsonb
    add_reference :service_requests, :ai_message, foreign_key: { on_delete: :nullify }, index: { unique: true }
  end
end
