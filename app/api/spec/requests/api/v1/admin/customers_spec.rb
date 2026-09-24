require "rails_helper"

RSpec.describe "Admin customers / analytics", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:taro) { create(:user, name: "Taro") }
  let(:hanako) { create(:user, name: "Hanako") }

  def paid_order(user, product: create(:product, :stocked, price_cents: 1_000), quantity: 1)
    create(:order, user: user, product: product, quantity: quantity).tap { |o| OrderWorkflow.new(o).transition!("paid") }
  end

  describe "GET /api/v1/admin/customers" do
    it "購入実績つきで一覧・検索できる (未入金の注文は購入額に含めない)" do
      paid_order(taro)
      paid_order(taro)
      create(:order, user: hanako) # 未入金
      get "/api/v1/admin/customers", params: { sort: "spent" }, headers: auth_headers(admin)
      expect(response).to have_http_status(:ok)
      first = response.parsed_body.first
      expect(first).to include("id" => taro.id, "orders_count" => 2, "total_spent_cents" => 3_200) # (1,000 + 税100 + 送料500) × 2

      get "/api/v1/admin/customers", params: { q: "hana" }, headers: auth_headers(admin)
      expect(response.parsed_body.map { |c| c["id"] }).to eq([hanako.id])
      expect(response.headers["X-Total-Count"]).to eq("1")
    end

    it "制作スタッフは 403" do
      get "/api/v1/admin/customers", headers: auth_headers(create(:user, :staff))
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET/PATCH /api/v1/admin/customers/:id" do
    it "購入履歴・よく買う商品・問い合わせ・顧客メモを扱える" do
      order = paid_order(taro, quantity: 3)
      create(:service_request, user: taro)
      patch "/api/v1/admin/customers/#{taro.id}", params: { admin_note: "ギフト利用が多い" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:no_content)

      get "/api/v1/admin/customers/#{taro.id}", headers: auth_headers(admin)
      body = response.parsed_body
      expect(body["admin_note"]).to eq("ギフト利用が多い")
      expect(body["orders"].map { |o| o["id"] }).to eq([order.id])
      expect(body["top_products"].first["quantity"]).to eq(3)
      expect(body["requests"].size).to eq(1)
      expect(body["open_requests_count"]).to eq(1)
    end
  end

  describe "GET /api/v1/admin/dashboard/sales" do
    it "売上・カテゴリ別・リピート率・制作状況を返す" do
      paid_order(taro)
      order = paid_order(taro)
      OrderWorkflow.new(order).transition!("in_production")
      OrderWorkflow.new(order).transition!("shipped")
      create(:order, user: hanako) # 未入金は売上に含めない

      get "/api/v1/admin/dashboard/sales", headers: auth_headers(admin)
      body = response.parsed_body
      expect(body).to include("total_orders" => 2, "total_revenue_cents" => 3_200, "average_order_cents" => 1_600)
      expect(body["by_day"].size).to eq(30)
      expect(body["by_day"].last).to include("revenue_cents" => 3_200, "orders" => 2)
      expect(body["by_category"].sum { |c| c["revenue_cents"] }).to eq(2_000) # 明細合計 (税・送料除く)
      expect(body["customers"]).to include("buyers" => 1, "repeat_buyers" => 1, "repeat_rate" => 1.0)
      wip = body["production"]["wip"].to_h { |w| [w["status"], w["count"]] }
      expect(wip).to include("received" => 1, "paid" => 1, "shipped" => 1)
      expect(body["production"]["avg_lead_time_days"]).to eq(0.0)
      expect(body["production"]["stage_hours"].find { |s| s["status"] == "paid" }["samples"]).to eq(1)
    end
  end
end
