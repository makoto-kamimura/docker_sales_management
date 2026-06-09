# アーキテクチャ

## 全体構成

```
                      ┌──────────────────────────┐
                      │   ブラウザ / Expo Go      │
                      └─────────────┬────────────┘
                                    │ HTTP/WS
                       ┌────────────▼─────────────┐
                       │  Nginx (リバースProxy)   │  :80
                       │  / → web (Next.js)       │
                       │  /api/ → api (Rails)     │
                       └──┬────────────────────┬──┘
                          │                    │
              ┌───────────▼─────┐    ┌─────────▼─────────┐
              │  web (Next.js)  │    │   api (Rails 7.2) │
              │  :3001          │    │   :3000           │
              └─────────────────┘    └─┬──────────┬──────┘
                                       │          │
                              ┌────────▼──┐  ┌────▼───────────┐
                              │ Postgres  │  │ Dify (AIコンシェルジュ)  │
                              │ :5432     │  │ Workflow API   │
                              │ pgvector  │  │ :5001          │
                              │ pg_trgm   │  └────────────────┘
                              └───────────┘

  ┌─────────────────┐
  │ mobile (Expo)   │  Expo Go 経由で開発機にトンネル接続
  │ :19000-19002    │
  └─────────────────┘
```

## レイヤ責務

| レイヤ | 技術 | 責務 |
|--------|------|------|
| モバイル | React Native (Expo + Expo Router) | iOS/Android 体験。認証, 注文, AIコンシェルジュ, サブスク管理 |
| Web | Next.js 15 (App Router) | ブラウザ向け全機能 + 管理画面 |
| API | Rails 7.2 (API mode) | ビジネスロジック, DB アクセス, 認証, Stripe, Dify 仲介 |
| AI | Dify (Chatflow + Knowledge) | LLM オーケストレーション, 商品 RAG |
| DB | PostgreSQL 16 (pgvector, pg_trgm) | リレーショナル + 全文/ベクトル検索 |
| インフラ | Docker Compose + Nginx | ローカル開発, 単一エントリポイント |

## ディレクトリ構造

```
docker_ruby/
├── app/
│   ├── api/      # Rails (API)
│   ├── web/      # Next.js
│   ├── mobile/   # Expo
│   └── ai/       # Dify 設定 (プロンプト, ナレッジ同期)
├── doc/
│   ├── requirements.md
│   ├── architecture.md
│   ├── setup.md
│   ├── db_schema.md
│   └── api.md
└── platform/
    ├── docker-compose.yml
    ├── .env.example
    ├── nginx/
    │   ├── nginx.conf
    │   └── conf.d/default.conf
    └── postgres/
        └── init/01_create_databases.sql
```

## 通信パス

- **Web → API**: `http://localhost/api/v1/...` (Nginx 経由でブラウザから)
- **Mobile → API**: `http://<開発PC LAN IP>/api/v1/...` (Expo は端末から到達するため)
- **API → Dify**: `http://dify-api:5001/v1/...` (compose 内部ネットワーク)
- **API → Postgres**: `postgres://postgres:5432`

## 認証

- API は JWT (HS256) を発行
- フロント (Web/Mobile) は `Authorization: Bearer <token>` で送信
- リフレッシュ: `POST /api/v1/auth/refresh`
- 管理者は別フラグ (`users.role = 'admin'`) + `/api/v1/admin/*` のミドルウェアで防御
