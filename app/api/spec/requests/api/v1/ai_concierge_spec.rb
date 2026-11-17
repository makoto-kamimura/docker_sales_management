require "rails_helper"

RSpec.describe "AIコンシェルジュ", type: :request do
  let(:member) { create(:user, name: "山田花子") }
  let(:claude) { instance_double(ClaudeConcierge) }

  def body
    response.parsed_body
  end

  def start_conversation(headers: {})
    post "/api/v1/ai_concierge/conversations", headers: headers, as: :json
    expect(response).to have_http_status(:created)
    body
  end

  before do
    Api::V1::AiConcierge::BaseController::RATE_LIMIT_STORE.clear
    allow(ClaudeConcierge).to receive(:enabled?).and_return(true)
    allow(ClaudeConcierge).to receive(:new).and_return(claude)
    allow(claude).to receive(:reply).and_return("こんにちは。")
  end

  describe "Claude の API キーが未設定のとき" do
    before { allow(ClaudeConcierge).to receive(:enabled?).and_return(false) }

    it "settings は無効を返し、会話は 503 になる" do
      get "/api/v1/ai_concierge/settings"
      expect(body).to include("enabled" => false)

      post "/api/v1/ai_concierge/conversations", as: :json
      expect(response).to have_http_status(:service_unavailable)
      expect(body.dig("error", "code")).to eq("ai_unavailable")
      expect(AiConversation.count).to eq(0)
    end
  end

  it "settings は有効と文字数の上限を返す" do
    get "/api/v1/ai_concierge/settings"
    expect(body).to eq("enabled" => true, "max_content_length" => 1_000)
  end

  describe "会員" do
    it "カートと直近の注文を文脈として渡し、これまでの会話を続けて送る" do
      product = create(:product, sku: "3DP-001", name: "スマホスタンド")
      post "/api/v1/cart/items", params: { product_id: product.id, quantity: 2 }, headers: auth_headers(member), as: :json
      order = create(:order, user: member, status: "in_production")
      allow(claude).to receive(:reply).and_return("いま制作中の工程です。\n[CTA: view_order:#{order.id}]")

      convo = start_conversation(headers: auth_headers(member))
      expect(convo["guest_token"]).to be_nil

      post "/api/v1/ai_concierge/conversations/#{convo['id']}/messages",
           params: { content: " 注文はどうなっていますか " }, headers: auth_headers(member), as: :json
      expect(response).to have_http_status(:created)
      expect(body).to include("role" => "assistant", "content" => "いま制作中の工程です。", "cta" => "view_order:#{order.id}")

      expect(claude).to have_received(:reply) do |messages:, context:|
        expect(messages).to eq([{ role: "user", content: "注文はどうなっていますか" }])
        expect(context).to include("会員名: 山田花子", "\"sku\":\"3DP-001\"", "\"qty\":2", "\"id\":#{order.id}", "制作中")
      end

      # 2 回目は、それまでの会話 (CTA を含む) を続けて送る
      post "/api/v1/ai_concierge/conversations/#{convo['id']}/messages",
           params: { content: "ありがとう" }, headers: auth_headers(member), as: :json
      expect(claude).to have_received(:reply).with(
        messages: [
          { role: "user", content: "注文はどうなっていますか" },
          { role: "assistant", content: "いま制作中の工程です。\n[CTA: view_order:#{order.id}]" },
          { role: "user", content: "ありがとう" }
        ],
        context: anything
      )

      get "/api/v1/ai_concierge/conversations/#{convo['id']}", headers: auth_headers(member)
      expect(body["messages"].map { |m| m["role"] }).to eq(%w[user assistant user assistant])
    end

    it "ほかの会員の会話は使えない" do
      convo = start_conversation(headers: auth_headers(member))
      other = auth_headers(create(:user))

      get "/api/v1/ai_concierge/conversations/#{convo['id']}", headers: other
      expect(response).to have_http_status(:not_found)
      post "/api/v1/ai_concierge/conversations/#{convo['id']}/messages", params: { content: "見せて" }, headers: other, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "期限切れのトークンはゲスト扱いにせず 401 を返す" do
      post "/api/v1/ai_concierge/conversations", headers: { "Authorization" => "Bearer expired" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "ゲスト" do
    it "作成時に受け取った guest_token を持つ人だけが会話を使える" do
      convo = start_conversation
      other = start_conversation
      expect(convo["guest_token"]).to be_present

      post "/api/v1/ai_concierge/conversations/#{convo['id']}/messages",
           params: { content: "送料は？", guest_token: convo["guest_token"] }, as: :json
      expect(response).to have_http_status(:created)
      expect(claude).to have_received(:reply).with(messages: [{ role: "user", content: "送料は？" }], context: include("会員名: ゲスト"))

      get "/api/v1/ai_concierge/conversations/#{convo['id']}", params: { guest_token: convo["guest_token"] }
      expect(body["messages"].size).to eq(2)

      # トークンなし・別の会話のトークン・会員の会話では使えない
      get "/api/v1/ai_concierge/conversations/#{convo['id']}"
      expect(response).to have_http_status(:not_found)
      get "/api/v1/ai_concierge/conversations/#{convo['id']}", params: { guest_token: other["guest_token"] }
      expect(response).to have_http_status(:not_found)
      post "/api/v1/ai_concierge/conversations/#{convo['id']}/messages", params: { content: "見せて" }, as: :json
      expect(response).to have_http_status(:not_found)

      mine = start_conversation(headers: auth_headers(member))
      get "/api/v1/ai_concierge/conversations/#{mine['id']}", params: { guest_token: convo["guest_token"] }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "発話の検証と失敗" do
    let(:convo) { start_conversation(headers: auth_headers(member)) }

    def say(content)
      post "/api/v1/ai_concierge/conversations/#{convo['id']}/messages", params: { content: content }, headers: auth_headers(member), as: :json
    end

    it "空の発話と長すぎる発話は Claude に送らない" do
      say("  ")
      expect(response).to have_http_status(:bad_request)
      say("あ" * 1_001)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(claude).not_to have_received(:reply)
    end

    it "Claude に届かなければ 502 を返し、発話を履歴に残さない" do
      allow(claude).to receive(:reply).and_raise(ClaudeConcierge::Error, "Claude に接続できません")
      say("こんにちは")
      expect(response).to have_http_status(:bad_gateway)
      expect(body.dig("error", "code")).to eq("ai_unavailable")
      expect(AiMessage.count).to eq(0)
    end

    it "短い時間に送りすぎると 429 を返す" do
      30.times { say("こんにちは") }
      expect(response).to have_http_status(:created)
      say("こんにちは")
      expect(response).to have_http_status(:too_many_requests)
      expect(body.dig("error", "code")).to eq("rate_limited")
    end
  end
end
