FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    name { "テスト太郎" }
    password { "password" }
    role { "member" }

    trait :admin do
      role { "admin" }
    end
  end

  factory :category do
    sequence(:name) { |n| "カテゴリ#{n}" }
    sequence(:slug) { |n| "cat-#{n}" }

    trait :maintenance do
      name { "整備" }
      slug { "maintenance" }
    end

    trait :system do
      name { "システム" }
      slug { "system" }
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
  end

  factory :service_request do
    association :user
    kind { "maintenance" }
    status { "pending" }
    vehicle { "CB400SF" }
    body { "12ヶ月点検をお願いします" }
    preferred_at { 3.days.from_now }

    trait :system do
      kind { "system" }
      preferred_at { nil }
      budget_cents { 50_000 }
      body { "ナビとインカムを取り付けたい" }
    end
  end
end
