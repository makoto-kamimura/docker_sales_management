require "rails_helper"

RSpec.describe "Api::V1::ServiceRequests", type: :request do
  let(:user) { create(:user) }

  describe "POST /api/v1/service_requests" do
    it "未ログインは 401" do
      post "/api/v1/service_requests", params: { kind: "inquiry", subject: "x", body: "x" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "注文についての問い合わせを作成できる" do
      order = create(:order, user: user)
      expect {
        post "/api/v1/service_requests",
             params: { kind: "inquiry", subject: "納期", body: "いつ届きますか", order_id: order.id },
             headers: auth_headers(user), as: :json
      }.to change(user.service_requests, :count).by(1)
      expect(response).to have_http_status(:created)
      expect(response.parsed_body).to include("kind" => "inquiry", "status" => "pending", "order_id" => order.id)
    end

    it "他人の注文は指定できない" do
      post "/api/v1/service_requests",
           params: { kind: "inquiry", subject: "納期", body: "?", order_id: create(:order).id },
           headers: auth_headers(user), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "クライアントが status を送っても pending から開始する" do
      post "/api/v1/service_requests",
           params: { kind: "custom", subject: "名入れ", body: "刻印してほしい", status: "completed" },
           headers: auth_headers(user), as: :json
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["status"]).to eq("pending")
    end
  end

  describe "GET /api/v1/service_requests" do
    it "自分の依頼のみ返す / kind で絞り込める" do
      create(:service_request, user: user)
      create(:service_request, :custom, user: user)
      create(:service_request, user: create(:user)) # 他人の依頼

      get "/api/v1/service_requests", headers: auth_headers(user)
      expect(response.parsed_body.size).to eq(2)

      get "/api/v1/service_requests", params: { kind: "custom" }, headers: auth_headers(user)
      expect(response.parsed_body.size).to eq(1)
      expect(response.parsed_body.first["kind"]).to eq("custom")
    end
  end

  describe "PATCH /api/v1/admin/service_requests/:id" do
    let(:admin) { create(:user, :admin) }
    let(:req) { create(:service_request, user: user) }

    it "管理者は回答でき、問い合わせは回答済みになる。顧客は回答を見られる" do
      patch "/api/v1/admin/service_requests/#{req.id}",
            params: { reply: "来週水曜に発送予定です" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("status" => "answered", "reply" => "来週水曜に発送予定です")

      get "/api/v1/service_requests/#{req.id}", headers: auth_headers(user)
      expect(response.parsed_body["reply"]).to eq("来週水曜に発送予定です")
    end

    it "kind に存在しないステータスは 422" do
      patch "/api/v1/admin/service_requests/#{req.id}",
            params: { status: "in_progress" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "一般会員・制作スタッフは 403" do
      [user, create(:user, :staff)].each do |u|
        patch "/api/v1/admin/service_requests/#{req.id}",
              params: { status: "closed" }, headers: auth_headers(u), as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
