# 実装タスク — CraftFlow (つくる人のネットショップ)

コンセプト: 3Dプリント品・3Dモデルデータ・ハンドメイド作品の販売 × 受注後の制作管理 (Kanban) × 顧客管理・分析。
モダン・ミニマル(モノトーン + オレンジ1色)。本ドキュメントは残作業を整理する。仕様は [README.md](../../README.md) を参照する。

> カテゴリは **3d-prints / 3d-models / handmade / materials / custom** の5本立て。
> 旧カテゴリ (ライダーズカフェ期の coffee / parts / maintenance / system) は廃止。

---

## 残タスク (優先度順)

### P0 — デプロイ反映 (コードは実装済、実行が必要)

- [ ] **マイグレーション** — `20260911000001_add_digital_to_products` / `20260912000001_craftflow_production`
  (注文ステータスを8段階へ移行: `pending`→`received`, `delivered`→`completed`。`service_requests` の `maintenance`/`system` は `custom` へ)
  ```bash
  cd platform
  docker compose run --rm api bundle exec rails db:migrate
  ```
- [ ] **新カタログ・材料・スタッフの投入** — `db:seed` は冪等 (既存の在庫数は上書きしない。デモ注文は注文が0件のときだけ投入)
  ```bash
  docker compose run --rm api bundle exec rails db:seed
  ```
- [ ] **旧カテゴリの掃除** — 注文履歴のある旧商品は非公開にして残す
  ```bash
  docker compose run --rm api bundle exec rails legacy:cleanup_categories   # DRY_RUN=1 で事前確認
  ```
- [ ] **Nginx の再読み込み** — アップロード上限を 110MB に変更済み ([nginx.conf](../../platform/nginx/nginx.conf))
- [ ] **Dify ナレッジ・プロンプトの差し替え** — [catalog.md](../../app/ai/knowledge/catalog.md) / [faq.md](../../app/ai/knowledge/faq.md) / [concierge_system.md](../../app/ai/prompts/concierge_system.md) (CTA が `open_custom_request` / `open_contact` に変わった)

### P1 — 機能の作り込み (未着手)

- [ ] **ステータス変更・回答時の顧客通知** (発送済み・問い合わせ回答をメールで。現状は画面確認のみ)
- [ ] **オーダーメイド依頼 → 注文への変換** (見積承諾で注文を作成し、制作ボードに載せる)
- [ ] **入金後キャンセル時の在庫戻し・返金** (現状は入金前のみ仮押さえを自動解除)
- [ ] **材料の入出庫履歴** (現状は在庫数のみ。棚卸し差異の追跡用)
- [ ] **制作スタッフ向けモバイル画面** (制作ボードは現状 Web のみ)
- [ ] **AIコンシェルジュ `build_inputs` に進行中の問い合わせ (`service_requests`) を渡す**

### P2 — UI仕上げ

- [ ] 商品詳細にカテゴリ別の表示項目 (3Dプリント=素材/サイズ/積層ピッチ、レザー=革の種類 など)
- [ ] OG画像 / favicon を CraftFlow に差し替え ([app/web/src/app/favicon.ico](../../app/web/src/app/favicon.ico))
- [ ] 画像の**変換/最適化** — 現状は原本配信。`image_processing` 導入で variant 対応 (任意)
- [ ] ヘッダーのナビ: 狭い幅では横スクロールで対応中。ハンバーガーメニュー化 (任意)

### P3 — 品質 / 運用

- [ ] テスト拡充 — AIコンシェルジュCTA抽出、admin 商品系の request spec
- [ ] アクセシビリティ: 制作ボードのキーボード操作 (現状は ◀ ▶ ボタンで代替) の確認
- [ ] **モバイル**: 日時ピッカー導入 (現状 希望納期はテキスト入力)、画像表示の最適化

---

## 完了済み

### CraftFlow への刷新
- ブランドを CraftFlow — つくる人のネットショップ に変更 (Web / モバイル / AI プロンプト / ドキュメント)。バグ報告ボタンを削除
- 3Dモデルデータのダウンロード販売 (配布ファイル・期限付き署名URL・購入済みライブラリ) と 3Dプリント品の物販
- 注文ステータスを8段階の制作・発送フローに拡張 (`OrderWorkflow`: 在庫確定・材料消費・発送情報・キャンセル時の仮押さえ解除・遷移履歴)
- 制作ボード (Kanban): ドラッグ&ドロップ / ◀▶ 移動、製作担当・納期、納期遅れ・要発注材料の警告。staff ロール追加
- 材料管理: 在庫・発注点・入荷/調整、商品レシピ、制作待ち注文での使用予定と見込み在庫
- 顧客管理: 購入回数・金額・最終注文、購入履歴・よく買う商品・問い合わせ・顧客メモ
- 問い合わせ (注文ひも付け・店舗回答) / オーダーメイド依頼 (旧: 整備予約・システム開発依頼を統合)
- 売上・分析: KPI、日次売上、カテゴリ別、人気商品、工程別の件数・滞留時間・リードタイム
- 顧客の注文詳細に制作進捗のステッパー表示 (Web / モバイル)
- 送料の定数を修正 (¥50,000 → ¥500、5,000円以上で無料)

### ライダーズカフェ期 (ROUTE & ROAST)

#### コンセプト刷新 / リネーム
- UI のモダン・ミニマル刷新 (配色トークン再定義 / ヒーロー / Header / フッター / カテゴリ訴求 / ChatWidget) — Web
- 「AI接客」→「AIコンシェルジュ」へ全面リネーム (UI / プロンプト / ドキュメント / ルートコメント)
- `navi` → `system` へ統一 (カテゴリ slug / 表示名 / SKU)
- モバイルのブランド(ROUTE & ROAST)/配色をコンセプトに整合

#### カテゴリ / 検索
- seed を coffee / parts / maintenance / system に刷新し各カテゴリの商品を投入
- API `/products?category_slug=` 追加、`/search?category=<slug>` 事前選択
- トップのカテゴリカードを物販=検索 / サービス=依頼フローへ振り分け
- 旧カテゴリ掃除 rake タスク ([legacy.rake](../../app/api/lib/tasks/legacy.rake))

#### 整備予約 / システム開発依頼フロー
- `service_requests` テーブル + `ServiceRequest` モデル (kind別ステータス遷移、整備は preferred_at 必須)
- 受付API `GET/POST /service_requests`、管理API `GET/PATCH /admin/service_requests`
- Web: `/maintenance` / `/system` (CraftFlow への刷新で廃止) / [/requests](../../app/web/src/app/requests/page.tsx) / 商品詳細CTA分岐
- **Web管理画面** [/admin/requests](../../app/web/src/app/admin/requests/page.tsx) — 受付一覧・絞り込み・ステータス操作
- **モバイル** [service-request.tsx](../../app/mobile/app/service-request.tsx) / [requests.tsx](../../app/mobile/app/requests.tsx) — 予約/依頼フォームと依頼状況、ホームに導線

#### AIコンシェルジュ
- プロンプト更新 (ペルソナ・カテゴリ・整備/開発フロー誘導・CTA追加)
- ChatWidget が CTA (`open_maintenance_booking` 等) をリンク化
- ナレッジソース ([catalog.md](../../app/ai/knowledge/catalog.md) / [faq.md](../../app/ai/knowledge/faq.md)) と再生成スクリプト ([sync_knowledge.rb](../../app/ai/sync_knowledge.rb))

#### 画像アップロード基盤
- ActiveStorage 導入 (migration / schema / `Product has_one_attached :image`)
- 管理: `POST /admin/products/:id/image` でアップロード → `image_url` に配信パスを保存
- 配信は Nginx の `/rails/` プロキシ経由 (同一オリジン、インフラ変更不要)
- 管理画面の商品テーブルにサムネ + アップロードUI

#### テスト基盤
- RSpec 雛形 (`.rspec` / `spec_helper` / `rails_helper` / factory_bot / auth ヘルパ)
- `service_requests` の model spec / request spec (バリデーション・権限・kind別ステータス)
