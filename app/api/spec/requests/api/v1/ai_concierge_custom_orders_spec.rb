require "rails_helper"

# AIコンシェルジュで内容をまとめ、提示した下書きでオーダーメイドを依頼する
RSpec.describe "AIコンシェルジュのオーダーメイド依頼", type: :request do
  let(:member) { create(:user) }
  let(:claude) { instance_double(ClaudeConcierge) }
  let(:draft_input) do
    { "title" => "スマホスタンド 2個", "summary" => "木目調のスマホスタンドを2個", "item" => "スマホスタンド",
      "preferred_date" => (Date.current + 30).iso8601, "budget_yen" => 5000 }
  end

  def body
    response.parsed_body
  end

  # Claude の代わりに、渡されたツールで下書きを作る (propose: false なら作らない)
  def stub_claude(propose: true, input: draft_input)
    allow(ClaudeConcierge).to receive(:new) do |**kw|
      allow(claude).to receive(:reply) do
        kw[:tools].call("propose_custom_order", input) if propose
        "まとめました。この内容でオーダーしますか？\n[CTA: open_custom_request]"
      end
      claude
    end
  end

  def start(headers: {})
    post "/api/v1/ai_concierge/conversations", headers: headers, as: :json
    body
  end

  def say(convo, content, headers: {})
    post "/api/v1/ai_concierge/conversations/#{convo['id']}/messages",
         params: { content: content, guest_token: convo["guest_token"] }, headers: headers, as: :json
    expect(response).to have_http_status(:created)
    body
  end

  def order(convo, message, headers:, guest_token: nil)
    post "/api/v1/ai_concierge/conversations/#{convo['id']}/custom_orders",
         params: { message_id: message["id"], guest_token: guest_token }.compact, headers: headers, as: :json
  end

  before do
    Api::V1::AiConcierge::BaseController::RATE_LIMIT_STORE.clear
    allow(ClaudeConcierge).to receive(:enabled?).and_return(true)
    create(:category, :custom)
    stub_claude
  end

  it "下書きを提示した応答に依頼書と確認の CTA を付け、「はい」で依頼書を本文にした依頼を作る" do
    headers = auth_headers(member)
    convo = start(headers: headers)
    message = say(convo, "木のスマホスタンドを2個作ってほしい", headers: headers)

    expect(message["cta"]).to eq("confirm_custom_order") # LLM の CTA より優先する
    expect(message["order_draft"]).to include("title" => "スマホスタンド 2個", "service_request_id" => nil)
    expect(message["order_draft"]["markdown"]).to start_with("# 制作依頼書: スマホスタンド 2個")

    # 次の発話では、提示した依頼書を会話に添えて Claude に渡す
    say(convo, "数量を3個にしたい", headers: headers)
    expect(claude).to have_received(:reply).with(
      messages: include(hash_including(role: "assistant", content: include("[提示したオーダー内容の下書き]\n# 制作依頼書"))),
      context: anything
    )
    latest = AiMessage.where.not(order_draft: nil).order(:id).last

    order(convo, { "id" => latest.id }, headers: headers)
    expect(response).to have_http_status(:created)
    expect(body["message"]).to include("role" => "assistant", "cta" => "view_requests")
    expect(body["message"]["content"]).to include("##{body.dig('service_request', 'id')}")

    req = ServiceRequest.find(body.dig("service_request", "id"))
    expect(req).to have_attributes(user: member, kind: "custom", status: "pending", subject: "スマホスタンド 2個",
                                   body: latest.order_draft["markdown"], budget_cents: 5000, ai_message: latest)
    expect(req.preferred_at.to_date).to eq(Date.current + 30)

    # 依頼の一覧には AIコンシェルジュ経由と出る。会話の履歴の下書きには依頼の番号が入る
    get "/api/v1/service_requests", headers: headers
    expect(body.first).to include("id" => req.id, "from_concierge" => true)
    get "/api/v1/ai_concierge/conversations/#{convo['id']}", headers: headers
    expect(body["messages"].filter_map { |m| m["order_draft"]&.dig("service_request_id") }).to eq([req.id])
    expect(body["messages"].last(2).map { |m| m["role"] }).to eq(%w[user assistant])
  end

  it "二重の依頼・修正前の下書き・受付の休止中は 422" do
    headers = auth_headers(member)
    convo = start(headers: headers)
    first = say(convo, "スタンドを作って", headers: headers)
    second = say(convo, "数量を3個に", headers: headers)

    order(convo, first, headers: headers)
    expect(response).to have_http_status(:unprocessable_content)
    expect(body.dig("error", "code")).to eq("draft_outdated")

    Category.find_by(slug: "custom").update!(active: false)
    order(convo, second, headers: headers)
    expect(body.dig("error", "code")).to eq("custom_orders_paused")
    Category.find_by(slug: "custom").update!(active: true)

    order(convo, second, headers: headers)
    expect(response).to have_http_status(:created)
    order(convo, second, headers: headers)
    expect(response).to have_http_status(:unprocessable_content)
    expect(body.dig("error", "code")).to eq("already_ordered")
    expect(ServiceRequest.count).to eq(1)
  end

  it "下書きのない応答・ほかの会員の会話では依頼できない" do
    headers = auth_headers(member)
    convo = start(headers: headers)
    stub_claude(propose: false)
    plain = say(convo, "こんにちは", headers: headers)
    expect(plain).to include("cta" => "open_custom_request", "order_draft" => nil)

    order(convo, plain, headers: headers)
    expect(response).to have_http_status(:not_found)

    stub_claude
    drafted = say(convo, "スタンドを作って", headers: headers)
    order(convo, drafted, headers: auth_headers(create(:user)))
    expect(response).to have_http_status(:not_found)
    expect(ServiceRequest.count).to eq(0)
  end

  it "ゲストはログインを求められ、ログイン後に guest_token で会話を引き継いで依頼できる" do
    convo = start
    drafted = say(convo, "スタンドを作って")
    expect(drafted["cta"]).to eq("confirm_custom_order")

    order(convo, drafted, headers: {}, guest_token: convo["guest_token"])
    expect(response).to have_http_status(:unauthorized)

    # トークンがなければ、ゲストの会話は見つからない
    order(convo, drafted, headers: auth_headers(member))
    expect(response).to have_http_status(:not_found)

    order(convo, drafted, headers: auth_headers(member), guest_token: convo["guest_token"])
    expect(response).to have_http_status(:created)
    expect(AiConversation.find(convo["id"]).user).to eq(member)
    expect(member.service_requests.count).to eq(1)

    # 引き継いだあとは本人の会話として使え、ゲストのトークンでは使えない
    get "/api/v1/ai_concierge/conversations/#{convo['id']}", headers: auth_headers(member)
    expect(response).to have_http_status(:ok)
    get "/api/v1/ai_concierge/conversations/#{convo['id']}", params: { guest_token: convo["guest_token"] }
    expect(response).to have_http_status(:not_found)
  end
end
