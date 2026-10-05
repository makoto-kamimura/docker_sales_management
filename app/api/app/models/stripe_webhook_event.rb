# 処理済みの Stripe の Webhook のイベント。同じイベントを二度処理しないために記録する
class StripeWebhookEvent < ApplicationRecord
  self.primary_key = "event_id"

  # 記録できたら true、処理済みなら false
  def self.record!(event_id, event_type)
    insert({ event_id: event_id, event_type: event_type, processed_at: Time.current },
           returning: [:event_id]).rows.any?
  end
end
