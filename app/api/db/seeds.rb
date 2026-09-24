puts "Seeding CraftFlow..."

# --- ユーザー ---------------------------------------------------------------
def seed_user(email, name:, role:, permissions: [])
  User.find_or_create_by!(email: email) do |u|
    u.name = name
    u.password = "password"
    u.role = role
    u.permissions = permissions
  end
end

seed_user("admin@example.com", name: "Admin", role: "admin")
staff = [
  seed_user("staff1@example.com", name: "佐藤 (3Dプリント担当)", role: "staff", permissions: %w[production]),
  seed_user("staff2@example.com", name: "鈴木 (レザー・木工担当)", role: "staff", permissions: %w[production])
]
# 注文・販売の担当 (制作はしない)
seed_user("shop@example.com", name: "高橋 (店舗運営)", role: "staff", permissions: %w[sales orders])
members = [
  seed_user("member@example.com", name: "Taro", role: "member"),
  seed_user("hanako@example.com", name: "Hanako", role: "member")
]
[["山田太郎", "千代田区", "千代田1-1"], ["佐々木花子", "渋谷区", "神南1-2-3"]].each_with_index do |(recipient, city, line1), i|
  members[i].addresses.find_or_create_by!(label: "self") do |a|
    a.recipient = recipient
    a.postal_code = "100-0001"
    a.prefecture = "東京都"
    a.city = city
    a.line1 = line1
    a.is_default = true
  end
end

# --- カテゴリ ---------------------------------------------------------------
cats = [
  ["3d-prints", "3Dプリント品"],
  ["3d-models", "3Dモデルデータ"],
  ["handmade",  "ハンドメイド雑貨"],
  ["materials", "素材・キット"],
  ["custom",    "オーダーメイド"] # 依頼制 (カートには入らない)
].each_with_index.to_h do |(slug, name), i|
  cat = Category.find_or_create_by!(slug: slug) { |c| c.name = name }
  cat.update!(name: name, position: i + 1)
  [slug, cat]
end

[
  { code: "weekly",    name: "毎週お届け",   interval_days: 7,  discount_percent: 5 },
  { code: "biweekly",  name: "隔週お届け",   interval_days: 14, discount_percent: 8 },
  { code: "monthly",   name: "月1回お届け",  interval_days: 30, discount_percent: 12 }
].each { |attrs| SubscriptionPlan.find_or_create_by!(code: attrs[:code]) { |p| p.assign_attributes(attrs.merge(active: true)) } }

# --- 材料 (制作用の在庫。販売在庫とは別) ---------------------------------------
materials = [
  { code: "MTL-PLA",  name: "PLAフィラメント (ホワイト)", unit: "g",  stock: 3_000, reorder_point: 1_000, unit_cost_cents: 3, supplier: "フィラメント商会" },
  { code: "MTL-PETG", name: "PETGフィラメント (ブラック)", unit: "g", stock: 800,   reorder_point: 1_000, unit_cost_cents: 4, supplier: "フィラメント商会" },
  { code: "MTL-TPU",  name: "TPUフィラメント (グレー)",   unit: "g",  stock: 500,   reorder_point: 300,   unit_cost_cents: 6, supplier: "フィラメント商会" },
  { code: "MTL-LEA",  name: "ヌメ革 (A4)",               unit: "枚", stock: 12,    reorder_point: 5,     unit_cost_cents: 1_800, supplier: "レザー問屋" },
  { code: "MTL-THR",  name: "蝋引き糸",                   unit: "m",  stock: 50,    reorder_point: 20,    unit_cost_cents: 15, supplier: "レザー問屋" },
  { code: "MTL-WAL",  name: "ウォールナット板材 (300×300mm)", unit: "枚", stock: 6,  reorder_point: 4,     unit_cost_cents: 2_400, supplier: "木材店" },
  { code: "MTL-OIL",  name: "仕上げオイル",               unit: "ml", stock: 400,   reorder_point: 100,   unit_cost_cents: 5, supplier: "木材店" }
].to_h do |attrs|
  m = Material.find_or_initialize_by(code: attrs[:code])
  m.assign_attributes(attrs.except(:stock))
  m.stock = attrs[:stock] if m.new_record? # 既存の在庫数は上書きしない
  m.save!
  [attrs[:code], m]
end

# --- 商品 -------------------------------------------------------------------
products = [
  # 3D PRINTS — 当店で出力・仕上げた完成品 (受注後に制作)
  { sku: "3DP-001", cat: "3d-prints", name: "折りたたみスマホスタンド (PETG)", price_cents: 2_800,
    description: "角度を3段階で調整できる折りたたみスタンド。耐熱性の高いPETGで出力し、手作業で仕上げています。",
    tags: %w[PETG デスク], recipe: { "MTL-PETG" => 45 } },
  { sku: "3DP-002", cat: "3d-prints", name: "ケーブルオーガナイザー 5個セット (TPU)", price_cents: 1_500,
    description: "柔らかいTPU製のケーブルクリップ。デスク裏やガジェットポーチの整理に。",
    tags: %w[TPU デスク], recipe: { "MTL-TPU" => 30 } },
  { sku: "3DP-003", cat: "3d-prints", name: "幾何学ミニプランター (PLA)", price_cents: 2_200,
    description: "多面体デザインの小さな植木鉢。多肉植物やエアプランツに。底面に排水穴あり。",
    tags: %w[PLA インテリア], recipe: { "MTL-PLA" => 80 } },

  # 3D MODELS — 3Dプリンタ用モデルデータ (ダウンロード販売)
  { sku: "3DM-001", cat: "3d-models", name: "折りたたみスマホスタンド STLデータ", price_cents: 600, digital: true,
    license: "個人利用のみ (再配布・データ販売不可)",
    description: "3DP-001 のモデルデータ。推奨: PETG / 0.2mm / インフィル30%。サポート不要。", tags: %w[STL デスク] },
  { sku: "3DM-002", cat: "3d-models", name: "ケーブルオーガナイザー STLデータ", price_cents: 400, digital: true,
    license: "個人利用可 / 印刷品の販売可 (データの再配布不可)",
    description: "3DP-002 のモデルデータ。推奨: TPU (硬度95A) / 0.2mm。", tags: %w[STL デスク] },
  { sku: "3DM-003", cat: "3d-models", name: "幾何学ミニプランター STLデータ", price_cents: 500, digital: true,
    license: "個人利用のみ (再配布・データ販売不可)",
    description: "3DP-003 のモデルデータ。推奨: PLA / 0.2mm / インフィル15%。", tags: %w[STL インテリア] },

  # HANDMADE — レザー・木工
  { sku: "HMD-001", cat: "handmade", name: "本革キーケース (ヌメ革・手縫い)", price_cents: 4_800,
    description: "経年変化を楽しめるヌメ革を一針ずつ手縫いで仕立てたキーケース。名入れはオーダーメイドで承ります。",
    tags: %w[レザー 手縫い], recipe: { "MTL-LEA" => 0.25, "MTL-THR" => 1.2 } },
  { sku: "HMD-002", cat: "handmade", name: "ウォールナット コースター 4枚セット", price_cents: 3_200,
    description: "ウォールナット無垢材を削り出し、オイルで仕上げたコースター。",
    tags: %w[木工 キッチン], recipe: { "MTL-WAL" => 0.25, "MTL-OIL" => 10 } },

  # MATERIALS — つくる人のための素材
  { sku: "MAT-001", cat: "materials", name: "PLAフィラメント 1kg (ホワイト)", price_cents: 2_980, subscribable: true,
    description: "当店の制作でも使っているPLAフィラメント。定期便なら切らさずに済みます。", tags: %w[フィラメント 消耗品] },
  { sku: "MAT-002", cat: "materials", name: "レザークラフト スターターキット", price_cents: 5_500,
    description: "カット済みのヌメ革・糸・針・型紙のセット。キーケースを自分で作れます。", tags: %w[レザー キット] },

  # CUSTOM — オーダーメイド (依頼制)
  { sku: "CUS-001", cat: "custom", name: "オリジナル3Dプリント制作", price_cents: 5_000,
    description: "図面・スケッチ・写真から3Dモデリングと出力を承ります。サイズ・素材・数量でお見積りします。", tags: %w[オーダー 3Dプリント] },
  { sku: "CUS-002", cat: "custom", name: "名入れレザー小物 制作", price_cents: 6_000,
    description: "キーケース・名刺入れなどに刻印・名入れをしてお仕立てします。", tags: %w[オーダー レザー] }
]

# サンプル配布ファイル: 20mm角の立方体 (ASCII STL)
def sample_stl(name)
  s = 20.0
  v = [[0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0], [0, 0, s], [s, 0, s], [s, s, s], [0, s, s]]
  faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
           [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]
  body = faces.map do |f|
    "  facet normal 0 0 0\n    outer loop\n" +
      f.map { |i| "      vertex #{v[i].join(' ')}\n" }.join + "    endloop\n  endfacet\n"
  end.join
  "solid #{name}\n#{body}endsolid #{name}\n"
end

products.each do |p|
  product = Product.find_or_initialize_by(sku: p[:sku])
  new_record = product.new_record?
  product.assign_attributes(
    category: cats.fetch(p[:cat]),
    name: p[:name], description: p[:description], price_cents: p[:price_cents],
    tags: p[:tags], is_subscribable: p[:subscribable] || false, published_at: product.published_at || Time.current,
    is_digital: p[:digital] || false, license: p[:license] || ""
  )
  if product.is_digital? && !product.model_file.attached?
    product.model_file.attach(io: StringIO.new(sample_stl(p[:sku])), filename: "#{p[:sku].downcase}.stl",
                              content_type: "model/stl")
  end
  product.save!
  # 在庫は新規作成時のみ設定 (再実行で実在庫を上書きしない)
  product.inventory.update!(stock: 20) if new_record && !product.is_digital?

  (p[:recipe] || {}).each do |code, qty|
    pm = product.product_materials.find_or_initialize_by(material: materials.fetch(code))
    pm.update!(quantity: qty)
  end

  vec = EmbeddingService.embed("#{product.name}\n#{product.description}\n#{product.tags.join(',')}")
  embed = product.embedding || ProductEmbedding.new(product: product)
  embed.embedding = vec
  embed.indexed_at = Time.current
  embed.save!
end

# --- デモ注文 (制作ボードに各工程のカードが並ぶように) -----------------------------
# 初回のみ投入する。在庫・材料の引き当ては行わない (表示確認用のデータ)。
if Order.none?
  by_sku = Product.where(sku: products.map { |p| p[:sku] }).index_by(&:sku)
  demo = [
    # [顧客, ステータス, 何日前, [[SKU, 数量]], 担当, 納期(日後)]
    [0, "received",            0, [["3DP-003", 1]], nil, 7],
    [1, "paid",                1, [["HMD-001", 1]], nil, 6],
    [0, "awaiting_production", 2, [["3DP-001", 2]], 0, 5],
    [1, "awaiting_production", 2, [["HMD-002", 1], ["MAT-001", 1]], 1, 4],
    [0, "in_production",       3, [["3DP-002", 1]], 0, 2],
    [1, "in_production",       5, [["HMD-001", 1]], 1, -1], # 納期遅れ
    [0, "inspection",          4, [["3DP-003", 2]], 0, 1],
    [1, "ready_to_ship",       6, [["HMD-002", 2]], 1, 0],
    [0, "shipped",             9, [["3DP-001", 1], ["MAT-002", 1]], 0, nil],
    [1, "completed",          14, [["3DP-002", 2]], 0, nil],
    [0, "completed",          20, [["3DM-001", 1]], nil, nil]
  ]
  flow = Order::STATUSES - %w[cancelled]

  demo.each do |member_idx, status, days_ago, lines, staff_idx, due_in|
    user = members[member_idx]
    placed_at = days_ago.days.ago.change(hour: 10)
    items = lines.map { |sku, qty| { product: by_sku.fetch(sku), unit_price_cents: by_sku.fetch(sku).price_cents, quantity: qty } }
    physical = items.any? { |i| i[:product].physical? }
    order = Order.create!(
      user: user, address: physical ? user.default_address : nil, status: status,
      placed_at: placed_at, **Pricing.calc(items),
      paid_at: status == "received" ? nil : placed_at + 2.hours,
      # 制作中以降の注文は材料を消費済みとして扱う (差し戻しで二重に消費しないように)
      materials_consumed_at: physical && flow.index(status) >= flow.index("in_production") ? placed_at + 1.day : nil,
      assignee: staff_idx && staff[staff_idx], due_on: due_in && Date.current + due_in
    )
    items.each do |i|
      order.items.create!(product: i[:product], quantity: i[:quantity], unit_price_cents: i[:unit_price_cents],
                          line_total_cents: i[:unit_price_cents] * i[:quantity])
    end
    if physical
      shipped = %w[shipped completed].include?(status)
      order.create_shipment!(status: status == "completed" ? "delivered" : (shipped ? "shipped" : "preparing"),
                             carrier: shipped ? "ヤマト運輸" : nil, tracking_number: shipped ? "1234-5678-#{order.id}" : nil)
    end
    # 各工程を半日ずつ進んだ履歴を残す (リードタイム分析用)
    steps = physical ? flow[0..flow.index(status)] : %w[received paid completed] # デジタルのみの注文は入金で完了
    steps.each_cons(2).with_index do |(from, to), i|
      order.events.create!(from_status: from, status: to, created_at: placed_at + (i + 1) * 12.hours)
    end
    order.events.create!(status: "received", actor: user, created_at: placed_at)
  end

  # 問い合わせ / オーダーメイド依頼
  first_order = members[0].orders.order(:id).first
  members[0].service_requests.create!(kind: "inquiry", status: "pending", subject: "納期について",
                                      body: "プランターを来週の誕生日に贈りたいのですが、間に合いますか？", order: first_order)
  members[1].service_requests.create!(kind: "inquiry", status: "answered", subject: "革の色について",
                                      body: "キーケースの革は時間が経つとどのくらい色が変わりますか？",
                                      reply: "半年ほどで飴色に変わっていきます。日光に当てると早く色づきます。", replied_at: 1.day.ago)
  members[1].service_requests.create!(kind: "custom", status: "quoted", subject: "イニシャル入り名刺入れ",
                                      body: "ヌメ革の名刺入れにイニシャル「H.S」を刻印してほしいです。",
                                      product: by_sku["CUS-002"], budget_cents: 8_000, preferred_at: 3.weeks.from_now)
end

puts "Done."
puts "Admin:  admin@example.com / password"
puts "Staff:  staff1@example.com, staff2@example.com / password"
puts "Member: member@example.com, hanako@example.com / password"
