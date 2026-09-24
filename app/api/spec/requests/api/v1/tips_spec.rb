require "rails_helper"

RSpec.describe "投げ銭 (0円販売)", type: :request do
  let(:buyer) { create(:user) }
  let(:free_model) { create(:product, :digital, price_cents: 0, name: "無料モデル") }

  def body
    response.parsed_body
  end

  # カートに入れて注文を確定する
  def place_order(product, user: buyer)
    post "/api/v1/cart/items", params: { product_id: product.id }, headers: auth_headers(user), as: :json
    post "/api/v1/orders", params: {}, headers: auth_headers(user), as: :json
    Order.find(body["id"])
  end

  it "0円の注文は入金確認を省略して完了し、購入者は投げ銭の申し込み・取り消しができる" do
    order = place_order(free_model)
    expect(order.status).to eq("completed")
    expect(order.events.map(&:note)).to include("0円のため入金確認を省略")

    get "/api/v1/orders/#{order.id}", headers: auth_headers(buyer)
    expect(body).to include("status" => "completed", "downloadable" => true, "accepts_tips" => true, "tips" => [])

    post "/api/v1/orders/#{order.id}/tips", params: { amount_cents: 50 }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:unprocessable_entity)

    post "/api/v1/orders/#{order.id}/tips", params: { amount_cents: 500, message: "応援しています" }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:created)
    expect(body).to include("amount_cents" => 500, "message" => "応援しています", "status" => "pending", "status_label" => "入金待ち")
    tip_id = body["id"]

    get "/api/v1/orders/#{order.id}", headers: auth_headers(buyer)
    expect(body["tips"].map { |t| t["id"] }).to eq([tip_id])

    delete "/api/v1/orders/#{order.id}/tips/#{tip_id}", headers: auth_headers(buyer)
    expect(response).to have_http_status(:no_content)
    expect(Tip.find(tip_id).status).to eq("cancelled")

    post "/api/v1/orders/#{order.id}/tips", params: { amount_cents: 500 }, headers: auth_headers(create(:user)), as: :json
    expect(response).to have_http_status(:not_found)
  end

  it "有料の商品だけの注文は入金確認待ちのままで、投げ銭できない" do
    order = place_order(create(:product, :digital, price_cents: 800))
    expect(order.status).to eq("received")

    get "/api/v1/orders/#{order.id}", headers: auth_headers(buyer)
    expect(body["accepts_tips"]).to be(false)

    post "/api/v1/orders/#{order.id}/tips", params: { amount_cents: 500 }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:unprocessable_entity)
  end

  describe "店舗の管理 (注文権限)" do
    let(:order) { place_order(free_model) }
    let!(:tip) { order.tips.create!(user: buyer, amount_cents: 1_000, message: "ありがとう") }
    let(:staff) { create(:user, role: "staff", permissions: %w[orders]) }

    it "一覧・入金確認・取り消しができ、注文詳細にも表示される" do
      get "/api/v1/admin/tips", headers: auth_headers(create(:user, role: "staff", permissions: %w[sales]))
      expect(response).to have_http_status(:forbidden)

      get "/api/v1/admin/tips", headers: auth_headers(staff)
      expect(body["summary"]).to include("pending_count" => 1, "pending_cents" => 1_000, "paid_cents" => 0)
      expect(body["tips"].first).to include("id" => tip.id, "order_id" => order.id, "user" => include("id" => buyer.id))

      patch "/api/v1/admin/tips/#{tip.id}", params: { status: "paid" }, headers: auth_headers(staff), as: :json
      expect(body).to include("status" => "paid", "confirmed_by" => { "id" => staff.id, "name" => staff.name })
      expect(body["paid_at"]).to be_present

      get "/api/v1/admin/tips", params: { status: "paid" }, headers: auth_headers(staff)
      expect(body["summary"]).to include("paid_count" => 1, "paid_cents" => 1_000)
      expect(body["tips"].size).to eq(1)

      get "/api/v1/admin/orders/#{order.id}", headers: auth_headers(staff)
      expect(body).to include("accepts_tips" => true)
      expect(body["tips"].first).to include("id" => tip.id, "status" => "paid")

      delete "/api/v1/orders/#{order.id}/tips/#{tip.id}", headers: auth_headers(buyer)
      expect(response).to have_http_status(:unprocessable_entity)

      patch "/api/v1/admin/tips/#{tip.id}", params: { status: "bogus" }, headers: auth_headers(staff), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
