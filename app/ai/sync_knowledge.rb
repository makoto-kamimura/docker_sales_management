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
  "3d-prints" => "## 3D PRINTS（3Dプリント品 / 受注後に制作する物販）",
  "3d-models" => "## 3D MODELS（3Dプリンタ用モデルデータ / ダウンロード販売）",
  "handmade"  => "## HANDMADE（ハンドメイド雑貨 / 物販）",
  "materials" => "## MATERIALS（素材・キット / 物販・一部サブスク対象）",
  "custom"    => "## CUSTOM（オーダーメイド / 依頼制）"
}.freeze

puts "# CraftFlow 取り扱いカタログ"
puts
puts "つくる人のネットショップ「CraftFlow」の取り扱い一覧。AIコンシェルジュのナレッジベース用ソース。"
puts "自動生成: #{Time.current.iso8601}"
puts

Category.order(:position, :id).each do |cat|
  products = cat.products.where("published_at IS NOT NULL").order(:sku) # 旧カテゴリの非公開商品は出さない
  next if products.empty?

  puts KIND_HEADING.fetch(cat.slug, "## #{cat.name}")
  puts
  if cat.service?
    puts "カートには入らない。オーダーメイド依頼フォーム (/custom) から、作りたいもの・サイズ・素材・希望納期を添えて依頼する。"
    puts
  end
  products.each do |p|
    suffix = cat.service? ? "〜（目安）" : ""
    sub = p.is_subscribable ? " サブスク対応。" : ""
    sub += " ダウンロード販売 (#{p.model_file_format || '形式未登録'})。ライセンス: #{p.license.presence || '—'}。" if p.is_digital?
    tags = p.tags.any? ? " タグ: #{p.tags.join(' / ')}。" : ""
    puts "- **#{p.sku} #{p.name}** — ¥#{p.price_cents.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse}#{suffix}"
    puts "  #{p.description}#{tags}#{sub}"
  end
  puts
end
