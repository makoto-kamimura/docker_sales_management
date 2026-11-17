# AIコンシェルジュの 1 往復 (発話 → Claude → 応答の保存)。
# これまでの会話と、店頭の状態・会員の文脈 (カート・直近の注文) を組み立てて渡し、応答の末尾の [CTA: action] を切り出す。
# オーダーメイドの下書き (ツール propose_custom_order) が作られたら、応答に保存して確認の CTA を付ける。
class ConciergeChat
  MAX_CONTENT_LENGTH = 1_000
  # Claude に渡す、これまでの会話の件数 (発話と応答を合わせて)
  HISTORY_LIMIT = 20
  MAX_CART_ITEMS = 20

  # 画面がボタンにできる CTA。ここにないものは捨てる (LLM が作った文字列を画面に出さない)
  CTA_ACTIONS = %w[
    view_product view_order open_custom_request open_contact view_requests open_subscription_settings human_handoff
  ].freeze
  CTA_PATTERN = /\[CTA:\s*([^\]\n]+)\]/i
  # オーダーメイドの下書きの確認 (「はい、オーダーする」「修正する」)。API だけが付ける (LLM の CTA からは作らない)
  CONFIRM_ORDER_CTA = "confirm_custom_order".freeze

  def initialize(conversation, user: nil, tools: ConciergeTools.new, concierge: nil)
    @conversation = conversation
    @user = user
    @tools = tools
    @concierge = concierge || ClaudeConcierge.new(tools: @tools)
  end

  # 応答 (AiMessage) を返す。Claude から応答を受け取れなければ ClaudeConcierge::Error を上げ、発話は履歴に残さない
  def reply(content)
    answer = @concierge.reply(messages: history + [{ role: "user", content: content }], context: context)
    text, cta = self.class.extract_cta(answer, user: @user)
    draft = @tools.order_draft
    cta = CONFIRM_ORDER_CTA if draft

    AiMessage.transaction do
      @conversation.messages.create!(role: "user", content: content)
      @conversation.messages.create!(role: "assistant", content: text, cta: cta, order_draft: draft&.to_h)
    end
  end

  # 本文と CTA に分ける。CTA は最後の 1 つだけを使い、本文からはすべて取り除く
  def self.extract_cta(answer, user: nil)
    raw = answer.to_s.scan(CTA_PATTERN).flatten.last
    text = answer.to_s.gsub(CTA_PATTERN, "").gsub(/[ \t]+$/, "").gsub(/\n{3,}/, "\n\n").strip
    text = "ご案内します。" if text.empty? # CTA だけが返ったとき
    [text, normalize_cta(raw, user: user)]
  end

  def self.normalize_cta(raw, user: nil)
    action, arg = raw.to_s.strip.split(":", 2).map { |s| s.to_s.strip }
    return nil unless CTA_ACTIONS.include?(action)

    case action
    when "view_order"
      # 注文へのリンクは、本人の注文のときだけ出す
      order = user && arg.to_s.match?(/\A\d+\z/) && user.orders.find_by(id: arg)
      order ? "view_order:#{order.id}" : nil
    when "view_product"
      # 商品へのリンクは、店頭に並んでいる商品のときだけ出す
      product = arg.to_s.match?(/\A\d+\z/) && Product.on_sale.find_by(id: arg)
      product ? "view_product:#{product.id}" : nil
    when "open_custom_request"
      Storefront.custom_orders? ? action : nil
    when "view_requests", "open_subscription_settings"
      user ? action : nil # ログインが要る画面
    else
      action
    end
  end

  private

  # これまでの会話 (古いものから)。応答の CTA は本文の末尾に戻して渡す (Claude が自分の出した形を見られるように)。
  # 下書きを提示した応答には、CTA の代わりに依頼書を添える (修正の求めに、提示した内容をもとに答えられるように)
  def history
    rows = @conversation.messages.where(role: %w[user assistant]).order(id: :desc).limit(HISTORY_LIMIT).to_a.reverse
    rows.shift while rows.first&.role == "assistant" # 会話は発話から始める
    rows.map { |m| { role: m.role, content: history_content(m) } }
  end

  def history_content(m)
    return m.content unless m.role == "assistant"
    return "#{m.content}\n\n[提示したオーダー内容の下書き]\n#{m.order_draft['markdown']}" if m.order_draft.present?
    return "#{m.content}\n[CTA: #{m.cta}]" if m.cta.present?

    m.content
  end

  # 毎回変わる文脈。店頭の状態と、会員の情報 (ゲストなら会員名だけ)
  def context
    <<~TEXT
      # 店舗の現在の状態
      販売中のカテゴリ: #{Storefront.categories.map { |c| "#{c.name} (#{c.slug})" }.join(' / ').presence || 'なし'}
      オーダーメイドの依頼: #{Storefront.custom_orders? ? '受付中' : '休止中'}
      定期便（サブスク）: #{Storefront.subscriptions? ? '申し込める商品あり' : '申し込める商品なし'}
      支払い方法: #{StripeService.enabled? ? 'クレジットカード、銀行振込など' : '銀行振込など（カード払いは現在使えない）'}
      送料: 物販品を含む注文は#{Pricing::SHIPPING_FLAT_CENTS}円、小計#{Pricing::FREE_SHIPPING_THRESHOLD_CENTS.to_fs(:delimited)}円以上で無料。ダウンロード販売の商品だけの注文は送料なし。

      # お客様
      #{customer_context}
    TEXT
  end

  def customer_context
    return "会員名: ゲスト（未ログイン）" unless @user

    cart_items = (@user.cart&.items&.includes(:product)&.first(MAX_CART_ITEMS) || []).map { |i|
      { product_id: i.product.id, sku: i.product.sku, name: i.product.name, qty: i.quantity }
    }
    recent_orders = @user.orders.recent.limit(3).map { |o|
      { id: o.id, status_label: o.status_label, total_yen: o.total_cents, placed_at: o.placed_at&.to_date&.iso8601 }
    }
    <<~TEXT.strip
      会員名: #{@user.name}
      カート（JSON）: #{cart_items.to_json}
      直近の注文（JSON。status_label が現在の工程）: #{recent_orders.to_json}
    TEXT
  end
end
