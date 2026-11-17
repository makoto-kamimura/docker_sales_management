require "anthropic"

# AIコンシェルジュの応答を Claude (Anthropic の Messages API) で作る。
# ANTHROPIC_API_KEY が空なら無効 (画面はチャットを出さず、API は 503)。
#
# - 店舗の決まり (system_prompt.md) と FAQ (faq.md) は毎回同じ文面にして、プロンプトキャッシュに載せる。
#   店頭の状態・会員の文脈は、その後ろの system に置く (こちらは毎回変わる)。
# - 商品は ConciergeTools で DB から引く (ナレッジの手作業の更新は要らない)。
# - 1 回の発話で、ツールの往復は MAX_TOOL_ROUNDS まで。応答の思考ブロックなどは、往復のあいだ手を加えずに送り返す。
class ClaudeConcierge
  class Error < StandardError; end

  DEFAULT_MODEL = "claude-opus-5-5"
  # サーバー側のフォールバック (安全の判定で断られたとき、別のモデルで答え直す) に対応しているモデル
  FALLBACK_MODELS = %w[claude-opus-5-5 claude-sonnet-5-5 claude-fable-5-2 claude-fable-5-1 claude-opus-5].freeze
  FALLBACK_BETA = :"server-side-fallback-2026-07-01"
  MAX_TOKENS = 16_000
  MAX_TOOL_ROUNDS = 4
  REQUEST_TIMEOUT = 60 # 秒。1 回のリクエストあたり
  EFFORT = :low # 接客のチャットは短い応答でよい

  PROMPT_DIR = Rails.root.join("config/ai_concierge")
  # 店舗の決まりと FAQ。起動時に 1 回だけ読み、バイト列を変えない (キャッシュが効くように)
  STATIC_PROMPT = [
    PROMPT_DIR.join("system_prompt.md").read,
    "# よくある質問（FAQ）\n\n#{PROMPT_DIR.join('faq.md').read}"
  ].join("\n\n").freeze

  REFUSAL_TEXT = "申し訳ありません。このご質問にはお答えできません。お手数ですが、お問い合わせ画面から店舗へご連絡ください。\n[CTA: open_contact]".freeze

  def self.api_key
    ENV["ANTHROPIC_API_KEY"].to_s.strip
  end

  def self.enabled?
    api_key.present?
  end

  def self.model
    ENV["ANTHROPIC_MODEL"].presence || DEFAULT_MODEL
  end

  def initialize(client: nil, tools: ConciergeTools.new, model: self.class.model)
    @client = client
    @tools = tools
    @model = model
  end

  # messages: これまでの会話 ([{ role: "user"/"assistant", content: "..." }]。最後は今回の発話)
  # context: 店頭の状態と会員の文脈 (毎回変わる system)
  # 戻り値: 応答の本文 (末尾に [CTA: ...] が付くことがある)
  def reply(messages:, context:)
    conversation = messages.map { |m| { role: m[:role].to_sym, content: m[:content].to_s } }
    rounds = 0

    loop do
      last_round = rounds >= MAX_TOOL_ROUNDS
      response = client.beta.messages.create(**request(conversation, context, last_round: last_round))

      case response.stop_reason
      when :refusal
        Rails.logger.warn("Claude refused (#{response.stop_details&.category.inspect})")
        return REFUSAL_TEXT
      when :tool_use
        raise Error, "ツールの呼び出しが多すぎます" if last_round

        rounds += 1
        conversation << { role: :assistant, content: replayable(response.content) }
        conversation << { role: :user, content: tool_results(response.content) }
      else
        text = response.content.select { |b| b.type == :text }.map(&:text).join.strip
        raise Error, "Claude の応答が空です (stop_reason: #{response.stop_reason})" if text.empty?

        return text
      end
    end
  rescue Anthropic::Errors::APIConnectionError => e
    raise Error, "Claude に接続できません (#{e.class.name.demodulize}): #{e.message}"
  rescue Anthropic::Errors::APIStatusError => e
    raise Error, "Claude API error #{e.status}: #{e.type} #{e.message.to_s[0, 300]}"
  end

  # 接続確認 (rails ai:check)。モデルの情報を取るだけで、料金はかからない
  def check
    client.models.retrieve(@model)
  rescue Anthropic::Errors::APIConnectionError => e
    raise Error, "Claude に接続できません (#{e.class.name.demodulize}): #{e.message}"
  rescue Anthropic::Errors::APIStatusError => e
    raise Error, "Claude API error #{e.status}: #{e.type} #{e.message.to_s[0, 300]}"
  end

  def fallback_enabled?
    FALLBACK_MODELS.include?(@model)
  end

  private

  def client
    @client ||= Anthropic::Client.new(api_key: self.class.api_key, max_retries: 1, timeout: REQUEST_TIMEOUT)
  end

  def request(conversation, context, last_round:)
    params = {
      model: @model,
      max_tokens: MAX_TOKENS,
      output_config: { effort: EFFORT },
      system_: [
        { type: "text", text: STATIC_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: context }
      ],
      tools: ConciergeTools::DEFINITIONS,
      messages: conversation
    }
    # 往復の上限に来たら、ツールを使わずに答えさせる (ツールの定義は外さない。外すとキャッシュが切れる)
    params[:tool_choice] = { type: "none" } if last_round
    if fallback_enabled?
      params[:betas] = [FALLBACK_BETA]
      params[:fallbacks] = :default
    end
    params
  end

  # 応答をそのまま会話に積む。tool_use だけは、SDK が足す項目を除いた形に直す
  def replayable(content)
    content.map do |block|
      next block unless block.type == :tool_use

      { type: "tool_use", id: block.id, name: block.name, input: block.input }
    end
  end

  def tool_results(content)
    content.select { |b| b.type == :tool_use }.map do |block|
      result = { type: "tool_result", tool_use_id: block.id }
      begin
        result.merge(content: @tools.call(block.name, block.input))
      rescue ConciergeTools::InvalidInput => e
        result.merge(content: e.message, is_error: true)
      rescue StandardError => e
        Rails.logger.error("Concierge tool #{block.name} failed: #{e.class}: #{e.message}")
        result.merge(content: "ツールの実行に失敗しました", is_error: true)
      end
    end
  end
end
