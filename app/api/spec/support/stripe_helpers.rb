# カード決済 (Stripe) のテスト。Stripe の API は StripeService ごと差し替え、Webhook は本物の署名で送る
module StripeHelpers
  TEST_WEBHOOK_SECRET = "whsec_test_secret".freeze

  # Stripe の設定がある状態にする (ブロックの間だけ)
  def with_stripe_env(&block)
    keys = { "STRIPE_SECRET_KEY" => "sk_test_dummy", "STRIPE_WEBHOOK_SECRET" => TEST_WEBHOOK_SECRET,
             "APP_BASE_URL" => "https://shop.example.test" }
    saved = keys.keys.index_with { |k| ENV[k] }
    keys.each { |k, v| ENV[k] = v }
    block.call
  ensure
    saved.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end

  def checkout_session_double(id = "cs_test_1")
    double("Stripe::Checkout::Session", id: id, url: "https://checkout.stripe.test/c/#{id}")
  end

  # Stripe と同じ形式で署名した通知を送る
  def send_stripe_webhook(type, object, id: "evt_#{SecureRandom.hex(6)}", secret: TEST_WEBHOOK_SECRET)
    payload = { id: id, object: "event", type: type, created: Time.current.to_i, data: { object: object } }.to_json
    at = Time.now
    signature = Stripe::Webhook::Signature.compute_signature(at, payload, secret)
    post "/api/v1/webhooks/stripe", params: payload,
                                    headers: { "Stripe-Signature" => Stripe::Webhook::Signature.generate_header(at, signature),
                                               "CONTENT_TYPE" => "application/json" }
  end
end

RSpec.configure do |config|
  config.include StripeHelpers, type: :request
end
