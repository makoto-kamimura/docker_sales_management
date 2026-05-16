# セットアップ手順

## 前提

- Docker Desktop (Compose v2)
- ホストには Ruby / Node の事前インストール **不要**

## 1. 環境変数

```bash
cd docker_ruby/platform
cp .env.example .env
# 必要なら DIFY_API_KEY などを編集
```

## 2. 初回ブートストラップ (各アプリ生成)

骨組みのみが含まれているため、Docker コンテナ内で各フレームワークの `new` を実行する。

### Rails API

```bash
cd docker_ruby/platform
docker compose run --rm api bash -lc "
  rails new . --api --database=postgresql --skip-bundle --skip-git --skip-test --force &&
  bundle install
"
```

`Gemfile` は既存のものに上書きされるため、必要に応じて元の Gemfile からマージする (本リポジトリの初期 Gemfile は推奨gem入り)。

### Next.js Web

```bash
docker compose run --rm web sh -lc "
  npx --yes create-next-app@latest . \
    --typescript --eslint --app --src-dir --tailwind \
    --no-import-alias --use-npm
"
```

### Expo Mobile

```bash
docker compose run --rm mobile sh -lc "
  npx --yes create-expo-app@latest . --template tabs
"
```

## 3. DB セットアップ

```bash
docker compose up -d postgres
docker compose run --rm api bundle exec rails db:create db:migrate db:seed
```

## 4. 起動

```bash
docker compose up
```

| サービス | URL |
|---------|-----|
| 統合 (Nginx) | http://localhost |
| Web 直接 | http://localhost:3001 |
| API 直接 | http://localhost:3000 |
| Expo DevTools | http://localhost:19002 |
| Postgres | localhost:5432 |

## 5. Dify (任意)

```bash
docker compose --profile ai up -d dify-api dify-web redis
```

詳細は [../app/ai/README.md](../app/ai/README.md) を参照。

## トラブルシュート

- `bundle install` 失敗 → `docker compose build --no-cache api`
- node_modules 不整合 → `docker compose down -v` で named volume を削除
- Postgres の `dify` DB が無い → `docker compose down -v` で初期化スクリプトを再実行
