# API リファレンス (v1)

ベースパス: `/api/v1`

認証: `Authorization: Bearer <jwt>` (匿名アクセス可のエンドポイントを除く)

## 認証 / 会員 (要件3)

| Method | Path | 説明 |
|--------|------|------|
| POST | `/auth/register` | 会員登録 |
| POST | `/auth/login` | ログイン → JWT |
| POST | `/auth/refresh` | リフレッシュ |
| GET  | `/me` | プロフィール取得 |
| PATCH | `/me` | プロフィール更新 |
| GET/POST/PATCH/DELETE | `/me/addresses[/:id]` | 住所CRUD |
| GET/POST/DELETE | `/me/payment_methods[/:id]` | 支払い方法 |

## 商品 / 検索 (要件5)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/products` | 一覧 (params: `q`, `category_id`, `category_slug`, `min_price`, `max_price`, `tags[]`, `sort`, `page`) |
| GET | `/products/:id` | 詳細 |
| GET | `/products/search` | ベクトル検索 (`q` 必須) |
| GET | `/categories` | カテゴリ一覧 |

商品レスポンスには `category_slug` / `image_url` を含む。`maintenance` / `system` カテゴリの商品はカート購入ではなく整備予約・開発依頼(要件7)へ誘導する。

## カート / 注文 (要件1)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/cart` | 自分のカート |
| POST | `/cart/items` | 追加 (body: `product_id`, `quantity`) |
| PATCH | `/cart/items/:id` | 数量変更 |
| DELETE | `/cart/items/:id` | 削除 |
| POST | `/orders` | 注文確定 (body: `address_id`, `payment_method_id`) |
| GET | `/orders` | 自分の注文一覧 |
| GET | `/orders/:id` | 注文詳細 |

## 販売管理 (要件2 / 管理者専用)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/admin/orders` | 全注文 (filter: `status`, `from`, `to`) |
| PATCH | `/admin/orders/:id` | ステータス更新 |
| GET | `/admin/products` | 商品管理 |
| POST/PATCH/DELETE | `/admin/products[/:id]` | 商品CRUD |
| POST | `/admin/products/:id/image` | 商品画像アップロード (multipart: `image`)。ActiveStorage に保存し `image_url` を更新 |
| PATCH | `/admin/inventories/:product_id` | 在庫更新 |
| GET | `/admin/dashboard/sales` | 売上サマリ |

## サブスク (要件6)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/subscription_plans` | プラン一覧 |
| GET | `/subscriptions` | 自分のサブスク一覧 |
| POST | `/subscriptions` | 新規購読 (body: `subscription_plan_id`, `product_id`, `address_id`, `payment_method_id`) |
| PATCH | `/subscriptions/:id` | 一時停止/再開/次回日変更 |
| DELETE | `/subscriptions/:id` | 解約 |
| POST | `/subscriptions/:id/skip` | 次回スキップ |

## 整備予約 / システム開発依頼 (要件7)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/service_requests` | 自分の依頼一覧 (filter: `kind` = `maintenance` \| `system`) |
| GET | `/service_requests/:id` | 依頼詳細 |
| POST | `/service_requests` | 依頼作成 (body: `kind`, `product_id?`, `vehicle`, `preferred_at?`(整備は必須), `budget_cents?`, `body`, `contact_phone?`) |

管理者:

| Method | Path | 説明 |
|--------|------|------|
| GET | `/admin/service_requests` | 全依頼 (filter: `kind`, `status`) |
| GET | `/admin/service_requests/:id` | 詳細 |
| PATCH | `/admin/service_requests/:id` | ステータス更新 (body: `status`) |

## AIコンシェルジュ (要件4)

| Method | Path | 説明 |
|--------|------|------|
| POST | `/ai_concierge/conversations` | 新規会話開始 |
| POST | `/ai_concierge/conversations/:id/messages` | 発話 (body: `content`)<br/>レスポンスは SSE で逐次返却 |
| GET  | `/ai_concierge/conversations/:id` | 会話履歴 |

## 共通

- エラーは `{ "error": { "code": "...", "message": "..." } }` 形式
- ページネーションは `?page=1&per=20`、レスポンスヘッダ `X-Total-Count`, `X-Page`, `X-Per-Page`
