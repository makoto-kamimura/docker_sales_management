class AiMessage < ApplicationRecord
  ROLES = %w[user assistant system].freeze

  belongs_to :ai_conversation

  validates :role, inclusion: { in: ROLES }
  validates :content, presence: true

  before_validation { self.created_at ||= Time.current }
end
