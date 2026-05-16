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

## 起動 (任意)

リポジトリ同梱の compose は `ai` プロファイルで Dify をオプション起動できる:

```bash
cd ../../platform
docker compose --profile ai up dify-api dify-web redis
```

- Dify Console: http://localhost:3002
- Dify API:     http://localhost:5001

> 本番運用や本格利用は公式の [langgenius/dify](https://github.com/langgenius/dify) リポジトリの compose を別環境で構築するのが推奨。同梱版は開発・検証用の最小構成。

## Workflow の登録 (初回)

1. Dify Console (`http://localhost:3002`) でアカウント作成
2. 「Studio → Create from Blank → Chatflow」で「AI接客」ワークフロー作成
3. Variables に以下を追加:
   - `member_name` (string)
   - `cart_items` (string, JSON文字列)
   - `recent_orders` (string, JSON文字列)
4. LLM ノードのプロンプトに [./prompts/concierge_system.md](./prompts/concierge_system.md) を貼り付け
5. 公開後、API キーを取得し `platform/.env` の `DIFY_API_KEY` に設定
6. `docker compose restart api`

## ナレッジベース (商品検索 RAG)

商品データを Dify のナレッジベースに同期するスクリプト: [./sync_knowledge.rb](./sync_knowledge.rb) (Rails runner で実行)。
