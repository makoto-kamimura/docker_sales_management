class AiConversation < ApplicationRecord
  belongs_to :user, optional: true
  has_many :messages, class_name: "AiMessage", dependent: :destroy

  before_validation { self.started_at ||= Time.current }
end
