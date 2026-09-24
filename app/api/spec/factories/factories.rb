FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    name { "テスト太郎" }
    password { "password" }
    role { "member" }

    trait :admin do
      role { "admin" }
    end

    # 制作スタッフ (制作権限のみ)
    trait :staff do
      role { "staff" }
      permissions { %w[production] }
    end
  end

  factory :category do
    sequence(:name) { |n| "カテゴリ#{n}" }
    sequence(:slug) { |n| "cat-#{n}" }

    trait :custom do
      name { "オーダーメイド" }
      slug { "custom" }
    end
  end

  factory :product do
    association :category
    sequence(:sku) { |n| "SKU-#{n}" }
    name { "テスト商品" }
    description { "説明" }
    price_cents { 1_000 }
    currency { "JPY" }
    published_at { Time.current }

    # 在庫ありの物販品 (3Dプリント品など)
    trait :stocked do
      after(:create) { |p| p.inventory.update!(stock: 10) }
    end

    # 3Dモデルデータ (ダウンロード販売)
    trait :digital do
      is_digital { true }
      license { "個人利用のみ" }
      after(:build) do |p|
        p.model_file.attach(io: StringIO.new("solid cube\nendsolid cube\n"), filename: "cube.stl",
                            content_type: "model/stl")
      end
    end
  end

  factory :address do
    association :user
    recipient { "山田太郎" }
    postal_code { "100-0001" }
    prefecture { "東京都" }
    city { "千代田区" }
    line1 { "千代田1-1" }
  end

  factory :service_request do
    association :user
    kind { "inquiry" }
    status { "pending" }
    subject { "納期について" }
    body { "来週までに届きますか？" }

    trait :custom do
      kind { "custom" }
      subject { "名入れキーケース" }
      preferred_at { 3.weeks.from_now }
      budget_cents { 8_000 }
      body { "イニシャルを刻印してほしい" }
    end
  end

  factory :material do
    sequence(:code) { |n| "MTL-#{n}" }
    name { "PLAフィラメント" }
    unit { "g" }
    stock { 1_000 }
    reorder_point { 200 }
  end

  # 入金待ちの注文 (物販品1点)。在庫の仮押さえ済みの状態を再現する
  factory :order do
    association :user
    status { "received" }
    placed_at { Time.current }
    address { association :address, user: user }

    transient do
      product { create(:product, :stocked) }
      quantity { 1 }
    end

    after(:create) do |order, ev|
      order.items.create!(product: ev.product, quantity: ev.quantity, unit_price_cents: ev.product.price_cents,
                          line_total_cents: ev.product.price_cents * ev.quantity)
      order.update!(Pricing.calc([{ product: ev.product, unit_price_cents: ev.product.price_cents, quantity: ev.quantity }]))
      ev.product.inventory.reserve!(ev.quantity) if ev.product.physical?
      order.create_shipment!(status: "preparing") if ev.product.physical?
      order.events.create!(status: "received", actor: order.user)
    end
  end
end
