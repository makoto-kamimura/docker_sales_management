# AI (Dify)

AI 接客機能のバックエンドとして [Dify](https://dify.ai/) を使用する。Rails API から Dify の Workflow API を呼び出す構成。

## 構成

```
Mobile / Web
   ↓
Nginx → Rails (/api/v1/ai_concierge/*)
            └─ Faraday → Dify Workflow API (/v1/chat-messages, /v1/workflows/run)
```

Rails 側で会話履歴を `ai_conversations` に保存し、Dify には `inputs` として会員情報・商品コンテキスト・カート情報を渡す。

## 起動

Dify は本リポジトリの compose には含めず、公式 [langgenius/dify](https://github.com/langgenius/dify) の compose を **別ディレクトリで起動**する構成 (同一オリジン要件で同梱が困難なため)。

```bash
# 初回のみ
git clone --depth 1 https://github.com/langgenius/dify.git ~/dify
cp ~/dify/docker/.env.example ~/dify/docker/.env
# ~/dify/docker/.env を編集:
#   EXPOSE_NGINX_PORT=8080
#   EXPOSE_NGINX_SSL_PORT=8443
#   SECRET_KEY=sk-<ランダム>

# 2回目以降
cd ~/dify/docker && docker compose up -d        # 起動
cd ~/dify/docker && docker compose stop          # 停止
```

- Dify Console / Web:  http://localhost:8080
- Dify Service API:     http://localhost:8080/v1   (Rails からはこちら経由)

> 詳細手順・ポート設計の意図は [../../doc/operation.md §3](../../doc/operation.md) を参照。

## Workflow の登録 (初回)

1. Dify Console (`http://localhost:8080/install`) でアカウント作成
2. 「Studio → Create from Blank → Chatflow」で「AI接客」ワークフロー作成
3. Variables に以下を追加:
   - `member_name` (string)
   - `cart_items` (string, JSON文字列)
   - `recent_orders` (string, JSON文字列)
4. LLM ノードのモデルプロバイダ設定 (OpenAI/Anthropic 等の API キーは Dify 側で登録)
5. プロンプトに [./prompts/concierge_system.md](./prompts/concierge_system.md) を貼り付け
6. **Publish** → アプリの「API Access」画面で **API Key** を発行 (`app-xxxxxxxx`)
7. `platform/.env` に次の2行を設定:
   ```
   DIFY_API_BASE=http://host.docker.internal:8080/v1
   DIFY_API_KEY=app-xxxxxxxxxxxxxxxxxx
   ```
8. Rails を再起動: `cd platform && docker compose restart api`

## ナレッジベース (商品検索 RAG)

商品データを Dify のナレッジベースに同期するスクリプト: [./sync_knowledge.rb](./sync_knowledge.rb) (Rails runner で実行)。
