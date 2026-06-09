require "rails_helper"

RSpec.describe "Api::V1::ServiceRequests", type: :request do
  let(:user) { create(:user) }

  describe "POST /api/v1/service_requests" do
    it "未ログインは 401" do
      post "/api/v1/service_requests", params: { kind: "maintenance", body: "x", preferred_at: 1.day.from_now }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "整備予約を作成できる" do
      expect {
        post "/api/v1/service_requests",
             params: { kind: "maintenance", vehicle: "CB400", body: "点検", preferred_at: 2.days.from_now },
             headers: auth_headers(user), as: :json
      }.to change(user.service_requests, :count).by(1)
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["kind"]).to eq("maintenance")
      expect(response.parsed_body["status"]).to eq("pending")
    end

    it "整備予約で preferred_at が無いと 422" do
      post "/api/v1/service_requests",
           params: { kind: "maintenance", body: "点検" },
           headers: auth_headers(user), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "クライアントが status を送っても pending から開始する" do
      post "/api/v1/service_requests",
           params: { kind: "system", body: "取付", status: "completed" },
           headers: auth_headers(user), as: :json
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["status"]).to eq("pending")
    end
  end

  describe "GET /api/v1/service_requests" do
    it "自分の依頼のみ返す / kind で絞り込める" do
      create(:service_request, user: user)
      create(:service_request, :system, user: user)
      create(:service_request, user: create(:user)) # 他人の依頼

      get "/api/v1/service_requests", headers: auth_headers(user), as: :json
      expect(response.parsed_body.size).to eq(2)

      get "/api/v1/service_requests", params: { kind: "system" }, headers: auth_headers(user), as: :json
      expect(response.parsed_body.size).to eq(1)
      expect(response.parsed_body.first["kind"]).to eq("system")
    end
  end

  describe "PATCH /api/v1/admin/service_requests/:id" do
    let(:admin) { create(:user, :admin) }
    let(:req) { create(:service_request, user: user) }

    it "管理者はステータスを更新できる" do
      patch "/api/v1/admin/service_requests/#{req.id}",
            params: { status: "confirmed" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:ok)
      expect(req.reload.status).to eq("confirmed")
    end

    it "kind に存在しないステータスは 422" do
      patch "/api/v1/admin/service_requests/#{req.id}",
            params: { status: "in_progress" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "一般会員は 403" do
      patch "/api/v1/admin/service_requests/#{req.id}",
            params: { status: "confirmed" }, headers: auth_headers(user), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
