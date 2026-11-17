class AiMessage < ApplicationRecord
  ROLES = %w[user assistant system].freeze

  belongs_to :ai_conversation
  # この応答で提示したオーダーメイドの下書きから作った依頼 (order_draft があるときだけ)
  has_one :service_request, dependent: :nullify

  validates :role, inclusion: { in: ROLES }
  validates :content, presence: true

  before_validation { self.created_at ||= Time.current }
end
