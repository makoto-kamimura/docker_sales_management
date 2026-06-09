# 実装タスク — ライダーズカフェ刷新 (ROUTE & ROAST)

コンセプト: コーヒー × パーツ・整備・システム(ナビ/電装) を扱うライダーズカフェ。
モダン・ミニマル(モノトーン + オレンジ1色)。本ドキュメントは残作業を整理する。

> カテゴリは **coffee / parts / maintenance / system** の4本立て。旧 `tea` / `snack` / `navi` は廃止。

---

## 残タスク (優先度順)

### P0 — デプロイ反映 (コードは実装済、実行が必要)

- [ ] **マイグレーション + seed**
  ```bash
  cd platform
  docker compose run --rm api bash -c "bundle exec rails db:migrate && bundle exec rails db:seed"
  ```
  対象: `service_requests` / `products.image_url` / ActiveStorage テーブル
- [ ] **旧カテゴリの掃除** — rake タスクは実装済。実行するだけ:
  ```bash
  docker compose run --rm api bundle exec rails legacy:cleanup_categories   # DRY_RUN=1 で事前確認
  ```
- [ ] **Dify ナレッジ再アップロード** — ソースは実装済 ([app/ai/knowledge/](../app/ai/knowledge/))。
  `catalog.md` を再生成 → Dify Knowledge に `catalog.md` / `faq.md` を差し替え → 再インデックス → Publish
  (手順: [app/ai/README.md](../app/ai/README.md))

### P1 — 機能の作り込み (未着手)

- [ ] **予約確定/ステータス変更時のユーザー通知** (ActionMailer など。現状は画面確認のみ)
- [ ] **AIコンシェルジュ `build_inputs` に進行中の `service_requests` を渡す** — 依頼状況も会話で扱えるように ([messages_controller.rb](../app/api/app/controllers/api/v1/ai_concierge/messages_controller.rb))
- [ ] **カテゴリ別ランディング** `/categories/[slug]` (任意)
- [ ] **検索フィルタ拡張** — タグ(`タイヤ`/`オイル`/`ナビ`等)での絞り込みUI

### P2 — UI仕上げ (未着手)

- [ ] 商品詳細にカテゴリ別の表示項目 (パーツ=適合車種/規格、整備=所要時間、システム=対応端子 など)
- [ ] OG画像 / favicon をブランド (R&R) に差し替え ([app/web/src/app/favicon.ico](../app/web/src/app/favicon.ico))
- [ ] サブスク対象の見直し (現状コーヒー豆とオイルのみ subscribable)
- [ ] 画像の**変換/最適化** — 現状は原本配信。`image_processing` 導入で variant 対応 (任意)

### P3 — 品質 / 運用 (一部残)

- [ ] テスト拡充 — `products`(category_slug/image_url)、AIコンシェルジュCTA抽出、admin系の request spec
- [ ] seed のべき等性確認 (再実行で重複が出ないこと)
- [ ] アクセシビリティ: カテゴリカード・CTAのコントラスト/フォーカス確認
- [ ] **モバイル**: 日時ピッカー導入 (現状 `preferred_at` はテキスト入力)、画像表示の最適化

---

## 完了済み

### コンセプト刷新 / リネーム
- UI のモダン・ミニマル刷新 (配色トークン再定義 / ヒーロー / Header / フッター / カテゴリ訴求 / ChatWidget) — Web
- 「AI接客」→「AIコンシェルジュ」へ全面リネーム (UI / プロンプト / ドキュメント / ルートコメント)
- `navi` → `system` へ統一 (カテゴリ slug / 表示名 / SKU)
- モバイルのブランド(ROUTE & ROAST)/配色をコンセプトに整合

### カテゴリ / 検索
- seed を coffee / parts / maintenance / system に刷新し各カテゴリの商品を投入
- API `/products?category_slug=` 追加、`/search?category=<slug>` 事前選択
- トップのカテゴリカードを物販=検索 / サービス=依頼フローへ振り分け
- 旧カテゴリ掃除 rake タスク ([legacy.rake](../app/api/lib/tasks/legacy.rake))

### 整備予約 / システム開発依頼フロー
- `service_requests` テーブル + `ServiceRequest` モデル (kind別ステータス遷移、整備は preferred_at 必須)
- 受付API `GET/POST /service_requests`、管理API `GET/PATCH /admin/service_requests`
- Web: [/maintenance](../app/web/src/app/maintenance/page.tsx) / [/system](../app/web/src/app/system/page.tsx) / [/requests](../app/web/src/app/requests/page.tsx) / 商品詳細CTA分岐
- **Web管理画面** [/admin/requests](../app/web/src/app/admin/requests/page.tsx) — 受付一覧・絞り込み・ステータス操作
- **モバイル** [service-request.tsx](../app/mobile/app/service-request.tsx) / [requests.tsx](../app/mobile/app/requests.tsx) — 予約/依頼フォームと依頼状況、ホームに導線

### AIコンシェルジュ
- プロンプト更新 (ペルソナ・カテゴリ・整備/開発フロー誘導・CTA追加)
- ChatWidget が CTA (`open_maintenance_booking` 等) をリンク化
- ナレッジソース ([catalog.md](../app/ai/knowledge/catalog.md) / [faq.md](../app/ai/knowledge/faq.md)) と再生成スクリプト ([sync_knowledge.rb](../app/ai/sync_knowledge.rb))

### 画像アップロード基盤
- ActiveStorage 導入 (migration / schema / `Product has_one_attached :image`)
- 管理: `POST /admin/products/:id/image` でアップロード → `image_url` に配信パスを保存
- 配信は Nginx の `/rails/` プロキシ経由 (同一オリジン、インフラ変更不要)
- 管理画面の商品テーブルにサムネ + アップロードUI

### テスト基盤
- RSpec 雛形 (`.rspec` / `spec_helper` / `rails_helper` / factory_bot / auth ヘルパ)
- `service_requests` の model spec / request spec (バリデーション・権限・kind別ステータス)
