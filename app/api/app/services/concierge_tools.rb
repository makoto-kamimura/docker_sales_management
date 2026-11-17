# AIコンシェルジュ (Claude) が使うツール。店頭に並んでいる商品 (Product.on_sale) だけを、DB から直接引く。
# ツールの定義は会話中に変えない (プロンプトキャッシュと、思考ブロックの引き継ぎのため)
class ConciergeTools
  SEARCH_LIMIT = 8
  DESCRIPTION_LIMIT = 1_500

  DEFINITIONS = [
    {
      name: "search_products",
      description: "店頭に並んでいる商品を、キーワードとカテゴリで探す。お客様が作品・データを探しているときや、" \
                   "おすすめを求められたときに使う。結果にない商品は存在しないものとして扱う。",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "探す言葉 (例: スマホスタンド、デスク、PETG)。カテゴリの一覧を見たいだけなら空文字" },
          category_slug: { type: "string", description: "カテゴリで絞るときのスラッグ (例: 3d-models)。絞らないなら空文字" }
        },
        required: %w[query]
      }
    },
    {
      name: "get_product",
      description: "商品 1 件の詳しい情報 (説明・ライセンス・データ形式・在庫) を返す。search_products で見つけた商品の id を渡す。",
      input_schema: {
        type: "object",
        properties: {
          product_id: { type: "integer", description: "商品の id" }
        },
        required: %w[product_id]
      }
    }
  ].freeze

  class InvalidInput < StandardError; end

  # 戻り値は tool_result の content に入れる文字列 (JSON)
  def call(name, input)
    input = (input || {}).to_h.transform_keys(&:to_s)
    case name
    when "search_products" then search_products(query: input["query"].to_s, category_slug: input["category_slug"].to_s)
    when "get_product" then get_product(input["product_id"])
    else raise InvalidInput, "不明なツールです: #{name}"
    end.to_json
  end

  private

  def search_products(query:, category_slug:)
    scope = Product.on_sale.includes(:category)
    scope = scope.by_category_slug(category_slug.strip) if category_slug.present?
    q = query.strip
    rows =
      if q.empty?
        scope.order(published_at: :desc).limit(SEARCH_LIMIT).to_a
      else
        # 全文検索 (trigram) で見つからなければ、名前・説明・タグの部分一致で拾う (日本語の短い語向け)
        hits = scope.keyword_search(q).limit(SEARCH_LIMIT).to_a
        hits.presence || scope.where("products.name ILIKE :q OR products.description ILIKE :q OR array_to_string(products.tags, ' ') ILIKE :q",
                                     q: "%#{Product.sanitize_sql_like(q)}%").limit(SEARCH_LIMIT).to_a
      end
    { count: rows.size, products: rows.map { |p| summary(p) } }
  end

  def get_product(id)
    raise InvalidInput, "product_id を整数で指定してください" unless id.to_s.match?(/\A\d+\z/)

    product = Product.on_sale.includes(:category).find_by(id: id)
    return { found: false, message: "店頭に並んでいる商品の中に、この id の商品はありません" } unless product

    detail = summary(product).merge(
      description: product.description.to_s[0, DESCRIPTION_LIMIT],
      in_stock: product.in_stock?(1)
    )
    if product.is_digital?
      detail[:license] = product.license.presence || "（記載なし）"
      detail[:file_format] = product.model_file_format
    end
    { found: true, product: detail }
  end

  def summary(p)
    {
      id: p.id, sku: p.sku, name: p.name, price_yen: p.price_cents,
      category: p.category.name, category_slug: p.category.slug,
      kind: p.is_digital? ? "ダウンロード販売" : (p.category.service? ? "依頼制 (目安の価格)" : "物販 (配送)"),
      tags: p.tags, subscribable: p.is_subscribable,
      page: "/products/#{p.id}"
    }
  end
end
