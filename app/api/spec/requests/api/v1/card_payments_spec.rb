require "rails_helper"

RSpec.describe "カード決済 (Stripe Checkout と Webhook)", type: :request do
  let(:buyer) { create(:user) }
  let(:address) { create(:address, user: buyer) }
  let(:stripe) { instance_double(StripeService) }

  around { |ex| with_stripe_env { ex.run } }
  before { allow(StripeService).to receive(:new).and_return(stripe) }

  def body
    response.parsed_body
  end

  def place_order(product, payment_kind:, quantity: 1)
    post "/api/v1/cart/items", params: { product_id: product.id, quantity: quantity }, headers: auth_headers(buyer), as: :json
    post "/api/v1/orders", params: { payment_kind: payment_kind, address_id: (address.id if product.physical?) }.compact,
                           headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:created)
    Order.find(body["id"])
  end

  def completed_session(kind:, id: "cs_test_1", payment_intent: "pi_test_1", **metadata)
    { id: id, object: "checkout.session", payment_status: "paid", payment_intent: payment_intent,
      metadata: { kind: kind, **metadata.transform_values(&:to_s) } }
  end

  it "設定の有無を返し、未設定ならカードの注文は 503 になる" do
    get "/api/v1/payment_settings"
    expect(body).to eq("card_enabled" => true)

    ENV.delete("STRIPE_WEBHOOK_SECRET")
    get "/api/v1/payment_settings"
    expect(body).to eq("card_enabled" => false)

    post "/api/v1/cart/items", params: { product_id: create(:product, :digital, price_cents: 800).id }, headers: auth_headers(buyer), as: :json
    post "/api/v1/orders", params: { payment_kind: "card" }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:service_unavailable)
    expect(Order.count).to eq(0)
  end

  describe "注文" do
    let(:product) { create(:product, :stocked, price_cents: 3_000) }

    it "カードの注文は決済の画面を開き、Webhook で入金確認になる (在庫の引き当てを確定)" do
      order = place_order(product, payment_kind: "card", quantity: 2)
      expect(order).to have_attributes(status: "received", payment_kind: "card")
      expect(body).to include("payment_kind" => "card", "card_payable" => true)

      expect(stripe).to receive(:expire_checkout_session).with(nil)
      expect(stripe).to receive(:create_payment_checkout) do |**args|
        expect(args[:line_items]).to eq([{ name: product.name, amount: 3_000, quantity: 2 }, { name: "消費税", amount: 600, quantity: 1 }])
        expect(args[:line_items].sum { |l| l[:amount] * l[:quantity] }).to eq(order.total_cents)
        expect(args[:metadata]).to eq(kind: "order", order_id: order.id.to_s)
        expect(args[:success_url]).to eq("https://shop.example.test/orders/#{order.id}?checkout=success")
        checkout_session_double
      end
      post "/api/v1/orders/#{order.id}/checkout_session", headers: auth_headers(buyer)
      expect(body).to eq("url" => "https://checkout.stripe.test/c/cs_test_1")
      expect(order.reload.stripe_checkout_session_id).to eq("cs_test_1")

      send_stripe_webhook("checkout.session.completed", completed_session(kind: "order", order_id: order.id), id: "evt_1")
      expect(response).to have_http_status(:no_content)
      order.reload
      expect(order).to have_attributes(status: "paid", stripe_payment_intent_id: "pi_test_1")
      expect(order.paid_at).to be_present
      expect(product.inventory.reload).to have_attributes(stock: 8, reserved: 0)

      # 同じ通知の再送は処理しない
      expect { send_stripe_webhook("checkout.session.completed", completed_session(kind: "order", order_id: order.id), id: "evt_1") }
        .not_to(change { order.events.count })
      expect(response).to have_http_status(:no_content)

      post "/api/v1/orders/#{order.id}/checkout_session", headers: auth_headers(buyer)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "データだけの注文はカード決済で完了になり、ダウンロードできる" do
      order = place_order(create(:product, :digital, price_cents: 800), payment_kind: "card")
      send_stripe_webhook("checkout.session.completed", completed_session(kind: "order", order_id: order.id))
      expect(order.reload.status).to eq("completed")
      expect(order.events.map(&:note)).to include("カード決済 (Stripe)")
    end

    it "決済の画面の期限が切れても注文は残り、払い直せる (前の画面は閉じる)" do
      order = place_order(product, payment_kind: "card")
      order.update!(stripe_checkout_session_id: "cs_old")
      send_stripe_webhook("checkout.session.expired", { id: "cs_old", object: "checkout.session", payment_status: "unpaid",
                                                        metadata: { kind: "order", order_id: order.id.to_s } })
      expect(order.reload).to have_attributes(status: "received", stripe_checkout_session_id: nil)

      order.update!(stripe_checkout_session_id: "cs_open")
      expect(stripe).to receive(:expire_checkout_session).with("cs_open")
      allow(stripe).to receive(:create_payment_checkout).and_return(checkout_session_double("cs_new"))
      post "/api/v1/orders/#{order.id}/checkout_session", headers: auth_headers(buyer)
      expect(order.reload.stripe_checkout_session_id).to eq("cs_new")
    end

    it "キャンセル後に決済されたら、注文は変えずに返金のメモを残す" do
      order = place_order(product, payment_kind: "card")
      OrderWorkflow.new(order).transition!("cancelled")
      send_stripe_webhook("checkout.session.completed", completed_session(kind: "order", order_id: order.id))
      expect(response).to have_http_status(:no_content)
      expect(order.reload.status).to eq("cancelled")
      expect(order.events.last.note).to include("返金してください")
    end

    it "振込の注文は注文受付のままで、カードの決済の画面は開けない" do
      order = place_order(product, payment_kind: "transfer")
      expect(order).to have_attributes(status: "received", payment_kind: "transfer")
      expect(body["card_payable"]).to be(false)
      post "/api/v1/orders/#{order.id}/checkout_session", headers: auth_headers(buyer)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "他人の注文の決済の画面は開けない" do
      order = place_order(product, payment_kind: "card")
      post "/api/v1/orders/#{order.id}/checkout_session", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "Webhook の検証" do
    it "署名が正しくなければ 400、未設定なら 503" do
      send_stripe_webhook("checkout.session.completed", {}, secret: "whsec_wrong")
      expect(response).to have_http_status(:bad_request)

      post "/api/v1/webhooks/stripe", params: "{}", headers: { "CONTENT_TYPE" => "application/json" }
      expect(response).to have_http_status(:bad_request)
      expect(StripeWebhookEvent.count).to eq(0)

      ENV.delete("STRIPE_SECRET_KEY")
      send_stripe_webhook("checkout.session.completed", {})
      expect(response).to have_http_status(:service_unavailable)
    end
  end

  describe "投げ銭" do
    let(:order) { place_order(create(:product, :digital, price_cents: 0), payment_kind: "transfer") }

    it "カードの投げ銭は決済の画面を開き、Webhook で入金済みになる" do
      post "/api/v1/orders/#{order.id}/tips", params: { amount_cents: 500, payment_kind: "card" }, headers: auth_headers(buyer), as: :json
      expect(body).to include("payment_kind" => "card", "status" => "pending", "card_payable" => true)
      tip = Tip.find(body["id"])

      allow(stripe).to receive(:expire_checkout_session)
      expect(stripe).to receive(:create_payment_checkout) do |**args|
        expect(args[:line_items]).to eq([{ name: "投げ銭 (ご注文 ##{order.id})", amount: 500 }])
        expect(args[:metadata]).to include(kind: "tip", tip_id: tip.id.to_s)
        checkout_session_double("cs_tip")
      end
      post "/api/v1/orders/#{order.id}/tips/#{tip.id}/checkout_session", headers: auth_headers(buyer)
      expect(body["url"]).to include("cs_tip")

      send_stripe_webhook("checkout.session.completed", completed_session(kind: "tip", id: "cs_tip", tip_id: tip.id))
      expect(tip.reload).to have_attributes(status: "paid", stripe_payment_intent_id: "pi_test_1")
    end

    it "振込の投げ銭はカードの決済の画面を開けず、取り消しでは開いた画面を閉じる" do
      post "/api/v1/orders/#{order.id}/tips", params: { amount_cents: 500 }, headers: auth_headers(buyer), as: :json
      expect(body).to include("payment_kind" => "transfer", "card_payable" => false)
      post "/api/v1/orders/#{order.id}/tips/#{body['id']}/checkout_session", headers: auth_headers(buyer)
      expect(response).to have_http_status(:unprocessable_entity)

      tip = order.tips.create!(user: buyer, amount_cents: 300, payment_kind: "card", stripe_checkout_session_id: "cs_open")
      expect(stripe).to receive(:expire_checkout_session).with("cs_open")
      delete "/api/v1/orders/#{order.id}/tips/#{tip.id}", headers: auth_headers(buyer)
      expect(tip.reload.status).to eq("cancelled")
    end
  end

  describe "定期便" do
    let(:plan) { SubscriptionPlan.create!(name: "月1回お届け", code: "monthly", interval_days: 30, discount_percent: 12) }
    let(:product) { create(:product, :stocked, price_cents: 2_000, is_subscribable: true) }

    def subscribe
      allow(stripe).to receive(:create_subscription_checkout).and_return(checkout_session_double("cs_sub"))
      post "/api/v1/subscriptions", params: { subscription_plan_id: plan.id, product_id: product.id, address_id: address.id, quantity: 2 },
                                    headers: auth_headers(buyer), as: :json
      expect(response).to have_http_status(:created)
      Subscription.find(body["id"])
    end

    def invoice(id, sub, amount: 4_372)
      { id: id, object: "invoice", amount_paid: amount,
        parent: { subscription_details: { subscription: "sub_test_1", metadata: { kind: "subscription", subscription_id: sub.id.to_s } } } }
    end

    it "申し込みは手続き中で記録し、請求ごとに注文を作って入金確認へ進める" do
      sub = subscribe
      expect(body).to include("status" => "incomplete", "checkout_url" => "https://checkout.stripe.test/c/cs_sub",
                              "unit_price_cents" => 1_760, "charge_cents" => 4_372)
      expect(sub.stripe_checkout_session_id).to eq("cs_sub")

      # 請求の通知が申し込みの通知より先に届いても、metadata で購読を見つける
      send_stripe_webhook("invoice.paid", invoice("in_1", sub))
      send_stripe_webhook("checkout.session.completed",
                          { id: "cs_sub", object: "checkout.session", payment_status: "paid", subscription: "sub_test_1",
                            metadata: { kind: "subscription", subscription_id: sub.id.to_s } })
      sub.reload
      expect(sub).to have_attributes(status: "active", stripe_subscription_id: "sub_test_1")

      order = sub.orders.sole
      expect(order).to have_attributes(status: "paid", payment_kind: "card", stripe_invoice_id: "in_1", total_cents: 4_372,
                                       address_id: address.id)
      expect(order.items.sole).to have_attributes(product_id: product.id, quantity: 2, unit_price_cents: 1_760)
      expect(sub.deliveries.sole.order).to eq(order)
      expect(product.inventory.reload.stock).to eq(8)

      # 同じ請求からは注文を二度作らない (別のイベント ID で届いても)
      send_stripe_webhook("invoice.paid", invoice("in_1", sub))
      expect(sub.orders.count).to eq(1)

      # 次の請求日を次回お届け日にする
      period_end = Time.zone.parse("2026-11-04 09:00 +09:00")
      send_stripe_webhook("customer.subscription.updated",
                          { id: "sub_test_1", object: "subscription", status: "active", pause_collection: nil,
                            metadata: { subscription_id: sub.id.to_s }, items: { data: [{ current_period_end: period_end.to_i }] } })
      expect(sub.reload.next_delivery_on).to eq(Date.new(2026, 11, 4))

      send_stripe_webhook("invoice.payment_failed", invoice("in_2", sub))
      expect(sub.reload.status).to eq("past_due")
      get "/api/v1/subscriptions/#{sub.id}", headers: auth_headers(buyer)
      expect(body).to include("status_label" => "支払いの確認待ち", "card" => true)

      send_stripe_webhook("customer.subscription.deleted", { id: "sub_test_1", object: "subscription", status: "canceled", metadata: {} })
      expect(sub.reload.status).to eq("cancelled")
    end

    it "在庫が足りない請求は注文受付のまま、補充を促すメモを残す" do
      sub = subscribe
      product.inventory.update!(stock: 1)
      send_stripe_webhook("invoice.paid", invoice("in_1", sub))
      order = sub.orders.sole
      expect(order.status).to eq("received")
      expect(order.events.last.note).to include("在庫を補充してから")
    end

    it "一時停止・再開・スキップ・解約は Stripe に反映する" do
      sub = subscribe
      sub.update!(status: "active", stripe_subscription_id: "sub_test_1", next_delivery_on: Date.current + 5)

      expect(stripe).to receive(:pause_subscription).with("sub_test_1")
      patch "/api/v1/subscriptions/#{sub.id}", params: { action_type: "pause" }, headers: auth_headers(buyer), as: :json
      expect(body["status"]).to eq("paused")

      expect(stripe).to receive(:resume_subscription).with("sub_test_1")
      patch "/api/v1/subscriptions/#{sub.id}", params: { action_type: "resume" }, headers: auth_headers(buyer), as: :json
      expect(body["status"]).to eq("active")

      expect(stripe).to receive(:reschedule_subscription).with("sub_test_1", Date.current + 35)
      post "/api/v1/subscriptions/#{sub.id}/skip", headers: auth_headers(buyer)
      expect(body["next_delivery_on"]).to eq((Date.current + 35).iso8601)

      patch "/api/v1/subscriptions/#{sub.id}", params: { action_type: "change_next_date", next_delivery_on: Date.current.iso8601 },
                                               headers: auth_headers(buyer), as: :json
      expect(response).to have_http_status(:unprocessable_entity)

      expect(stripe).to receive(:cancel_subscription).with("sub_test_1")
      delete "/api/v1/subscriptions/#{sub.id}", headers: auth_headers(buyer)
      expect(sub.reload.status).to eq("cancelled")
    end

    it "申し込み手続き中の取り消しは決済の画面を閉じ、期限切れでも取り消しになる" do
      sub = subscribe
      expect(stripe).to receive(:expire_checkout_session).with("cs_sub")
      delete "/api/v1/subscriptions/#{sub.id}", headers: auth_headers(buyer)
      expect(sub.reload.status).to eq("cancelled")

      other = subscribe
      send_stripe_webhook("checkout.session.expired", { id: "cs_sub", object: "checkout.session", payment_status: "unpaid",
                                                        metadata: { kind: "subscription", subscription_id: other.id.to_s } })
      expect(other.reload.status).to eq("cancelled")
    end

    it "支払いカードの変更画面を開く (アプリからは案内のページへ戻す)" do
      expect(stripe).to receive(:create_portal_session)
        .with(buyer, return_url: "https://shop.example.test/checkout/return")
        .and_return(double(url: "https://billing.stripe.test/p/1"))
      post "/api/v1/subscriptions/portal_session", params: { client: "app" }, headers: auth_headers(buyer), as: :json
      expect(body).to eq("url" => "https://billing.stripe.test/p/1")
    end

    it "Stripe が未設定なら申し込めない" do
      ENV.delete("STRIPE_SECRET_KEY")
      allow(StripeService).to receive(:new).and_call_original
      post "/api/v1/subscriptions", params: { subscription_plan_id: plan.id, product_id: product.id, address_id: address.id },
                                    headers: auth_headers(buyer), as: :json
      expect(response).to have_http_status(:service_unavailable)
      expect(Subscription.count).to eq(0)
    end
  end
end
