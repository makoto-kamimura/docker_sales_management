# AIコンシェルジュを Dify から Claude API の直接呼び出しに変えた。会話の文脈は ai_messages から組み立てるので、Dify の会話 ID は使わない
class RemoveDifyConversationIdFromAiConversations < ActiveRecord::Migration[7.2]
  def change
    remove_column :ai_conversations, :dify_conversation_id, :string
  end
end
