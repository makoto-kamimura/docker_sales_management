# AIコンシェルジュが聞き取ったオーダーメイドの内容 (ツール propose_custom_order の入力) を検証・整形し、
# 制作依頼書の Markdown を組み立てる。
#
# - 提示した下書き (to_h) を応答のメッセージに保存し、お客様が「はい」と答えたら、その Markdown をそのまま依頼の本文にする
#   (確認した内容と送られる内容を同じにするため、確定時に作り直さない)。
# - Markdown は、別の AI にそのまま渡せるように、見出しと「- 項目: 値」だけの決まった形にする。空の項目も「未定」と書く。
#   氏名・メール・電話などの個人情報は入れない (依頼のレコードの列にある)。
class CustomOrderDraft
  FORMAT = "craftflow-custom-order/1".freeze
  TIME_ZONE = "Asia/Tokyo".freeze

  TITLE_LIMIT = 60
  SUMMARY_LIMIT = 400
  FIELD_LIMIT = 200
  LIST_LIMIT = 8
  REFERENCE_LIMIT = 3
  BUDGET_MAX_YEN = 10_000_000

  # 仕様の項目 (入力のキー => 依頼書の見出し)。この順で依頼書に並べる
  SPEC_FIELDS = {
    "item" => "作るもの",
    "purpose" => "用途",
    "quantity" => "数量",
    "size" => "サイズ",
    "material" => "素材",
    "color_finish" => "色・仕上げ",
    "other_requirements" => "その他の条件"
  }.freeze

  UNDECIDED = "未定".freeze
  UNSPECIFIED = "指定なし".freeze

  # ツールの定義 (ConciergeTools::DEFINITIONS に入れる)
  TOOL_DEFINITION = {
    name: "propose_custom_order",
    description: "オーダーメイド制作の依頼内容をまとめて、お客様に確認してもらう下書きを作る。" \
                 "作るもの・用途・サイズ・素材などの主な点を聞き取れたときに使う。お客様が内容の修正を求めたら、直した内容で呼び直す。" \
                 "わからない項目は空文字にし、店舗から確認すべき点は open_questions に入れる。お客様が言っていないことを作らない。",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "依頼の短い名前 (30文字程度。例: 木目調のスマホスタンド 2個)" },
        summary: { type: "string", description: "何をどう作ってほしいかの要約 (2〜3文)" },
        item: { type: "string", description: "作るもの" },
        purpose: { type: "string", description: "用途・使う場面" },
        quantity: { type: "string", description: "数量 (例: 2個)" },
        size: { type: "string", description: "サイズ・寸法 (例: 幅8cm × 奥行10cm × 高さ12cm)" },
        material: { type: "string", description: "素材 (例: PLA、木材)" },
        color_finish: { type: "string", description: "色・仕上げ" },
        other_requirements: { type: "string", description: "その他の条件・こだわり" },
        preferred_date: { type: "string", description: "希望納期 (YYYY-MM-DD)。なければ空文字" },
        budget_yen: { type: "integer", description: "予算の上限 (円)。なければ 0" },
        reference_product_ids: { type: "array", items: { type: "integer" }, description: "参考にする商品の id (search_products の結果のものだけ)。なければ空" },
        open_questions: { type: "array", items: { type: "string" }, description: "店舗から確認すべき、まだ決まっていない点" },
        customer_points: { type: "array", items: { type: "string" }, description: "お客様が会話で挙げた要望・こだわりの要点" }
      },
      required: %w[title summary]
    }
  }.freeze

  class InvalidInput < StandardError; end

  attr_reader :title, :summary, :spec, :preferred_date, :budget_yen, :reference_products,
              :open_questions, :customer_points, :created_at

  # ツールの入力から作る。足りない・不正な値は InvalidInput (Claude に返して直させる)
  def self.from_tool_input(input, now: Time.current)
    input = (input || {}).to_h.transform_keys(&:to_s)
    new(input, now: now)
  end

  def initialize(input, now:)
    @title = one_line(input["title"], TITLE_LIMIT)
    @summary = one_line(input["summary"], SUMMARY_LIMIT)
    raise InvalidInput, "title と summary を入れてください" if @title.empty? || @summary.empty?

    @spec = SPEC_FIELDS.keys.index_with { |key| one_line(input[key], FIELD_LIMIT) }
    @created_at = now.in_time_zone(TIME_ZONE)
    @preferred_date = parse_date(input["preferred_date"])
    @budget_yen = parse_budget(input["budget_yen"])
    @reference_products = find_products(input["reference_product_ids"])
    @open_questions = list(input["open_questions"])
    @customer_points = list(input["customer_points"])
  end

  # 応答のメッセージ (ai_messages.order_draft) に保存する形
  def to_h
    {
      "format" => FORMAT,
      "title" => title,
      "summary" => summary,
      "spec" => spec,
      "preferred_date" => preferred_date&.iso8601,
      "budget_yen" => budget_yen,
      "reference_products" => reference_products.map { |p| { "id" => p.id, "sku" => p.sku, "name" => p.name } },
      "open_questions" => open_questions,
      "customer_points" => customer_points,
      "created_at" => created_at.iso8601,
      "markdown" => markdown
    }
  end

  def markdown
    @markdown ||= <<~MD
      # 制作依頼書: #{escape(title)}

      - 書式: #{FORMAT}
      - 経路: AIコンシェルジュ
      - 作成日時: #{created_at.strftime('%Y-%m-%d %H:%M')} (JST)

      ## 概要
      #{escape(summary)}

      ## 仕様
      #{SPEC_FIELDS.map { |key, label| "- #{label}: #{escape(spec[key].presence || UNDECIDED)}" }.join("\n")}

      ## 希望条件
      - 希望納期: #{preferred_date&.iso8601 || UNSPECIFIED}
      - 予算: #{budget_yen ? "#{budget_yen.to_fs(:delimited)}円まで" : UNSPECIFIED}

      ## 参考商品
      #{bullets(reference_products.map { |p| "#{p.sku} #{p.name}（/products/#{p.id}）" }, empty: 'なし')}

      ## 未確定の点（店舗から確認すること）
      #{bullets(open_questions, empty: 'なし')}

      ## お客様の要望（会話から）
      #{bullets(customer_points, empty: 'なし')}
    MD
  end

  # 保存した下書き (to_h) から、依頼 (service_requests) の列を作る
  def self.request_attributes(draft)
    product_id = draft["reference_products"].to_a.first&.dig("id")
    {
      kind: "custom",
      status: "pending",
      subject: draft["title"].to_s,
      body: draft["markdown"].to_s,
      preferred_at: draft["preferred_date"].presence, # フォームと同じく日付の文字列で渡す
      budget_cents: draft["budget_yen"], # この店の金額の列は円で持つ
      product_id: product_id && Product.where(id: product_id).pick(:id)
    }
  end

  private

  def one_line(value, limit)
    value.to_s.gsub(/[[:space:]]+/, " ").strip[0, limit].to_s
  end

  def list(values)
    Array(values).map { |v| one_line(v, FIELD_LIMIT) }.reject(&:empty?).uniq.first(LIST_LIMIT)
  end

  # 希望納期は、明日以降の日付だけを受け取る
  def parse_date(value)
    date = Date.iso8601(value.to_s.strip)
    date > created_at.to_date ? date : nil
  rescue Date::Error
    nil
  end

  def parse_budget(value)
    yen = Integer(value.to_s.strip, 10)
    yen.between?(1, BUDGET_MAX_YEN) ? yen : nil
  rescue ArgumentError
    nil
  end

  # 参考商品は、店頭に並んでいる商品だけ (ツールの結果にない id は捨てる)
  def find_products(ids)
    ids = Array(ids).map(&:to_s).grep(/\A\d+\z/).map(&:to_i).uniq.first(REFERENCE_LIMIT)
    return [] if ids.empty?

    by_id = Product.on_sale.where(id: ids).index_by(&:id)
    ids.filter_map { |id| by_id[id] }
  end

  def bullets(items, empty:)
    items = [empty] if items.empty?
    items.map { |item| "- #{escape(item)}" }.join("\n")
  end

  # LLM の文字列で依頼書の形が崩れないように、行頭の記法と、リンク・HTML になる記号を無効にする
  def escape(text)
    text.to_s.gsub(/[\\<\[\]]/) { |c| "\\#{c}" }
        .sub(/\A[#>*+\-|`~=]/) { |c| "\\#{c}" }
        .sub(/\A(\d+)([.)])/) { "#{Regexp.last_match(1)}\\#{Regexp.last_match(2)}" }
  end
end
