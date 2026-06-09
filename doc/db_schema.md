# DB スキーマ

PostgreSQL 16, Rails 7.2 migrations 前提。

## テーブル一覧

| テーブル | 用途 | 関連要件 |
|---------|------|---------|
| `users` | 会員/管理者 | 3 |
| `addresses` | 会員の住所 | 3 |
| `payment_methods` | 会員の支払い方法 (Stripe customer/payment_method) | 1, 6 |
| `categories` | 商品カテゴリ | 5 |
| `products` | 商品 | 1, 5 |
| `product_embeddings` | pgvector 埋め込み (商品検索 RAG) | 5 |
| `inventories` | 在庫 | 1, 2 |
| `carts` / `cart_items` | カート | 1 |
| `orders` / `order_items` | 注文 | 1, 2 |
| `shipments` | 出荷 | 2 |
| `subscription_plans` | サブスクプランマスタ | 6 |
| `subscriptions` | 会員別サブスク契約 | 6 |
| `subscription_deliveries` | 各回配送スケジュール | 6 |
| `service_requests` | 整備予約 / システム開発依頼 | 7 |
| `active_storage_*` | 商品画像 (ActiveStorage: blobs / attachments / variant_records) | 1, 5 |
| `ai_conversations` / `ai_messages` | AIコンシェルジュの対話履歴 | 4 |

## ER 概要

```
users 1─┬─* addresses
        ├─* payment_methods
        ├─1 carts ─* cart_items ─* products
        ├─* orders ─* order_items ─* products
        │            └─1 shipments
        ├─* subscriptions ─* subscription_deliveries
        │     └─1 subscription_plans
        ├─* service_requests ─0..1 products
        └─* ai_conversations ─* ai_messages

products *─1 categories
products 1─1 inventories
products 1─1 product_embeddings (vector(1536))
```

## 主要カラム (抜粋)

### users
- `id` bigint pk
- `email` citext unique
- `password_digest` string
- `role` string ('member' | 'admin'), default 'member'
- `name` string
- `stripe_customer_id` string nullable
- timestamps

### products
- `id` bigint pk
- `category_id` bigint fk
- `sku` string unique
- `name` string (pg_trgm index)
- `description` text (pg_trgm index)
- `price_cents` integer
- `currency` string default 'JPY'
- `is_subscribable` boolean default false
- `published_at` datetime nullable
- `image_url` string default '' (商品画像URL / 空なら SKU プレースホルダ表示)
- timestamps

### service_requests
- `id` bigint pk
- `user_id` bigint fk
- `product_id` bigint fk nullable (参照する整備メニュー / 機器)
- `kind` string ('maintenance' | 'system')
- `status` string
  - maintenance: 'pending' → 'confirmed' → 'completed' / 'cancelled'
  - system: 'pending' → 'quoted' → 'in_progress' → 'completed' / 'cancelled'
- `vehicle` string (車種・型式)
- `preferred_at` datetime nullable (整備の希望日時 / maintenance では必須)
- `budget_cents` integer nullable (システムの想定予算)
- `body` text (要件 / 相談内容)
- `contact_phone` string
- timestamps

### product_embeddings
- `product_id` bigint pk fk
- `embedding` vector(1536)  -- text-embedding-3-small 想定
- `indexed_at` datetime

### orders
- `id` bigint pk
- `user_id` bigint fk
- `status` string ('pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled')
- `subtotal_cents` / `tax_cents` / `shipping_cents` / `total_cents` integer
- `stripe_payment_intent_id` string
- `placed_at` datetime
- timestamps

### subscriptions
- `id` bigint pk
- `user_id` bigint fk
- `subscription_plan_id` bigint fk
- `product_id` bigint fk
- `status` string ('active' | 'paused' | 'cancelled')
- `next_delivery_on` date
- `interval_days` integer
- `stripe_subscription_id` string
- timestamps

### ai_conversations
- `id` bigint pk
- `user_id` bigint fk nullable (ゲスト可)
- `dify_conversation_id` string
- `started_at` datetime
- timestamps

### ai_messages
- `id` bigint pk
- `ai_conversation_id` bigint fk
- `role` string ('user' | 'assistant' | 'system')
- `content` text
- `cta` string nullable
- `created_at` datetime
