puts "Seeding..."

User.find_or_create_by!(email: "admin@example.com") do |u|
  u.name = "Admin"
  u.password = "password"
  u.role = "admin"
end

member = User.find_or_create_by!(email: "member@example.com") do |u|
  u.name = "Taro"
  u.password = "password"
  u.role = "member"
end
member.addresses.find_or_create_by!(label: "self") do |a|
  a.recipient = "山田太郎"
  a.postal_code = "100-0001"
  a.prefecture = "東京都"
  a.city = "千代田区"
  a.line1 = "千代田1-1"
  a.is_default = true
end

cats = {
  "coffee"      => Category.find_or_create_by!(slug: "coffee")      { |c| c.name = "コーヒー豆" },
  "parts"       => Category.find_or_create_by!(slug: "parts")       { |c| c.name = "パーツ" },
  "maintenance" => Category.find_or_create_by!(slug: "maintenance") { |c| c.name = "整備" },
  "system"      => Category.find_or_create_by!(slug: "system")      { |c| c.name = "システム" }
}

[
  { code: "weekly",    name: "毎週お届け",   interval_days: 7,  discount_percent: 5 },
  { code: "biweekly",  name: "隔週お届け",   interval_days: 14, discount_percent: 8 },
  { code: "monthly",   name: "月1回お届け",  interval_days: 30, discount_percent: 12 }
].each { |attrs| SubscriptionPlan.find_or_create_by!(code: attrs[:code]) { |p| p.assign_attributes(attrs.merge(active: true)) } }

products = [
  # COFFEE — 走る前の一杯
  { sku: "COF-001", cat: "coffee", name: "エチオピア イルガチェフェ 200g", price_cents: 1_800,
    description: "華やかな柑橘と花の香り、明るい酸味のシングルオリジン。ツーリング前の目覚めの一杯に。", tags: %w[シングル 浅煎り], subscribable: true },
  { sku: "COF-002", cat: "coffee", name: "ライダーズブレンド 深煎り 200g", price_cents: 1_500,
    description: "ビターチョコのコクと香ばしさ。早朝出発でもしっかり目が覚める深煎り。", tags: %w[ブレンド 深煎り], subscribable: true },

  # PARTS — タイヤ・オイル・カスタムパーツ
  { sku: "PRT-001", cat: "parts", name: "ツーリングタイヤ 前後セット (17インチ)", price_cents: 38_000,
    description: "ウェットグリップとライフを両立するスポーツツーリング向け。長距離派におすすめ。", tags: %w[タイヤ ツーリング], subscribable: false },
  { sku: "PRT-002", cat: "parts", name: "全合成エンジンオイル 10W-40 1L", price_cents: 2_400,
    description: "高温でも安定する100%化学合成油。定期交換でエンジンを長持ちさせる。", tags: %w[オイル 消耗品], subscribable: true },
  { sku: "PRT-003", cat: "parts", name: "ブレーキパッド (フロント)", price_cents: 4_800,
    description: "コントロール性に優れたシンタード。鳴きを抑え制動を安定させる。", tags: %w[ブレーキ カスタム], subscribable: false },

  # MAINTENANCE — 整備メニュー / 工賃
  { sku: "MNT-001", cat: "maintenance", name: "定期点検パック (12ヶ月)", price_cents: 12_000,
    description: "各部点検・調整・油脂類チェックの基本パック。ご予約はAIコンシェルジュからどうぞ。", tags: %w[点検 予約], subscribable: false },
  { sku: "MNT-002", cat: "maintenance", name: "タイヤ交換工賃 (前後)", price_cents: 6_600,
    description: "脱着・組み換え・バランス調整込み。パーツと同時購入で当日施工可。", tags: %w[工賃 タイヤ], subscribable: false },

  # SYSTEM — ナビ・電装機器
  { sku: "SYS-001", cat: "system", name: "バイク用ツーリングナビ 5インチ防水", price_cents: 42_000,
    description: "グローブ操作対応・防水・高輝度ディスプレイ。林道もカバーする地図を搭載。", tags: %w[ナビ 防水], subscribable: false },
  { sku: "SYS-002", cat: "system", name: "Bluetoothインカム (2台セット)", price_cents: 18_000,
    description: "タンデム・グループツーリングでの通話に。ナビ音声・音楽連携も対応。", tags: %w[インカム 電装], subscribable: false }
]

products.each do |p|
  product = Product.find_or_initialize_by(sku: p[:sku])
  product.assign_attributes(
    category: cats.fetch(p[:cat]),
    name: p[:name], description: p[:description], price_cents: p[:price_cents],
    tags: p[:tags], is_subscribable: p[:subscribable], published_at: Time.current
  )
  product.save!
  product.inventory.update!(stock: 50)

  vec = EmbeddingService.embed("#{product.name}\n#{product.description}\n#{product.tags.join(',')}")
  embed = product.embedding || ProductEmbedding.new(product: product)
  embed.embedding = vec
  embed.indexed_at = Time.current
  embed.save!
end

puts "Done."
puts "Admin:  admin@example.com / password"
puts "Member: member@example.com / password"
