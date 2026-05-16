# 要件定義

`docker_ruby/design.md` の要件をシステム要件として展開したもの。

## 機能要件

| # | 機能 | 概要 | 主要画面/エンドポイント |
|---|------|------|------------------------|
| 1 | 注文受付 | 商品をカートに入れて注文確定、決済、在庫引き当て | Web: `/cart`, `/checkout` <br/> Mobile: `Cart`, `Checkout` <br/> API: `POST /api/v1/orders` |
| 2 | 販売管理 | 注文一覧・出荷ステータス管理 (管理者) | Web: `/admin/orders` <br/> API: `GET /api/v1/admin/orders`, `PATCH /api/v1/admin/orders/:id` |
| 3 | 会員情報管理 | 会員登録/ログイン/プロフィール/住所/支払い方法 | Web/Mobile: `/account` <br/> API: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET/PATCH /api/v1/me` |
| 4 | AI接客 | チャット形式での商品提案・問い合わせ対応 (Dify連携) | Web/Mobile: 全画面右下チャット <br/> API: `POST /api/v1/ai_concierge/messages` |
| 5 | 商品検索 | キーワード/カテゴリ/価格/タグ検索 (pg_trgm + pgvector) | Web/Mobile: `/search` <br/> API: `GET /api/v1/products?q=...` |
| 6 | サブスクリプション販売管理 | 定期購買プラン購読・解約・スキップ・次回配送日変更 | Web/Mobile: `/subscriptions` <br/> API: `POST /api/v1/subscriptions`, `PATCH /api/v1/subscriptions/:id` |

## 非機能要件 (初期目標)

- 同時接続: 100セッション程度
- レスポンス: 検索 95p < 500ms / 注文確定 95p < 1.5s
- 可用性: 開発環境ゆえ SLA なし (本番は別途)
- セキュリティ:
  - 全API HTTPS 前提 (本番)
  - パスワードは bcrypt (cost=12)
  - JWT は HS256, 有効期限 1h, リフレッシュトークン7日
- ログ: Rails 標準 stdout → Docker logs

## アクター

- **ゲスト**: 商品閲覧/検索/AI接客のみ
- **会員 (member)**: + 注文/サブスク/プロフィール
- **管理者 (admin)**: + 販売管理/在庫操作
