require "rails_helper"

RSpec.describe ClaudeConcierge do
  # Messages API の応答を順に返す偽のクライアント (client.beta.messages.create)
  class FakeClaude
    Block = Struct.new(:type, :text, :id, :name, :input, keyword_init: true)
    Response = Struct.new(:stop_reason, :content, :stop_details, keyword_init: true)

    attr_reader :requests

    def initialize(*responses)
      @responses = responses
      @requests = []
    end

    def beta = self
    def messages = self

    def create(**params)
      @requests << Marshal.load(Marshal.dump(params.except(:messages))).merge(messages: params[:messages].dup)
      @responses.shift || raise("no more responses")
    end

    def self.text(text, stop: :end_turn) = Response.new(stop_reason: stop, content: [Block.new(type: :text, text: text)])

    def self.tool(name, input, id: "tu_1")
      Response.new(stop_reason: :tool_use, content: [
        Block.new(type: :thinking, text: nil),
        Block.new(type: :tool_use, id: id, name: name, input: input)
      ])
    end
  end

  let(:tools) { ConciergeTools.new }
  let(:history) { [{ role: "user", content: "スタンドはありますか" }] }

  def concierge(client, model: "claude-opus-5-5")
    described_class.new(client: client, tools: tools, model: model)
  end

  it "店舗の決まりをキャッシュに載せ、文脈を後ろに置き、フォールバックを付けて呼ぶ" do
    client = FakeClaude.new(FakeClaude.text("ございます。"))
    expect(concierge(client).reply(messages: history, context: "店舗の状態")).to eq("ございます。")

    req = client.requests.first
    expect(req).to include(model: "claude-opus-5-5", output_config: { effort: :low },
                           betas: [described_class::FALLBACK_BETA], fallbacks: :default)
    expect(req[:system_].first).to include(text: described_class::STATIC_PROMPT, cache_control: { type: "ephemeral" })
    expect(req[:system_].last).to eq(type: "text", text: "店舗の状態")
    expect(req[:tools].map { |t| t[:name] }).to eq(%w[search_products get_product])
    expect(req[:messages]).to eq([{ role: :user, content: "スタンドはありますか" }])
    expect(req).not_to have_key(:tool_choice)
    expect(req).not_to have_key(:thinking) # Opus 5.5 は常に adaptive。指定しない
  end

  it "フォールバックに対応しないモデルでは付けない" do
    client = FakeClaude.new(FakeClaude.text("はい。"))
    concierge(client, model: "claude-haiku-5-5").reply(messages: history, context: "")
    expect(client.requests.first).not_to include(:betas, :fallbacks)
  end

  it "ツールを実行して結果を返し、応答のブロックはそのまま送り返す" do
    product = create(:product, :digital, name: "折りたたみスマホスタンド", price_cents: 600)
    client = FakeClaude.new(
      FakeClaude.tool("search_products", { "query" => "スタンド", "category_slug" => "" }),
      FakeClaude.text("・折りたたみスマホスタンド 600円\n[CTA: view_product:#{product.id}]")
    )

    answer = concierge(client).reply(messages: history, context: "")
    expect(answer).to include("[CTA: view_product:#{product.id}]")

    second = client.requests.last[:messages]
    expect(second.size).to eq(3)
    assistant = second[1]
    expect(assistant[:role]).to eq(:assistant)
    expect(assistant[:content].first.type).to eq(:thinking) # 思考ブロックは手を加えずに返す
    expect(assistant[:content].last).to eq(type: "tool_use", id: "tu_1", name: "search_products",
                                           input: { "query" => "スタンド", "category_slug" => "" })
    result = second[2][:content].first
    expect(result).to include(type: "tool_result", tool_use_id: "tu_1")
    expect(JSON.parse(result[:content])["products"].map { |p| p["id"] }).to eq([product.id])
  end

  it "ツールの入力がおかしければ is_error で返して続ける" do
    client = FakeClaude.new(FakeClaude.tool("get_product", { "product_id" => "abc" }), FakeClaude.text("見つかりませんでした。"))
    concierge(client).reply(messages: history, context: "")
    expect(client.requests.last[:messages].last[:content].first).to include(is_error: true)
  end

  it "ツールの往復が上限に来たら、ツールを使わずに答えさせる" do
    rounds = Array.new(described_class::MAX_TOOL_ROUNDS) { |i| FakeClaude.tool("search_products", { "query" => "a" }, id: "tu_#{i}") }
    client = FakeClaude.new(*rounds, FakeClaude.text("候補が見つかりませんでした。"))
    expect(concierge(client).reply(messages: history, context: "")).to eq("候補が見つかりませんでした。")
    expect(client.requests.last[:tool_choice]).to eq(type: "none")
    expect(client.requests.last[:tools]).to eq(ConciergeTools::DEFINITIONS) # 定義は外さない
  end

  it "断られたら、問い合わせを案内する定型文を返す" do
    client = FakeClaude.new(FakeClaude::Response.new(stop_reason: :refusal, content: [], stop_details: nil))
    expect(concierge(client).reply(messages: history, context: "")).to eq(described_class::REFUSAL_TEXT)
  end

  it "空の応答は Error にする" do
    client = FakeClaude.new(FakeClaude.text("  "))
    expect { concierge(client).reply(messages: history, context: "") }.to raise_error(described_class::Error, /空/)
  end

  it "ANTHROPIC_API_KEY が空なら無効" do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("ANTHROPIC_API_KEY").and_return(" ")
    expect(described_class.enabled?).to be(false)
    allow(ENV).to receive(:[]).with("ANTHROPIC_API_KEY").and_return("sk-ant-xxx")
    expect(described_class.enabled?).to be(true)
  end
end
