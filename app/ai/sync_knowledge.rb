# 公開商品をカテゴリ別の Markdown カタログとして標準出力に書き出す。
# Dify ナレッジベース用 catalog.md を DB から再生成するためのスクリプト。
#
# 使い方 (リポジトリルートから):
#   cd platform
#   docker compose run --rm -T api bin/rails runner /rails/../ai/sync_knowledge.rb > ../app/ai/knowledge/catalog.md
#
# ※ app/ai が api コンテナにマウントされていない場合は、ホスト側で出力をリダイレクトすること。
#   出力された catalog.md と faq.md を Dify のナレッジベースへ再アップロードする。

KIND_HEADING = {
  "coffee"      => "## COFFEE（コーヒー豆 / 物販・サブスク対象）",
  "parts"       => "## PARTS（パーツ / 物販）",
  "maintenance" => "## MAINTENANCE（整備 / 予約制サービス）",
  "system"      => "## SYSTEM（ナビ・電装 / 取付・開発の依頼制サービス）"
}.freeze

puts "# ROUTE & ROAST 取り扱いカタログ"
puts
puts "ライダーズカフェ「ROUTE & ROAST」の取り扱い一覧。AIコンシェルジュのナレッジベース用ソース。"
puts "自動生成: #{Time.current.iso8601}"
puts

Category.order(:position, :id).each do |cat|
  products = cat.products.where("published_at IS NOT NULL").order(:sku)
  next if products.empty?

  puts KIND_HEADING.fetch(cat.slug, "## #{cat.name}")
  puts
  if cat.service?
    puts "カートには入らない。予約・依頼フローから車種等を添えて申し込む。"
    puts
  end
  products.each do |p|
    suffix = cat.service? ? "〜（目安）" : ""
    sub = p.is_subscribable ? " サブスク対応。" : ""
    tags = p.tags.any? ? " タグ: #{p.tags.join(' / ')}。" : ""
    puts "- **#{p.sku} #{p.name}** — ¥#{p.price_cents.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse}#{suffix}"
    puts "  #{p.description}#{tags}#{sub}"
  end
  puts
end
