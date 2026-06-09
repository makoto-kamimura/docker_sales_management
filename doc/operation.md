# 運用 / 起動手順

`docker_ruby` の開発環境の起動・停止・再構築手順をまとめたドキュメント。

## 前提

- Docker Desktop (Compose v2)
- ホストには Ruby / Node の事前インストール **不要**
- ポート: 80 / 3000 / 3001 / 5432 / 8081 / 19000-19002 が空いていること
- (Dify を起動する場合) 追加で 8080 / 8443 / 5003 が空いていること

## 1. 初回セットアップ

### 1.1 環境変数

```bash
cd docker_ruby/platform
cp .env.example .env
```

### 1.2 各アプリの初回ブートストラップ (リポジトリにフレームワーク雛形が無い場合のみ)

本リポジトリには `app/api`, `app/web`, `app/mobile` 配下に Rails / Next.js / Expo の生成済みコードが含まれています。**通常はスキップで OK**。
スクラッチから再生成する場合のみ次を実行:

```bash
cd docker_ruby/platform
docker compose run --rm api bash -lc \
  "rails new . --api --database=postgresql --skip-bundle --skip-git --skip-test --force"
docker compose run --rm web sh -lc \
  "npx --yes create-next-app@15 . --typescript --eslint --app --src-dir --tailwind --no-import-alias --use-npm --no-turbopack"
docker compose run --rm mobile sh -lc \
  "npx --yes create-expo-app@latest . --template tabs --no-install"
```

### 1.3 DB の初期化 (マイグレーション + シード)

```bash
cd docker_ruby/platform
docker compose up -d postgres
docker compose run --rm api bash -c "bundle exec rails db:prepare && bundle exec rails db:seed"
```

シード完了で以下が投入されます:
- 管理者 `admin@example.com / password`
- 会員 `member@example.com / password` (住所1件)
- カテゴリ: コーヒー豆 / 紅茶 / お菓子
- サブスクプラン: 毎週 / 隔週 / 月1
- 商品4件 (mock embedding 含む)

## 2. 通常起動

```bash
cd docker_ruby/platform
docker compose up
```

| サービス | URL | 用途 |
|---------|-----|------|
| Nginx (統合エントリ) | http://localhost | `/` → Next.js, `/api/` → Rails |
| Rails API 直接 | http://localhost:3000/api/v1 | API 単体動作確認 |
| Next.js Web 直接 | http://localhost:3001 | ブラウザ・管理画面 |
| Expo Dev Server | http://localhost:8081 | Metro bundler (`u` でURL確認) |
| Postgres | localhost:5432 | DBクライアント接続用 |

### サービスを個別に起動

```bash
docker compose up postgres api          # APIだけ動かしたいとき
docker compose up postgres api web      # フロントWebまで
docker compose up postgres api nginx    # Nginx経由を試したいとき
```

### バックグラウンド起動 & ログ追従

```bash
docker compose up -d
docker compose logs -f api web
```

## 3. Dify (AIコンシェルジュ) を起動

> ⚠️ Dify は **公式 [langgenius/dify](https://github.com/langgenius/dify) の docker compose** を**別ディレクトリで起動**する構成。  
> 本リポジトリの `platform/docker-compose.yml` には Dify サービスを含めない（同梱 nginx／Rails と同一オリジン化できず Cookie 認証が壊れるため）。

### 3.1 初回セットアップ (1回だけ)

```bash
# 1. 公式リポジトリをホームに clone
git clone --depth 1 https://github.com/langgenius/dify.git ~/dify

# 2. .env を作成し、本プラットフォームの nginx (80) と衝突しないようポートを変更
cp ~/dify/docker/.env.example ~/dify/docker/.env

# .env の以下2行を編集 (デフォルト 80/443 → 8080/8443 に変更):
#   EXPOSE_NGINX_PORT=8080
#   EXPOSE_NGINX_SSL_PORT=8443
# SECRET_KEY= も空なら適当なランダム文字列を設定:
#   SECRET_KEY=sk-$(openssl rand -base64 42)
```

### 3.2 起動 / 停止 (2回目以降)

```bash
# 起動
cd ~/dify/docker && docker compose up -d

# 停止
cd ~/dify/docker && docker compose stop

# 状況確認
cd ~/dify/docker && docker compose ps
```

- Dify Console / Web:  http://localhost:8080
- Dify Service API:     http://localhost:8080/v1   (Rails からはこちらを叩く)

### 3.3 Workflow 登録と API キー発行

初回のみ：

1. http://localhost:8080/install で管理者アカウント作成
2. ログイン後、Studio → Create from Blank → **Chatflow** で「AIコンシェルジュ」ワークフローを作成
3. Variables に以下を追加 (型はすべて string):
   - `member_name`
   - `cart_items` (JSON 文字列)
   - `recent_orders` (JSON 文字列)
4. LLM ノードのモデルプロバイダを設定 (OpenAI/Anthropic 等の API キーを Dify 側で登録)
5. プロンプトに [../app/ai/prompts/concierge_system.md](../app/ai/prompts/concierge_system.md) を貼り付け
6. **Publish** → アプリ画面の「API Access」から **API Key** を発行 (`app-xxxxxxxx`)

### 3.4 Rails 側の接続設定

`platform/.env`:

```bash
DIFY_API_BASE=http://host.docker.internal:8080/v1
DIFY_API_KEY=app-xxxxxxxxxxxxxxxxxx
```

反映：

```bash
cd docker_ruby/platform
docker compose restart api
```

> Rails コンテナは `appnet` ネットワーク、Dify は別ネットワーク (`docker_default`) に居るため、Docker DNS ではなく **`host.docker.internal`** 経由でホスト→Dify nginx に到達する。  
> 動作確認: `docker compose exec api bash -lc 'curl -sS http://host.docker.internal:8080/v1/parameters -H "Authorization: Bearer $DIFY_API_KEY"'`

### 3.5 Dify 未起動 / 未設定でも他機能は動く

`DIFY_API_KEY` 未設定や Dify 未起動でも、AIコンシェルジュ以外の機能 (商品閲覧・カート・注文等) は動作する。AIコンシェルジュ API のみ `bad_gateway` (`code: ai_unavailable`) を返す ([../app/api/app/controllers/api/v1/ai_concierge/messages_controller.rb](../app/api/app/controllers/api/v1/ai_concierge/messages_controller.rb))。

## 4. モバイル (Expo) の接続方法

Expo は Docker 内で動かしますが、物理デバイス/シミュレータからの接続には注意点があります。

### 4.1 LAN モード (デフォルト / 推奨)

`.env` で次のように設定:

```bash
EXPO_HOST=lan
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.42   # 開発PCのLAN IPに置換
EXPO_PUBLIC_API_BASE=http://192.168.1.42/api  # 物理デバイスから到達する Nginx の URL
```

開発PCのLAN IPは:

```bash
# macOS
ipconfig getifaddr en0
# Linux
hostname -I | awk '{print $1}'
```

設定後、`docker compose up mobile` で起動。ターミナルに表示される QR を Expo Go アプリ (iOS/Android) で読み取る。

> 注意: スマホと開発PCが同じ Wi-Fi に接続されていることが必須。

### 4.2 Tunnel モード (LANが使えない環境 / カフェ・社内Wi-Fi隔離 等)

ngrok 経由で外部トンネルを張る:

```bash
# .env で
EXPO_HOST=tunnel
```

> `@expo/ngrok` は package.json に同梱済み。初回起動時に `npm install` 内で導入される。

### 4.3 シミュレータ / ブラウザのみ (最小確認)

物理デバイスへの実機接続を諦め、開発PC内のシミュレータかブラウザで動作確認:

```bash
# .env で
EXPO_HOST=localhost
```

その後、Metro が出すURL (http://localhost:8081) をブラウザで開く、または別途ホストにインストールした Xcode/Android Studio のシミュレータから接続。

### 4.4 そもそも Docker 経由が辛い場合 (代替: ホスト直接実行)

Expo は Docker と相性が悪い (USB接続・Bluetooth ペアリング・iOS シミュレータ等)。実機開発が本格化したらホスト直接実行を推奨:

```bash
# ホストに Node 20+ をインストール後
cd docker_ruby/app/mobile
npm install
EXPO_PUBLIC_API_BASE=http://<開発PC LAN IP>/api npx expo start
```

`docker compose` 側からは `mobile` サービスを除外して起動:

```bash
docker compose up postgres api web nginx
```

## 5. よくあるトラブル

### 「`CommandError: Input is required, but 'npx expo' is in non-interactive mode. Required input: The package @expo/ngrok@^4.1.0 is required to use tunnels`」

- 原因: `EXPO_HOST=tunnel` 設定時に `@expo/ngrok` が無いと出る
- 対処: `package.json` に `@expo/ngrok` を入れて `docker compose run --rm mobile npm install` で取り込む (本リポジトリは同梱済み)。
  もしくは `.env` の `EXPO_HOST=lan` に切り替える。

### 「Could not connect to development server」(Expo Go から接続できない)

- スマホと開発PCが同じネットワークか確認
- `REACT_NATIVE_PACKAGER_HOSTNAME` が開発PCの LAN IP になっているか確認 (`host.docker.internal` は実機から見えない)
- VPN/社内Wi-Fiの隔離設定で同じLAN内通信が遮断されていないか確認 → 必要なら `EXPO_HOST=tunnel`

### 「`Zeitwerk::NameError: expected file ...controllers/api/v1/xxx_controller.rb to define constant Api::V1::XxxController`」

- 原因: ファイル名とクラス名がRails慣例どおりに対応していない
- 対処: ファイル名 (snake_case 複数形) とクラス名 (CamelCase 複数形) を一致させる

### 「Postgres の vector 拡張が見つからない」

- 原因: 公式 `postgres:16-alpine` を使うと pgvector が無い
- 対処: `platform/docker-compose.yml` の image は `pgvector/pgvector:pg16` を指定済み。`docker compose down -v && docker compose up -d postgres` でやり直し

### 「bundle install が失敗する / Gemfile.lock が古い」

```bash
docker compose run --rm api bundle install
# それでも改善しなければ
docker compose build --no-cache api
docker volume rm docker_ruby_bundle_cache
```

### 「node_modules がコンテナ内で壊れた / OS 不一致 (host から `npm install` 走らせた等)」

```bash
docker compose down
docker volume rm docker_ruby_web_node_modules docker_ruby_mobile_node_modules
docker compose up
```

### 「Next.js: Module not found: Can't resolve 'xxx'」 (依存追加後にビルドが通らない)

- 原因: `package.json` に依存を追加して `npm install` しても、Next.js dev サーバーの `.next` キャッシュが古い resolve 結果を覚えているため
- 対処:
  ```bash
  # 1. 依存をコンテナ内にインストール
  docker compose exec web npm install
  # 2. webpack キャッシュを削除
  docker compose exec web rm -rf .next
  # 3. dev サーバー再起動
  docker compose restart web
  # 4. ブラウザを hard reload (Cmd+Shift+R / Ctrl+Shift+R)
  ```
- 補足: 同様に Expo (mobile) で依存を追加した場合は `docker compose exec mobile npm install` 後に `docker compose restart mobile`。

### 「Next.js: A tree hydrated but some attributes of the server rendered HTML didn't match the client properties」

- 原因: ほとんどはブラウザ拡張機能が `<body>` や `<html>` に属性を後から注入することによるサーバー/クライアントの不一致 (代表例)
  - `data-gptw` — GPT for Work / Monica 等
  - `data-new-gr-c-s-check-loaded` — Grammarly
  - `cz-shortcut-listen` — ColorZilla
  - `data-lt-installed` — LanguageTool
- 対処: 本リポジトリの [src/app/layout.tsx](../app/web/src/app/layout.tsx) は `<html>` `<body>` に `suppressHydrationWarning` を付与済み。新規 layout を追加する際は同様にしておく。
- 切り分け: シークレットウィンドウで開いてエラーが消えるなら、拡張機能が原因で確定。

### 「Next.js SSR で `fetch failed` / API へ繋がらない」

- 原因: サーバーコンポーネント (Next.js コンテナ内 Node.js) から `http://localhost/api` を叩くと、それは「dr_web コンテナ自身の localhost」を指してしまうため
- 対処: 本リポジトリの [src/lib/api.ts](../app/web/src/lib/api.ts) は `typeof window === "undefined"` で分岐済み (SSR時は `API_BASE_INTERNAL=http://api:3000/api`、CSR時は `NEXT_PUBLIC_API_BASE=http://localhost/api`)。
- 新規のサーバーコンポーネントから API を叩く際は `fetch` 直書きではなく `api()` ヘルパー経由にする。

### 「Rails: API へ Docker network 内ホスト名 (`api` / `nginx`) からアクセスすると 403 Forbidden」

- 原因: Rails 7 の Host Authorization が許可リストに無いホスト名からのアクセスを拒否する
- 対処: 本リポジトリの [config/environments/development.rb](../app/api/config/environments/development.rb) に `config.hosts << "api"` 等を追加済み。新しい Docker サービス名を追加した場合はここに足す。

### 「create-next-app / create-expo-app が既存ファイルを上書きしてしまった」

- 原因: `docker compose run --rm web npx create-next-app@latest .` のような再生成は、リポジトリ同梱の `package.json` や `Dockerfile` を含めて空のテンプレートで上書きする
- 対処: 再生成前に既存ファイルをバックアップ → 生成 → 必要な依存 (`swr` / `@expo/ngrok` 等) と環境固有ファイル (開発用 `Dockerfile`) をマージし直す。**通常は再生成不要** (本リポジトリには生成済みコードが入っているため)。

## 6. リセット / クリーンアップ

| 目的 | コマンド |
|------|---------|
| コンテナ停止 (データは保持) | `docker compose stop` |
| コンテナ削除 (データは保持) | `docker compose down` |
| **全データ削除** (DB・bundle・node_modules) | `docker compose down -v` |
| ビルドキャッシュ無視で再ビルド | `docker compose build --no-cache` |
| イメージ削除 | `docker compose down --rmi local` |

## 7. 動作確認 (smoke test)

```bash
# 商品一覧
curl http://localhost:3000/api/v1/products

# ログイン
TOKEN=$(curl -sS -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@example.com","password":"password"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

# カート取得
curl http://localhost:3000/api/v1/cart -H "Authorization: Bearer $TOKEN"

# 商品をカートへ
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":2}'
```

## 8. デプロイ向けメモ (本番化する場合)

本リポジトリの compose は開発向け。本番では下記を別途設計:

- Rails: `Dockerfile` を multi-stage に置き換え (生成時に作られていた `app/api/Dockerfile.production` を参考に) → assets precompile / `RAILS_ENV=production`
- Next.js: `next build && next start` (multi-stage) / 静的アセットは CDN
- Expo: EAS Build でネイティブビルド (Docker 不使用)
- Postgres: マネージド (RDS / Cloud SQL) + pgvector 有効化
- Dify: 別ホストの公式 compose を使う / クラウド版利用
- 秘密情報: AWS Secrets Manager / GCP Secret Manager / Vault 等
- ログ: stdout → CloudWatch / Cloud Logging
