# docker_sales_management

EC + サブスク + AI接客 のフルスタック・マルチクライアントアプリ。

ライセンス: [MIT](LICENSE)

## 技術スタック

| レイヤ | 技術 |
|--------|------|
| モバイル | React Native (Expo) |
| Web | Next.js 15 (App Router) |
| API | Rails 7.2 (API mode) |
| AI | Dify |
| DB | PostgreSQL 16 (pgvector / pg_trgm) |
| インフラ | Docker Compose + Nginx |

## ディレクトリ

```
docker_sales_management/
├── app/        # アプリケーション (api / web / mobile / ai)
├── doc/        # 要件・設計・セットアップ手順
└── platform/   # Docker Compose, Nginx, Postgres 初期化
```

## クイックスタート

```bash
cd platform
cp .env.example .env
docker compose up -d postgres
docker compose run --rm api bash -c "bundle exec rails db:prepare && bundle exec rails db:seed"
docker compose up
```

> **本番運用時の注意**: `.env` / `seeds.rb` のデフォルトパスワード (`app_password` / `password`) は開発専用です。デプロイ前に必ず変更してください。`app/api/config/master.key` はリポジトリに含めず、別途安全に管理してください。

詳細・トラブルシュートは [doc/operation.md](doc/operation.md) を参照。

主要ドキュメント:
- [要件](doc/requirements.md)
- [アーキテクチャ](doc/architecture.md)
- [運用・起動手順](doc/operation.md) ← まずこれ
- [初回セットアップ](doc/setup.md)
- [DB スキーマ](doc/db_schema.md)
- [API リファレンス](doc/api.md)
