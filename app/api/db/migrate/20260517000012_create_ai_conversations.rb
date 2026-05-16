class CreateAiConversations < ActiveRecord::Migration[7.2]
  def change
    create_table :ai_conversations do |t|
      t.references :user, foreign_key: true
      t.string :dify_conversation_id
      t.datetime :started_at, null: false
      t.timestamps
    end

    create_table :ai_messages do |t|
      t.references :ai_conversation, null: false, foreign_key: true
      t.string :role, null: false
      t.text :content, null: false
      t.string :cta
      t.datetime :created_at, null: false
    end
  end
end
