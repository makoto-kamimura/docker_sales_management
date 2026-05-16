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
  "coffee" => Category.find_or_create_by!(slug: "coffee") { |c| c.name = "コーヒー豆" },
  "tea"    => Category.find_or_create_by!(slug: "tea")    { |c| c.name = "紅茶" },
  "snack"  => Category.find_or_create_by!(slug: "snack")  { |c| c.name = "お菓子" }
}

[
  { code: "weekly",    name: "毎週お届け",   interval_days: 7,  discount_percent: 5 },
  { code: "biweekly",  name: "隔週お届け",   interval_days: 14, discount_percent: 8 },
  { code: "monthly",   name: "月1回お届け",  interval_days: 30, discount_percent: 12 }
].each { |attrs| SubscriptionPlan.find_or_create_by!(code: attrs[:code]) { |p| p.assign_attributes(attrs.merge(active: true)) } }

products = [
  { sku: "COF-001", cat: "coffee", name: "エチオピア イルガチェフェ 200g", price_cents: 1_800,
    description: "華やかな柑橘と花の香り、明るい酸味のシングルオリジン。", tags: %w[シングル 浅煎り], subscribable: true },
  { sku: "COF-002", cat: "coffee", name: "ブラジル サントス No.2 200g", price_cents: 1_400,
    description: "ナッツとチョコレートの優しい甘み。バランス型。", tags: %w[ブレンドベース 中煎り], subscribable: true },
  { sku: "TEA-001", cat: "tea",    name: "ダージリン ファーストフラッシュ 50g", price_cents: 2_200,
    description: "春摘み。マスカテルフレーバーと爽やかな渋み。", tags: %w[ストレート], subscribable: true },
  { sku: "SNK-001", cat: "snack",  name: "クッキー詰め合わせ 12個入り", price_cents: 1_600,
    description: "コーヒー・紅茶のお供に。アソート。", tags: %w[ギフト], subscribable: false }
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
