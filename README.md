# CraftFlow（docker_sales_management）

> **つくって、売って、届けるまでを、ひとつの流れで。**

**CraftFlow — つくる人のネットショップ**。3Dプリント品・3Dモデルデータ・ハンドメイド作品を販売し、受注後の**制作**（制作ステータスの Kanban・製作担当・材料管理）から**発送**、**顧客管理**、**売上分析**までを一つの流れで扱う、フルスタック・マルチクライアントアプリ。Shopify 的な販売管理 × Trello 的な制作管理。

> **CraftFlow** は本システムの呼称である（旧称：販売管理システム）。リポジトリ名・パッケージ名・Docker サービス名などの識別子は変更していない。

## コンセプト

受注してから作る作品のショップでは、注文を受けるネットショップと、制作の進み具合を管理するボードや表が別々になりがちである。その結果、注文が入るたびに制作側へ転記し、材料の残りは勘で把握し、購入者からの「いまどうなっていますか」には店舗が個別に答えることになる。

CraftFlow は、**注文を唯一の正本にして、制作・発送・顧客対応・分析をすべてその注文から見る**ことで、この手間をなくす。

| 考え方 | 内容 |
|---|---|
| 注文が、そのまま制作のカードになる | 注文は8段階の工程を持ち、制作ボード（Kanban）の列として並ぶ。転記しない |
| 進み具合は、購入者にも見える | 購入者は注文詳細のステッパーで、いまの工程を確認できる |
| 材料は、作った分だけ減る | 商品ごとのレシピに従い、「制作中」へ進めた時点で材料在庫を消費する。発注点を下回ると警告する |
| データも、作品と同じ棚で売る | 3Dモデルデータのダウンロード販売と、完成品の物販を同じカート・注文で扱う |
| 店舗の役割ごとに、見せる画面を分ける | スタッフには「販売」「制作」「注文」の権限を組み合わせて付け、必要な管理画面だけを見せる |

| 項目 | 内容 |
|---|---|
| ステータス | **実装済み・公開環境で運用中**（残りの作業は [docs/tasks/task.md](docs/tasks/task.md)、今後の予定は[第17章](#17-今後の予定)） |
| 作成者 | **Makoto Kamimura** — [@makoto-kamimura](https://github.com/makoto-kamimura) |
| ライセンス | [MIT](LICENSE) |

このREADMEは、プロジェクト紹介と仕様書を兼ね、次の2部と付録で構成する。仕様書以外の資料（運用手順・タスクなど）は [docs/](docs/README.md) に置く。

| 部 | 内容 | 主な読者 |
|---|---|---|
| [第1部 概要説明](#第1部-概要説明) | サービスの目的、機能と画面の仕様、今後の予定 | すべての人 |
| [第2部 技術説明](#第2部-技術説明) | 技術スタック、システム構成、クイックスタート、実装方針、データモデル、API、非機能要件 | 開発者 |
| [付録](#付録) | 決定事項、未決事項 | すべての人 |

## 目次

- [コンセプト](#コンセプト)
- [第1部 概要説明](#第1部-概要説明)
  - [特徴](#特徴) / [使い方のイメージ](#使い方のイメージ)
  - [1. 概要](#1-概要) / [2. 用語](#2-用語) / [3. 利用者とロール・権限](#3-利用者とロール権限) / [4. 基本フロー](#4-基本フロー) / [5. 画面一覧](#5-画面一覧)
  - [6. 会員・認証](#6-会員認証) / [7. 商品・カテゴリ・検索](#7-商品カテゴリ検索) / [8. カート・注文・料金](#8-カート注文料金) / [9. 注文ステータスと制作フロー](#9-注文ステータスと制作フロー)
  - [10. 3Dデータ販売](#10-3dデータ販売) / [11. 3Dモデル管理](#11-3dモデル管理) / [12. 投げ銭（0円販売）](#12-投げ銭0円販売) / [13. 問い合わせ・オーダーメイド依頼](#13-問い合わせオーダーメイド依頼)
  - [14. サブスクリプション](#14-サブスクリプション) / [15. AIコンシェルジュ](#15-aiコンシェルジュ) / [16. 管理機能](#16-管理機能) / [17. 今後の予定](#17-今後の予定)
- [第2部 技術説明](#第2部-技術説明)
  - [18. 技術スタックとシステム構成](#18-技術スタックとシステム構成)（[クイックスタート](#185-クイックスタート)を含む）
  - [19. 認証の実装](#19-認証の実装) / [20. 機能ごとの実装方針](#20-機能ごとの実装方針) / [21. データモデル](#21-データモデル) / [22. API](#22-api) / [23. 非機能要件](#23-非機能要件)
- [付録](#付録)
  - [24. 決定事項](#24-決定事項) / [25. 未決事項](#25-未決事項)

---

# 第1部 概要説明

サービスの目的・機能・画面の仕様をまとめる。技術的な内容は[第2部](#第2部-技術説明)に分ける。

## 特徴

| 特徴 | 内容 |
|---|---|
| 物販とデータ販売を1つのカートで | 3Dプリント品・ハンドメイド雑貨・素材キットの物販と、3Dモデルデータのダウンロード販売を同じ注文で扱う。データだけの注文は配送先・送料が要らない |
| 制作ボード（Kanban） | 注文を工程ごとの列に並べ、ドラッグ&ドロップで進める。製作担当・納期を設定でき、納期遅れを強調する |
| 材料管理とレシピ | 材料の在庫・発注点を管理し、商品ごとのレシピに従って「制作中」で自動的に消費する。制作待ちの注文から見込み在庫を出す |
| 制作状況の見える化 | 購入者は注文詳細のステッパーで、いまの工程と配送情報を確認できる |
| 3Dモデル管理 | モデルファイルの版管理、ブラウザでの3Dプレビュー、写真、組み立て方法の登録と組み立て説明書 PDF の出力。販売フラグでショップの商品と連動する |
| 投げ銭 | 0円で配布した作品を含む注文に、購入者が任意の金額で投げ銭できる |
| 問い合わせ・オーダーメイド依頼 | 注文についての問い合わせと、名入れ・一点ものの制作依頼を受け付け、店舗が回答する |
| サブスクリプション | フィラメントなどの消耗品を、毎週・隔週・月1回の割引価格で定期お届けする |
| 顧客管理と売上分析 | 購入履歴・よく買う商品・顧客メモ。売上・リピート率に加え、工程ごとの滞留時間・リードタイムを分析する |
| AIコンシェルジュ | カートや注文の状況を踏まえて、作品の提案や制作状況を案内するチャット（Dify） |
| 権限で分ける管理画面 | スタッフに「販売」「制作」「注文」の権限を組み合わせて付与し、使える管理画面と API を切り替える |

## 使い方のイメージ

```mermaid
flowchart LR
  A["店舗が<br/>商品を登録する"] --> B["購入者が<br/>カートから注文する"]
  B --> C["入金を確認する"]
  C --> D["制作ボードで<br/>制作・検品する"]
  D --> E["発送して<br/>追跡番号を知らせる"]
  E --> F["売上と工程の<br/>滞留時間を分析する"]
```

## 1. 概要

### 1.1 ポジショニング

販売（EC）・制作（タスク管理）・顧客（CRM）の3つを、**注文**を中心につなぐ。

```text
                    CraftFlow
       ┌────────────────┼────────────────┐
     販売              制作              顧客
   商品管理        制作ステータス      顧客管理
   カート          製作担当           購入履歴
   決済            材料管理           問い合わせ
       └────────────────┼────────────────┘
                     注文管理
                  ┌─────┴─────┐
                発送         売上 → 分析
```

| 取り込み元 | 取り込む要素 | 本サービスでの形 |
|---|---|---|
| Shopify 的な販売管理 | 商品・カテゴリ・在庫、カート・決済、サブスク、売上分析 | [第7〜8章](#7-商品カテゴリ検索)、[第14章](#14-サブスクリプション)、[16.6節](#166-売上分析) |
| Trello 的な制作管理 | 工程ごとの列、カードの移動、担当・期限 | [第9章](#9-注文ステータスと制作フロー)、[16.1節](#161-制作ボード) |
| 独自 | 3Dモデルデータ・DIY設計図の版管理と販売、組み立て説明書、材料のレシピ消費、投げ銭 | [第10〜12章](#10-3dデータ販売)、[16.2節](#162-材料管理) |

### 1.2 取り扱いカテゴリ

| カテゴリ（slug） | 名称 | 販売方法 |
|---|---|---|
| `3d-prints` | 3Dプリント品 | 物販（在庫・配送あり） |
| `3d-models` | 3Dモデルデータ | ダウンロード販売（在庫・配送なし） |
| `diy-plans` | DIY設計図 | ダウンロード販売（在庫・配送なし）。[3Dモデル管理](#11-3dモデル管理)の種別「DIY設計図」から販売する（[11.3節](#113-diy設計図)） |
| `handmade` | ハンドメイド雑貨 | 物販 |
| `materials` | 素材・キット | 物販（サブスク対象にもできる） |
| `custom` | オーダーメイド | 依頼制。カートには入らず依頼フォームへ誘導する（[第13章](#13-問い合わせオーダーメイド依頼)） |

## 2. 用語

| 用語 | 定義 |
|---|---|
| 物販品 | 在庫を持ち、配送する商品（3Dプリント品・ハンドメイド雑貨・素材キット） |
| デジタル商品 | ダウンロードで販売する商品（3Dモデルデータ）。在庫・配送を持たず、1ライセンス単位で数量は常に1 |
| 配布ファイル | デジタル商品の購入者がダウンロードするファイル。恒久 URL は公開せず、期限付きの URL だけを払い出す |
| 注文ステータス（工程） | 注文の進み具合。注文受付 → 入金確認 → 制作待ち → 制作中 → 検品 → 発送準備 → 発送済み → 完了（＋キャンセル）の8段階（[第9章](#9-注文ステータスと制作フロー)） |
| 仮押さえ | 注文確定時に物販品の販売在庫を確保すること。入金確認で確定出庫し、入金前のキャンセルで解除する |
| 制作ボード | 注文を工程ごとの列に並べた Kanban |
| 製作担当 | 注文を制作するスタッフ。制作権限を持つスタッフと管理者だけを指定できる |
| 納期 / 納期遅れ | 注文ごとに設定する完成予定日。過ぎても完了していない注文を「納期遅れ」として強調する |
| 材料 | 制作に使う消耗品（フィラメント・革など）。販売在庫とは別に在庫を持つ |
| レシピ | 商品1個あたりに使う材料と数量 |
| 発注点 / 要発注 | 材料在庫の下限。在庫が発注点以下の材料を「要発注」として警告する |
| 3Dモデル | 管理画面で管理するモデルファイルのまとまり。版・写真・組み立て方法を持つ |
| 版 | 3Dモデルのファイル一式の履歴。登録するたびに v1, v2… と重ね、最大の版が最新版 |
| 販売フラグ | 3Dモデルをショップの商品（デジタル商品）として公開するかどうか |
| プレビュー写真（★） | 3Dモデルの写真のうち、一覧・商品ページに表示するもの。モデルごとに最大3枚 |
| 組み立て方法 / 組み立て説明書 | 必要な部品・工具と手順の登録内容 / それを A4 にまとめた PDF |
| 投げ銭 | 0円の商品を含む注文に、購入者が任意の金額で申し込む応援（[第12章](#12-投げ銭0円販売)） |
| 問い合わせ / オーダーメイド依頼 | 注文などについての質問（`inquiry`） / 名入れ・一点ものの制作依頼（`custom`） |
| サブスク | 対象商品の定期お届け（[第14章](#14-サブスクリプション)） |
| CTA | AIコンシェルジュの応答末尾に付く `[CTA: action]`。画面のアクションボタンに変える |

## 3. 利用者とロール・権限

### 3.1 利用者

| 利用者 | ロール | できること |
|---|---|---|
| ゲスト | （未ログイン） | 商品の閲覧・検索、AIコンシェルジュ |
| 会員 | `member` | ＋ 注文・決済、サブスク、プロフィール / 住所 / 支払い方法、問い合わせ・オーダーメイド依頼、購入済み3Dデータのダウンロード、制作状況の確認 |
| スタッフ | `staff` | 付与された権限（[3.2節](#32-スタッフの権限)）の管理画面のみ。権限が1つもなければ管理画面は使えない |
| 管理者 | `admin` | すべての権限 ＋ スタッフ権限の設定 |

### 3.2 スタッフの権限

スタッフにはユーザーごとに次の権限を組み合わせて付与する。管理画面のメニュー・各画面・API の可否はすべて権限で切り替わり、権限のない API は `403`（例：`販売の権限が必要です`）を返す。

| 権限 | 使える管理画面 |
|---|---|
| 販売（`sales`） | 商品管理（商品 CRUD・画像・3Dデータ・在庫）、売上・分析 |
| 制作（`production`） | 制作ボード、材料管理・レシピ、3Dモデル（ファイル・版・3Dプレビュー・販売フラグ・組み立て方法）。製作担当に指定できる |
| 注文（`orders`） | 注文管理・発送、顧客管理、問い合わせ対応、投げ銭の入金確認（注文の担当割り当ても可） |

- 権限の設定は管理画面「設定 › スタッフ権限」（管理者のみ）。会員を名前・メールで検索してスタッフにし、チェックボックスで権限を付け外しする。
- 自分自身のロールは変更できない（管理者が不在になるのを防ぐ）。会員に戻すと権限はすべて外れる。管理者への昇格は確認ダイアログを出す。
- 権限の変更は API に即時反映される。対象ユーザーの画面のメニューは再読み込み時に切り替わる（起動時に `GET /me` で最新の権限を取得する）。
- 製作担当に指定できるのは制作権限を持つスタッフと管理者。権限を外されたスタッフが担当の注文も、工程は引き続き進められる（担当を付け替えるときだけ検証する）。

## 4. 基本フロー

### 4.1 購入する（会員）

1. 商品を検索し、カートに入れる（オーダーメイドは[4.4節](#44-問い合わせオーダーメイド依頼をする会員)の依頼フォームへ）。
2. 配送先と支払い方法を選んで注文を確定する。物販品の在庫が仮押さえされる。
3. 注文詳細のステッパーで、制作の進み具合と配送情報を確認する。
4. 3Dモデルデータは、入金確認以降に注文詳細・アカウント画面からダウンロードする（組み立て説明書 PDF も）。

### 4.2 注文を制作して発送する（店舗）

1. 入金を確認する。Stripe の決済が成功した注文は自動で「入金確認」になり、振込などは注文権限のスタッフが確認して進める。
2. 制作ボードで、注文のカードを「制作待ち」→「制作中」へ移す。レシピに従い材料在庫が減る。
3. 検品・発送準備を経て、配送業者・追跡番号を入力して「発送済み」にする。
4. 配達を確認したら「完了」にする。デジタル商品だけの注文は、入金確認と同時に自動で完了する。

### 4.3 3Dモデルを販売する（店舗）

1. 管理画面「制作 › 3Dモデル」でモデルファイルを登録する（初版）。
2. 3Dプレビューからプレビュー画像を保存し、実物・利用中の写真を追加して ★ を付ける。
3. （任意）組み立て方法を登録する。Markdown ファイル1つからまとめて取り込める。
4. 価格・利用許諾を入れて販売フラグをオンにする。ショップの「3Dモデルデータ」に商品が作られる。
5. 修正したファイルは新しい版として登録する。販売中なら配布ファイルも差し替わる。

### 4.4 問い合わせ・オーダーメイド依頼をする（会員）

1. 注文詳細の「問い合わせ」、またはオーダーメイド依頼フォームから送る。
2. 店舗（注文権限）が回答し、ステータスを進める。
3. 会員は「問い合わせ・依頼」の画面で回答を確認する。

### 4.5 サブスクを購読する（会員）

1. サブスク対象の商品とプラン（毎週・隔週・月1回）を選び、配送先・支払い方法を指定する。
2. 必要に応じて一時停止・再開・次回スキップ・お届け日や配送先の変更・解約をする。

## 5. 画面一覧

### 5.1 Web（顧客向け）

| パス | 画面 |
|---|---|
| `/` | トップ（取り扱いカテゴリ・制作工程の見える化の紹介・新着商品） |
| `/search` | 商品検索（キーワード・カテゴリ・価格帯） |
| `/3d` | 3Dプリント品・3Dモデルデータの一覧 |
| `/products/[id]` | 商品詳細（在庫・利用許諾・ファイル形式、カート投入。3Dモデルの商品は実モデル画像・実利用画像（最大3枚）を切り替えて表示） |
| `/custom` | オーダーメイド依頼フォーム |
| `/contact` | 問い合わせフォーム（注文詳細から開くと対象の注文つき） |
| `/cart` / `/checkout` | カート / 配送先・支払い方法を選んで注文確定 |
| `/orders` / `/orders/[id]` | 注文履歴 / 注文詳細（工程のステッパー・配送情報・3Dデータと組み立て説明書 PDF のダウンロード・0円の商品を含む注文の投げ銭） |
| `/requests` | 自分の問い合わせ・依頼と店舗の回答 |
| `/subscriptions` | サブスクの購読・一時停止・再開・スキップ・解約 |
| `/account` | プロフィール・住所・購入済みデジタルデータ（組み立て説明書つき）・ロール / 権限の表示 |
| `/login` / `/register` | ログイン / 会員登録 |
| （全画面右下） | AIコンシェルジュのチャット |

### 5.2 Web（管理画面 `/admin`）

権限に応じて、最初に使える画面へ移動する。

| グループ（権限） | パス | 画面 |
|---|---|---|
| 販売 | `/admin/products` | 商品管理（登録・編集・削除、画像、3Dデータ、在庫数） |
| 販売 | `/admin/dashboard` | 売上・分析 |
| 制作 | `/admin/production` | 制作ボード（Kanban） |
| 制作 | `/admin/materials` | 材料管理・商品レシピ |
| 制作 | `/admin/models` / `/admin/models/[id]` | 3Dモデル一覧（プレビュー写真） / 詳細（3Dプレビュー・基本情報・販売フラグ・写真・版管理・組み立て方法と PDF 出力） |
| 制作 | `/admin/blueprints` / `/admin/blueprints/[id]` | DIY設計図一覧 / 詳細（図面・3Dプレビュー（PDF・画像・DXF と完成品の3Dデータ）のほかは3Dモデルと同じ） |
| 注文 | `/admin/orders` / `/admin/orders/[id]` | 注文一覧 / 注文詳細（ステータス変更・発送情報・担当・納期・履歴） |
| 注文 | `/admin/customers` / `/admin/customers/[id]` | 顧客一覧 / 顧客詳細（購入履歴・よく買う商品・問い合わせ・顧客メモ） |
| 注文 | `/admin/requests` | 問い合わせ・オーダーメイド依頼への回答・ステータス変更 |
| 注文 | `/admin/tips` | 投げ銭（入金待ち・入金確認済みの合計、入金確認・取り消し） |
| 設定（管理者） | `/admin/users` | スタッフ権限 |

### 5.3 モバイルアプリ

Expo で作る**顧客向け**のアプリ。管理画面は Web のみとする。

| 画面 | 内容 |
|---|---|
| タブ | ホーム / 検索 / カート / サブスク / AIコンシェルジュ / アカウント |
| その他 | ログイン・会員登録・商品詳細・注文確定・注文詳細（3Dデータ・組み立て説明書のダウンロード、投げ銭を含む）・問い合わせ / 依頼の作成と一覧 |

## 6. 会員・認証

- メールアドレス・パスワード・名前で会員登録し、ログインで JWT を受け取る（アクセストークン1時間 / リフレッシュトークン7日。[第19章](#19-認証の実装)）。
- メールアドレスは大文字小文字を区別せず一意。パスワードは bcrypt で保存する。
- プロフィール（名前・メール）の変更、住所の登録（既定の住所を1つ指定）、支払い方法（Stripe）の登録・削除ができる。
- 会員登録時にカートが1つ作られる。

## 7. 商品・カテゴリ・検索

カテゴリは[1.2節](#12-取り扱いカテゴリ)のとおり。

- 公開日（`published_at`）を過ぎた商品だけを一覧に出す。
- キーワード検索は名前（重み大）・説明を対象に、pg_trgm の類似度（typo に強い）と前方一致の全文検索を組み合わせる。
- 絞り込み：カテゴリ（id / slug）・価格帯・タグ。並び替え：価格の安い順 / 高い順・新着順（タグ・並び替えは API のみ）。ページングは `page` / `per`（最大100）と `X-Total-Count` ヘッダー。
- ベクトル検索（`GET /products/search`）：問い合わせ文を埋め込み（text-embedding-3-small 相当、1536次元）にし、pgvector のコサイン距離で近い商品を最大20件返す。
- 在庫表示：物販品は `在庫数 - 仮押さえ数` が1以上で購入可。3Dモデルデータは配布ファイルが登録済みなら購入可。

## 8. カート・注文・料金

- カートの数量は1〜99。3Dモデルデータは1ライセンス単位のため常に1。購入済みのデータはカートに入れられない。
- 注文確定時に在庫を検証し、物販品は在庫を**仮押さえ**（reserved）する。カートは空になる。
- 物販品を含む注文は配送先が必須。3Dモデルデータのみの注文は配送先が要らない。

料金（JPY）：

| 項目 | 計算 |
|---|---|
| 小計 | 単価 × 数量の合計 |
| 消費税 | 小計 × 10%（四捨五入） |
| 送料 | 500円。小計5,000円以上、またはデジタル商品のみの注文は0円 |
| 合計 | 小計 ＋ 消費税 ＋ 送料 |

- 決済：支払い方法を選び Stripe の顧客が紐づいていれば PaymentIntent を作成し、成功すると自動で「入金確認」へ進む。それ以外（振込など）は「注文受付」のまま、店舗が入金を確認して進める。決済に失敗しても注文は残り、キャンセルで在庫の仮押さえを解除する。
- 合計0円の注文（無料配布の商品だけ）は支払いがないため、入金確認を省略する（デジタル商品だけならそのまま完了し、すぐダウンロードできる）。

## 9. 注文ステータスと制作フロー

注文ごとに次の工程を持ち、制作ボード（[16.1節](#161-制作ボード)）の列として見える化する。

```text
注文受付 → 入金確認 → 制作待ち → 制作中 → 検品 → 発送準備 → 発送済み → 完了   (+ キャンセル)
received   paid       awaiting_   in_        inspection ready_to_  shipped    completed
                      production  production            ship
```

| 遷移 | 自動で行われること |
|---|---|
| → 入金確認 | 物販品の仮押さえを確定出庫する。**デジタル商品のみの注文は自動で「完了」** |
| → 制作中 | 商品のレシピ × 数量ぶん材料在庫を消費する（1注文1回。差し戻しても再消費しない） |
| → 発送済み | 配送業者・追跡番号を記録し、顧客の注文詳細に表示する |
| → 完了 | 配送を「配達完了」にする |
| → キャンセル | 入金前なら在庫の仮押さえを解除する（入金後の返品・返金は店舗で個別対応） |

- 工程は飛ばす・戻すことができる。ただし**入金確認前は制作・発送へ進めない**、キャンセル済みは変更不可、注文受付へは戻せない（いずれも `422`）。
- 注文ごとに製作担当と納期を設定できる。納期を過ぎた未完了の注文は「納期遅れ」として強調する。
- すべての遷移・担当変更は操作者つきで履歴（`order_events`）に残し、注文詳細と分析（リードタイム・工程ごとの滞留時間）に使う。
- 顧客は注文詳細で現在の工程をステッパー表示で確認できる（デジタル商品のみの注文は 注文受付 → 入金確認 → 完了）。

## 10. 3Dデータ販売

- 3Dモデルデータ・DIY設計図は商品を「デジタル商品」にし、配布ファイル（3Dモデル：STL / 3MF / OBJ / STEP / ZIP、DIY設計図：PDF / PNG / JPG / SVG / DXF / DWG / JWW と完成品の3Dデータ STL / OBJ / 3MF、最大100MB）を登録すると販売可能になる。サブスク対象外。
- 商品ごとに利用許諾（例：個人利用のみ・再配布不可）を表示する。
- 入金確認以降の注文に含まれるデータだけをダウンロードできる。再購入は不可、再ダウンロードは何度でも可（注文詳細・アカウント画面から）。
- ダウンロード URL は購入者本人にのみ、有効期限5分の署名付き URL として払い出す。配布ファイルの恒久 URL は公開しない。未購入・未払い・他人の注文の商品は `404`。
- プリント品（`3d-prints`）は当店で出力した完成品として、通常の物販品と同じく在庫管理・配送する。
- [3Dモデル管理](#11-3dモデル管理)で販売フラグをオンにしたモデルは、この仕組みで販売する（最新版のファイルを配布）。組み立て手順が登録されていれば、購入者は組み立て説明書（PDF）もダウンロードできる。

## 11. 3Dモデル管理

制作権限のユーザーが管理画面「制作 › 3Dモデル」で使う。DIY の設計図（図面）も同じ仕組みで、種別「DIY設計図」として「制作 › DIY設計図」で管理する（[11.3節](#113-diy設計図)）。

### 11.1 機能

| 機能 | 内容 |
|---|---|
| ファイルの保存 | STL / 3MF / OBJ / STEP / ZIP を登録する。1つの版に複数のファイル（パーツごとの STL など、20個・合計100MBまで）をまとめて保存できる。名前・説明・利用許諾を持つ |
| 3Dプレビュー | STL / OBJ / 3MF をブラウザで回転・拡大・移動して確認する（three.js）。向きの切り替え（Z 軸が上 / Y 軸が上）・視点のリセットができる。いまの表示をプレビュー画像（PNG）として保存し、一覧・組み立て説明書の表紙・ショップの商品画像に使う。STEP / ZIP はダウンロードのみ |
| 写真 | 「実モデル画像」（出力・組み立てた実物）と「実利用画像」（使っている様子）を種類ごとに複数枚（各20枚まで・JPEG / PNG / WebP・10MBまで）登録する。保存前にブラウザで長辺1920pxの JPEG に縮小し、位置情報などの EXIF を取り除く。説明の入力・並び替え・種類の変更・削除ができる。★ を付けた写真（**最大3枚**）を3Dモデル一覧のカード・詳細・ショップの商品ページでプレビュー表示する（追加時に3枚に満たなければ自動で ★）。販売中は ★ の1枚目を商品画像にする |
| 版管理 | 新しいファイル（複数可）を登録するたびに v1, v2… と版を重ね、最新版を「最新」とする。変更内容のメモ・登録者・日時を記録する。過去の版もファイルごとにプレビュー・ダウンロードでき、複数ファイルの版は ZIP でまとめてダウンロードできる。「この版に戻す」はその版のファイル一式で新しい版を作る（履歴は消さない）。**ファイルを追加**すると、最新版のファイル（再アップロードなし）に選んだファイルを足した枝番の版を作る（v3 → v3.1 → v3.2。上限は引き継いだファイルも含めて数える）。版のファイルは後から変えない。通常の新しい版と「この版に戻す」は次の整数の版（v4）になる |
| ファイルのカテゴリ | 版のファイルを「**オールインワン**」（1ファイルにまとめたデータ）・「**分割**」（パーツ・部材ごとのファイル）・「**その他**」（図面・説明書など）に分けて登録できる（登録フォームのカテゴリごとのファイル欄。どれか1つ以上）。オールインワン・分割のファイルがある版は、プレビューをカテゴリのタブで切り替え（最初はオールインワン → 分割 → その他の順でファイルのあるもの。分割のタブは3Dのファイルを並べて表示）、版の一覧もカテゴリごとに分けて表示する。カテゴリはファイルへのラベルなので、登録済みの版でも「カテゴリを変更」で変えられる（ファイルは変わらない）。ファイル追加・「この版に戻す」はカテゴリも引き継ぐ。未分類の既存ファイルは「その他」 |
| 販売フラグ | オンにするとショップの「3Dモデルデータ」に商品（SKU `MDL-<モデルID>`）を作成・公開し、最新版のファイルを購入者への配布ファイルにする（複数ファイルの版は `<モデル名>_v<版>.zip` にまとめる。カテゴリのある版は ZIP 内を `オールインワン/`・`分割/` のフォルダに分け、その他はルートに置く。カテゴリを変えると ZIP を作り直して差し替える）。名前・説明・価格・利用許諾・画像（★ の写真の1枚目、なければ3Dプレビュー画像）を商品に反映し、版の追加にも追従する。オンにするにはファイルが必要。価格を0円にすると無料配布になり、購入者は[投げ銭](#12-投げ銭0円販売)で応援できる。オフで非公開にする（購入済みの人は引き続きダウンロードできる） |
| 組み立て方法 | 必要な部品・工具と、手順（見出し・説明・画像）を登録する。手順は並び替え・編集・削除でき、画像は PNG / JPEG（5MBまで）。部品・工具と手順の説明は **Markdown**（GFM：見出し・太字・箇条書き・番号リスト・引用・コード・表・リンク・取り消し線。改行はそのまま反映）で書け、入力欄の横（狭い画面はタブ切り替え）のプレビューで確認できる。登録済みの手順も整形して表示する（生の HTML と画像は表示しない）。**Markdown ファイル1つから部品・工具と手順をまとめて取り込める**（[11.2節](#112-markdown-ファイルからの取り込み)） |
| 組み立て説明書 PDF | A4 の PDF（モデル名・版・出力日、プレビュー画像、説明、部品・工具、STEP ごとの見出し・説明・画像、ページ番号）を出力する。Markdown は PDF でも見出し・リスト・引用・コード・表として整形する（日本語フォントに太字・斜体がないため、太字は濃い茶色・斜体は薄い色で表す）。管理画面から出力でき、販売中のモデルを購入した人は注文詳細・アカウント画面（モバイルは注文詳細）から期限付きリンク（5分）でダウンロードできる |

- 3Dモデルを削除すると版と手順も削除する。連動する商品は注文から参照されるため削除せず、非公開にする。
- 日本語は IPAex ゴシックで PDF に埋め込む（[20.5節](#205-組み立て説明書-pdf)）。

### 11.2 Markdown ファイルからの取り込み

組み立て方法の「Markdown ファイルから取り込む」で .md ファイル（1MBまで・UTF-8）を選ぶと、取り込む内容をプレビューしてから「いまの手順の後ろに追加」または「置き換え」で登録する。

```markdown
# ギアボックス              ← 1つだけの # 見出しはタイトルとして使わない

## 必要な部品・工具          ← 「部品」「工具」「材料」「用意するもの」などを含む見出しの下 → 必要な部品・工具
- M3×10 ネジ 4本

## 組み立て手順              ← 「手順」「組み立て」「作り方」「Steps」などを含む見出し
### STEP 1: 土台に軸を差し込む ← その下の小見出しが1つずつ手順 (「STEP 1」「1.」などの番号は外す)
ベースに**奥まで**差し込みます。 ← 小見出しの下 (さらに深い見出しを含む) が手順の説明
```

- 手順の見出しの下に小見出しがなければ、番号付き / 箇条書きの項目を1つずつ手順（説明のみ）にする。
- 「手順」の見出しがなければ、部品・工具以外の見出しをそれぞれ手順にする（プレビューに注意を表示）。
- コードブロック内の `#` は見出しとみなさない。画像は取り込まないので、手順ごとに画像欄から登録する。手順は100件まで。
- 部品・工具はファイルにあるときだけ更新する（追加なら後ろに追記、置き換えなら上書き）。

### 11.3 DIY設計図

家具・棚などを自分で作るための図面を、3Dモデルと同じ仕組み（版管理・写真・組み立て方法と PDF・販売フラグ・購入者への配布）で保存する。3Dモデルとは種別（`kind`）で区別し、作成後に種別は変えられない。違いは次のとおり。

| 項目 | 3Dモデル（`model`） | DIY設計図（`blueprint`） |
|---|---|---|
| 管理画面 | 制作 › 3Dモデル（`/admin/models`） | 制作 › DIY設計図（`/admin/blueprints`） |
| 登録できる形式 | STL / 3MF / OBJ / STEP / ZIP | 図面：PDF / PNG / JPG / SVG / DXF / DWG / JWW、完成品の3Dデータ：STL / OBJ / 3MF |
| ブラウザでのプレビュー | STL / OBJ / 3MF（three.js で 3D 表示） | PDF（ブラウザ内蔵のビューア）、PNG / JPG / SVG（拡大・移動）、DXF（`dxf-viewer` で描画。文字は IPAex ゴシック）、STL / OBJ / 3MF（3Dモデルと同じ 3D 表示。全データプレビューは3Dのファイルだけを並べる）。DWG / JWW はダウンロードのみ |
| プレビュー画像の保存 | 3D 表示から保存 | 画像・DXF・3D の表示から保存。PDF は保存できないので、写真に ★ を付けて商品画像にする |
| 販売先カテゴリ・SKU | `3d-models`（3Dモデルデータ）、`MDL-<id>` | `diy-plans`（DIY設計図）、`DIY-<id>` |

- 1つの版に複数の図面（全体図の PDF と部材ごとの DXF など）をまとめられ、販売時は ZIP にまとめて配布する。ファイルのカテゴリも3Dモデルと同じで、部材ごとの DXF を「分割」、全体図を「オールインワン」などに分けられる。
- SketchUp や Fusion などから書き出した**完成品の3Dデータ**を図面と同じ版に登録すると、DIY品そのものを3Dで確認できる。詳細画面は3Dのファイルがあればそれを最初に表示する。3Dデータも ZIP に含めて購入者に配布する（GLB / glTF は非対応）。
- DXF の文字コードは、UTF-8 として読めなければ Shift_JIS（JW-CAD などが出力する古い形式）とみなす。
- `diy-plans` カテゴリはマイグレーションで作成する（本番で `db:seed` を実行しなくても販売できる）。

## 12. 投げ銭（0円販売）

0円で販売した商品（3Dモデルの無料配布など）を含む注文では、購入者が任意で「投げ銭」で応援できる。カード決済は使わず、通常の注文と同じく入金（振込など）を店舗が確認する。

| 立場 | できること |
|---|---|
| 購入者 | 注文詳細（Web / モバイル）で金額（100・300・500・1,000円、Web は100〜100,000円の自由入力も可）とメッセージ（500文字まで）を選んで申し込む。同じ注文に何度でも申し込め、入金待ちのうちは取り消せる。申し込み後はショップから支払い方法（振込先など）を連絡する |
| 店舗（注文権限） | 管理画面「注文 › 投げ銭」で入金待ち・入金確認済みの件数と合計を確認し、入金確認・取り消し・入金待ちに戻すができる。注文詳細にも投げ銭と操作を表示する（確認した人・日時を記録） |

- 対象はキャンセルされていない、単価0円の明細を含む注文。有料の商品だけの注文には投げ銭できない。3Dモデルの販売フラグは価格0円（無料配布）でもオンにできる。
- 状態：入金待ち（`pending`）→ 入金確認済み（`paid`） / 取り消し（`cancelled`）。入金確認済みは購入者から取り消せない。
- 投げ銭は売上分析（注文の売上）には含めず、投げ銭の画面で別に集計する。

## 13. 問い合わせ・オーダーメイド依頼

| 種別 | 入力 | ステータス |
|---|---|---|
| 問い合わせ（`inquiry`） | 件名（必須）・本文・対象の注文（自分の注文のみ）・連絡先電話 | 未対応 → 回答済み → クローズ |
| オーダーメイド依頼（`custom`） | 作りたいもの・本文・参考商品・希望納期・予算・連絡先電話 | 未対応 → 見積もり済み → 制作中 → 完了 / キャンセル |

- 作成時のステータスは常に「未対応」。店舗（注文権限）が回答すると顧客の一覧に表示され、未対応の問い合わせは回答と同時に「回答済み」になる。
- 種別ごとに使えないステータスへは変更できない。

## 14. サブスクリプション

| プラン | お届け間隔 | 割引 |
|---|---|---|
| 毎週お届け（`weekly`） | 7日 | 5% |
| 隔週お届け（`biweekly`） | 14日 | 8% |
| 月1回お届け（`monthly`） | 30日 | 12% |

- サブスク対象の商品（フィラメントなど）だけ購読できる。数量1〜10、配送先必須。次回お届け日は購読日 ＋ 間隔。
- 一時停止・再開・次回お届け日の変更・配送先の変更・次回スキップ（次回日を1間隔後ろへ）・解約ができる。
- 支払い方法と Stripe の顧客があれば、割引後の単価で Stripe のサブスクリプションを作成する。

## 15. AIコンシェルジュ

- Web は全画面右下のチャット、モバイルは専用タブ。ゲストも利用できる。
- 発話ごとに Dify（Chatflow）を呼び出し、会員名・カートの中身・直近3件の注文（ステータスを含む）を文脈として渡す。作品の提案や制作状況の案内に使う。
- 会話履歴は API 側に保存し、Dify の会話 ID を引き継ぐ。応答末尾の `[CTA: action]` は画面のアクションボタンとして切り出す。
- 商品・FAQ のナレッジは [app/ai/knowledge/](app/ai/knowledge/) から Dify に同期する。Dify が未起動・未設定でも他の機能は動き、チャットだけ `502 ai_unavailable` を返す（接続は[18.6節](#186-difyaiコンシェルジュの接続)）。

## 16. 管理機能

### 16.1 制作ボード

制作権限で使う。

- 注文を工程ごとの列に並べた Kanban。ドラッグ&ドロップ、または ◀ ▶ ボタン（タッチ・キーボード操作用）で工程を移動する。
- カードに顧客・商品・納期（遅れは赤）・データのみの注文・担当を表示し、担当と納期をその場で設定できる。担当で絞り込める。
- 完了列は直近20件。30秒ごとに自動更新し、他のスタッフの操作も反映する。発送済みへ移すときは配送業者・追跡番号を入力する。
- 発注点を下回った材料を警告表示する。注文権限もあればカードから注文詳細を開ける。

### 16.2 材料管理

制作権限で使う。

- 材料マスタ（コード・名前・単位・在庫・発注点・単価・仕入先・メモ）の登録・編集・削除。
- 入荷（＋）と廃棄・棚卸し差異（−）で在庫を増減する。在庫はマイナスも許容し、発注点以下を「要発注」とする。
- 制作待ちの注文で使う予定量と、それを差し引いた見込み在庫を表示する。
- 商品ごとのレシピ（1個あたりの使用材料と数量）を設定し、「制作中」への移動で消費する。

### 16.3 商品管理

販売権限で使う。商品の登録・編集・削除（SKU・名前・説明・価格・カテゴリ・タグ・サブスク対象・デジタル商品 / 利用許諾）、画像アップロード、3Dデータの登録、在庫数の更新。

### 16.4 注文管理

注文権限で使う。ステータス・担当・期間で絞り込んだ注文一覧。注文詳細で顧客・配送先・明細・金額の内訳・遷移履歴を確認し、ステータス変更（メモつき）・発送情報・担当・納期を更新する。

### 16.5 顧客管理

注文権限で使う。

- 会員一覧（購入回数・購入金額・最終注文日・未対応の問い合わせ数）。名前・メールで検索し、購入金額順 / 購入回数順 / 最近の購入順で並び替える。購入実績は入金確認以降の注文だけを数える。
- 顧客詳細：住所、購入履歴、よく買う商品（上位5件）、問い合わせ、店舗側だけが見る顧客メモ。

### 16.6 売上・分析

販売権限で使う。

- 期間（7日 / 30日 / 90日。日本時間で日を区切る）の売上・注文数・平均注文額。売上は入金確認以降（キャンセルを除く）を対象にする。
- 日次売上グラフ（0埋め）、カテゴリ別売上、人気商品、購入者数・リピート率・新規会員数。
- 制作状況：工程別の件数、納期遅れ件数、入金→発送の平均日数、工程ごとの平均滞留時間。

### 16.7 スタッフ権限

管理者だけが使う。[3.2節](#32-スタッフの権限)を参照。

## 17. 今後の予定

主な機能はそろっている。次に作り込む候補は次のとおりで、進め方に判断が要るものは[第25章](#25-未決事項)に、細かい作業は [docs/tasks/task.md](docs/tasks/task.md) にまとめる。

| 分類 | 内容 |
|---|---|
| 機能 | ステータス変更・回答時の顧客への通知、オーダーメイド依頼から注文への変換、入金後キャンセル時の在庫戻し・返金、材料の入出庫履歴、制作スタッフ向けのモバイル画面、AIコンシェルジュに進行中の問い合わせを渡す |
| UI | カテゴリ別の商品の表示項目、OG 画像・favicon の差し替え、画像の変換・最適化、狭い画面のヘッダーのメニュー |
| 品質 | テストの拡充（AIコンシェルジュの CTA 抽出、管理の商品系の request spec）、制作ボードのキーボード操作、モバイルの日時ピッカー |

---

# 第2部 技術説明

実装に関わる技術的な内容をまとめる。機能の仕様は[第1部](#第1部-概要説明)を参照。

## 18. 技術スタックとシステム構成

### 18.1 技術スタック

| レイヤ | 技術 | 責務 |
|---|---|---|
| モバイル | React Native 0.81（Expo SDK 54 + Expo Router） | 顧客向けの iOS / Android アプリ。認証・注文・AIコンシェルジュ・サブスク |
| Web | Next.js 15（App Router、React 19）+ SWR、three.js（3Dプレビュー）、dxf-viewer（DIY設計図の DXF プレビュー） | ブラウザ向けの全機能と管理画面 |
| API | Rails 7.2（API mode） | 業務ロジック、DB アクセス、認証、Stripe、Dify の仲介、PDF 生成 |
| AI | Dify（Chatflow + Knowledge） | LLM のオーケストレーション、商品の RAG |
| DB | PostgreSQL 16（pgvector / pg_trgm） | リレーショナル ＋ 全文 / ベクトル検索 |
| インフラ | Docker Compose + Nginx | ローカル開発、単一のエントリポイント |

API の主な gem：`jwt`、`bcrypt`、`pg_search`、`neighbor`（pgvector）、`stripe`、`faraday`、`prawn`（PDF）、`kramdown` + `kramdown-parser-gfm`（Markdown）、`rubyzip`。

### 18.2 システム構成

```mermaid
flowchart TB
  client["ブラウザ / Expo Go"]
  nginx["Nginx :80"]
  web["web（Next.js）:3001"]
  api["api（Rails 7.2）:3000"]
  db[("PostgreSQL 16<br/>pgvector / pg_trgm :5432")]
  dify["Dify（公式 compose を別に起動）:8080"]
  mobile["mobile（Expo の開発サーバー）:8081"]

  client --> nginx
  nginx -- "/" --> web
  nginx -- "/api/ ・ /rails/" --> api
  web -- "SSR 時は http://api:3000/api" --> api
  api --> db
  api -- "host.docker.internal:8080/v1" --> dify
  mobile -. "JS バンドルを配信" .-> client
```

通信経路：

| 経路 | 接続先 |
|---|---|
| Web（ブラウザ）→ API | `http://localhost/api/v1/...`（Nginx 経由、`NEXT_PUBLIC_API_BASE`） |
| Web（SSR）→ API | `http://api:3000/api/v1/...`（compose 内、`API_BASE_INTERNAL`） |
| モバイル → API | `http://<開発PCの LAN IP>/api/v1/...`（端末から到達できる URL、`EXPO_PUBLIC_API_BASE`） |
| API → Dify | `http://host.docker.internal:8080/v1/...`（Dify は別ネットワークのため、ホスト経由） |
| API → PostgreSQL | `postgres:5432` |
| ActiveStorage の配信 | Nginx の `/rails/` を API へプロキシする（同一オリジン） |

### 18.3 リポジトリ構成

```text
docker_sales_management/
├── README.md                 仕様書（このファイル）
├── app/
│   ├── api/                  Rails（API mode）
│   │   ├── app/controllers/api/v1/        顧客向け API（admin/ 以下は管理 API）
│   │   ├── app/models/
│   │   ├── app/services/     OrderWorkflow・OrderCreator・Pricing・ModelListing・AssemblyGuidePdf など
│   │   ├── db/migrate/ · db/seeds.rb
│   │   ├── lib/tasks/        rake タスク（旧カテゴリの掃除など）
│   │   ├── spec/             RSpec
│   │   └── Dockerfile
│   ├── web/                  Next.js（src/app/ に画面、src/lib/api.ts に API クライアント）
│   ├── mobile/               Expo（app/ に画面）
│   └── ai/                   Dify のプロンプト・ナレッジ・同期スクリプト
├── docs/                     仕様書以外の資料（docs/README.md）
└── platform/
    ├── docker-compose.yml
    ├── .env.example
    ├── nginx/                nginx.conf・conf.d/default.conf
    └── postgres/init/        DB と拡張の作成
```

### 18.4 Docker Compose の構成

`platform/docker-compose.yml`（開発用）：

| サービス | イメージ / ビルド | ポート | 役割 |
|---|---|---|---|
| `postgres` | `pgvector/pgvector:pg16` | 5432 | DB。初回起動時に `app_test` と拡張（vector・pg_trgm）を作る |
| `api` | `app/api/Dockerfile` | 3000 | 起動時に `rails db:prepare` を実行してから Rails を起動する |
| `web` | `app/web/Dockerfile` | 3001 | `npm run dev` |
| `mobile` | `app/mobile/Dockerfile` | 8081, 19000-19002 | Expo の開発サーバー（`EXPO_HOST` で lan / tunnel / localhost） |
| `nginx` | `nginx:1.27-alpine` | 80 | `/` → web、`/api/` と `/rails/` → api。アップロード上限は110MB |

- Dify は含めない（[D9](#24-決定事項)）。
- 名前付きボリューム：`postgres_data`・`bundle_cache`・`web_node_modules`・`mobile_node_modules`。

### 18.5 クイックスタート

前提は Docker（Compose v2）だけで、ホストに Ruby / Node は要らない。ポート 80 / 3000 / 3001 / 5432 / 8081 / 19000-19002 を空けておく。

```bash
cd platform
cp .env.example .env
docker compose up -d postgres
docker compose run --rm api bash -c "bundle exec rails db:prepare && bundle exec rails db:seed"
docker compose up
```

| URL | 内容 |
|---|---|
| <http://localhost> | アプリ（Nginx 経由） |
| <http://localhost:3000/api/v1> | API を直接 |
| <http://localhost:3001> | Web を直接 |
| <http://localhost:8081> | Expo の開発サーバー（Metro） |

seed で作られるログイン（パスワードはすべて `password`）：

| メール | ロール / 権限 |
|---|---|
| `admin@example.com` | 管理者 |
| `staff1@example.com` / `staff2@example.com` | スタッフ（制作） |
| `shop@example.com` | スタッフ（販売・注文） |
| `member@example.com` / `hanako@example.com` | 会員 |

> **本番運用時の注意**：`.env` / `seeds.rb` の既定のパスワード（`app_password` / `password`）は開発専用である。デプロイ前に必ず変更する。`app/api/config/master.key` はリポジトリに含めず、別に安全に管理する。

API のテスト（RSpec）は、compose の `app_test` データベースに対して実行する。

```bash
cd platform
docker compose run --rm -e RAILS_ENV=test \
  -e DATABASE_URL=postgres://app:app_password@postgres:5432/app_test \
  api bash -c "bundle exec rails db:prepare && bundle exec rspec"
```

個別のサービスの起動、スモークテスト、トラブルシュート、リセットの手順は [docs/runbooks/development.md](docs/runbooks/development.md) を参照。

### 18.6 Dify（AIコンシェルジュ）の接続

Dify は公式の [langgenius/dify](https://github.com/langgenius/dify) の compose を別のディレクトリで起動し、ポートを 8080 / 8443 に変える。Chatflow を作って API キーを発行し、`platform/.env` に設定して api を再起動する。

```bash
DIFY_API_BASE=http://host.docker.internal:8080/v1
DIFY_API_KEY=app-xxxxxxxxxxxxxxxxxx
```

手順の詳細は [docs/runbooks/development.md の3章](docs/runbooks/development.md#3-dify-aiコンシェルジュ-を起動) と [app/ai/README.md](app/ai/README.md) を参照。

### 18.7 モバイルアプリの起動

Expo は compose の `mobile` サービスで動かすか、ホストで直接起動する。実機の Expo Go から接続するには、`.env` の `REACT_NATIVE_PACKAGER_HOSTNAME` と `EXPO_PUBLIC_API_BASE` を開発 PC の LAN IP にする。

```bash
cd app/mobile
npm install
EXPO_PUBLIC_API_BASE=http://<開発PCの LAN IP>/api npx expo start
```

LAN / tunnel / localhost の各モードと接続できないときの対処は [docs/runbooks/development.md の4章](docs/runbooks/development.md#4-モバイル-expo-の接続方法) を参照。

## 19. 認証の実装

| 項目 | 内容 |
|---|---|
| 方式 | API が JWT（HS256）を発行し、Web・モバイルとも `Authorization: Bearer <token>` で送る |
| 有効期限 | アクセストークン1時間、リフレッシュトークン7日。更新は `POST /api/v1/auth/refresh` |
| パスワード | bcrypt（cost=12） |
| ロールと権限 | `users.role`（`member` / `staff` / `admin`）と `users.permissions`（`sales` / `production` / `orders` の配列。staff 以外は常に空） |

- 管理 API は、コントローラごとに必要な権限を `requires_permission` で宣言して検査する。宣言のないものは管理者専用とする（`app/controllers/api/v1/admin/base_controller.rb`）。
- Web のメニューの出し分けは表示のためで、可否は常に API が判定する。
- 顧客向けの API は、自分のデータ（注文・住所・サブスク・問い合わせ・ダウンロード）にだけアクセスできる。
- `/auth/login` の `user` と `GET /me` は、実際に持っている権限を `permissions`（配列）で返す。

## 20. 機能ごとの実装方針

第1部の各機能のうち、実装に関わる方針をまとめる。

### 20.1 注文の作成と料金

- 注文の作成は `OrderCreator`、料金の計算は `Pricing` が担う（[第8章](#8-カート注文料金)）。
- 注文確定時に在庫を検証し、物販品は `inventories` の仮押さえ数を増やす。合計0円の注文は作成時に入金確認を省略する。

### 20.2 注文の工程（OrderWorkflow）

- ステータスの遷移と副作用は `OrderWorkflow` にまとめる（[第9章](#9-注文ステータスと制作フロー)）。
  - 入金確認：仮押さえを確定出庫する。デジタル商品のみの注文は自動で `completed` にする。
  - 制作中：レシピ（`product_materials`）× 数量ぶん材料を消費する。`orders.materials_consumed_at` で二重消費を防ぐ。
  - 発送済み：`shipments` に配送業者・追跡番号を記録する。
  - キャンセル：入金前なら仮押さえを解除する。
- 許されない遷移は `422 bad_transition`。遷移・担当変更は `order_events` に操作者つきで記録する（システムによる自動遷移は操作者なし）。

### 20.3 ファイルの保存と配布

- アップロードしたファイル（3Dモデル・DIY設計図・画像）は ActiveStorage のディスク（`/app/storage`）に保存する。本番は名前付きボリュームに置き、コンテナを作り直しても消えないようにする。
- 配布ファイルは非公開の添付にし、`GET /downloads/:product_id` で本人確認のうえ、有効期限5分の署名付き URL（`/rails/active_storage/...`）を払い出す。
- 複数ファイルの版の ZIP（`bundle`）は、配布・一括ダウンロードで初めて作り、以後使い回す。販売中は最新版の配布ファイルを商品の `model_file` と共有する（`ModelListing`）。ファイルのカテゴリを変えたときだけ、フォルダ分けが変わるので作り直す（商品が共有している古い ZIP は、商品の配布ファイルが差し替わるまで消えない）。

### 20.4 商品検索

- キーワード検索は `pg_search`（pg_trgm の類似度 ＋ 前方一致の全文検索）で、名前の重みを大きくする。
- ベクトル検索は `neighbor` で `product_embeddings.embedding`（vector(1536)）のコサイン距離を使う。埋め込みは `EmbeddingService` が作る（`OPENAI_API_KEY` 未設定なら mock のベクトル）。

### 20.5 組み立て説明書 PDF

- `AssemblyGuidePdf` が prawn で A4 の PDF を組み立て、Markdown は `MarkdownPdf`（kramdown + GFM）で見出し・リスト・引用・コード・表に整形する。
- 日本語は IPAex ゴシックを埋め込む（API イメージに `fonts-ipaexfont-gothic` を入れる）。
- 購入者向けのリンクは `GET /downloads/:product_id/assembly` で有効期限5分のトークンを発行し、`/assembly_pdfs/:token` はログインなしで開ける。
- Markdown ファイルの取り込みは `AssemblyMarkdownImport` が行う（[11.2節](#112-markdown-ファイルからの取り込み)）。

### 20.6 AIコンシェルジュ

- AIコンシェルジュの API（`ai_concierge/messages_controller.rb`）が、変数 `member_name`・`cart_items`（JSON 文字列）・`recent_orders`（JSON 文字列）を組み立て、`DifyClient` で Dify の Chatflow を呼ぶ。ゲストは `member_name` を「ゲスト」にする。
- ナレッジのうち商品カタログ（`app/ai/knowledge/catalog.md`）は `app/ai/sync_knowledge.rb` で公開中の商品から作り直す。FAQ（`faq.md`）は手で書く。どちらも Dify のナレッジベースへアップロードし直す。

## 21. データモデル

- データベースは PostgreSQL 16、マイグレーションは Rails 7.2 の migrations とする。拡張：`citext`・`pg_trgm`・`pgcrypto`・`vector`。
- 主キーは `bigint` の連番。金額は円の整数（`*_cents`、通貨は JPY）で持つ。

### 21.1 テーブル一覧

| テーブル | 用途 |
|---|---|
| `users` | 会員・スタッフ・管理者 |
| `addresses` | 会員の住所 |
| `payment_methods` | 会員の支払い方法（Stripe の customer / payment_method） |
| `categories` | 商品カテゴリ |
| `products` | 商品 |
| `product_embeddings` | pgvector の埋め込み（商品検索） |
| `inventories` | 販売在庫 |
| `carts` / `cart_items` | カート |
| `orders` / `order_items` | 注文（8段階の制作・発送ステータス、製作担当、納期） |
| `order_events` | 注文ステータスの遷移履歴（制作状況の見える化・リードタイム分析） |
| `shipments` | 出荷 |
| `materials` | 制作用の材料と在庫（販売在庫とは別） |
| `product_materials` | 商品1個あたりの使用材料（レシピ） |
| `model_assets` / `model_versions` / `model_photos` / `assembly_steps` | 3Dモデル・版・写真・組み立て手順 |
| `tips` | 投げ銭 |
| `subscription_plans` | サブスクのプランのマスタ |
| `subscriptions` | 会員ごとのサブスク契約 |
| `subscription_deliveries` | 各回のお届けの予定 |
| `service_requests` | 問い合わせ / オーダーメイド依頼 |
| `active_storage_*` | 添付ファイル（ActiveStorage：blobs / attachments / variant_records） |
| `ai_conversations` / `ai_messages` | AIコンシェルジュの対話履歴 |

### 21.2 ER 概要

```text
users 1─┬─* addresses
        ├─* payment_methods
        ├─1 carts ─* cart_items ─* products
        ├─* orders ─* order_items ─* products
        │    │       ├─1 shipments
        │    │       ├─* order_events (─0..1 users: 操作者)
        │    │       └─* tips
        │    └─0..1 users (assignee: 製作担当)
        ├─* subscriptions ─* subscription_deliveries
        │     └─1 subscription_plans
        ├─* service_requests ─0..1 products / 0..1 orders
        └─* ai_conversations ─* ai_messages

products *─1 categories
products 1─1 inventories
products 1─1 product_embeddings (vector(1536))
products 1─* product_materials *─1 materials
model_assets 0..1─1 products (販売フラグで連動)
model_assets 1─* model_versions / model_photos / assembly_steps
```

### 21.3 users

```text
id
email                 citext unique
password_digest
role                  'member' | 'staff' | 'admin'（既定 'member'）
permissions           string[]（'sales' | 'production' | 'orders'。staff 以外は常に空）
name
admin_note            text（店舗側だけが見る顧客メモ）
stripe_customer_id    nullable
created_at / updated_at
```

### 21.4 products

```text
id
category_id
sku                   unique
name                  pg_trgm index
description           pg_trgm index
price_cents
currency              既定 'JPY'
is_subscribable       既定 false
published_at          nullable
image_url             既定 ''（空なら SKU のプレースホルダーを表示）
is_digital            既定 false（3Dモデルデータなどのダウンロード販売品。在庫・配送なし）
license               既定 ''（デジタル商品の利用許諾）
created_at / updated_at
```

- 配布ファイルは ActiveStorage の `model_file` 添付（非公開。`/downloads/:product_id` から期限付き URL で配布）。

### 21.5 product_embeddings

```text
product_id            pk・fk
embedding             vector(1536)（text-embedding-3-small を想定）
indexed_at
```

### 21.6 orders

```text
id
user_id
address_id            nullable（デジタル商品のみの注文は NULL）
status                既定 'received'
                      'received' 注文受付 → 'paid' 入金確認 → 'awaiting_production' 制作待ち → 'in_production' 制作中
                      → 'inspection' 検品 → 'ready_to_ship' 発送準備 → 'shipped' 発送済み → 'completed' 完了（＋ 'cancelled'）
paid_at               入金確認日時
materials_consumed_at 材料を消費済みか（差し戻しでの二重消費を防ぐ）
assignee_id           users・nullable（製作担当：制作権限を持つ staff / admin）
due_on                date・nullable（納期）
subtotal_cents / tax_cents / shipping_cents / total_cents
stripe_payment_intent_id
placed_at
created_at / updated_at
```

### 21.7 order_events

```text
id
order_id
actor_id              users・nullable（NULL はシステムによる自動遷移）
from_status / status  担当変更など、ステータスが変わらない記録は from_status = status
note
created_at
```

### 21.8 materials

```text
id
code                  unique
name
unit                  'g' / 'm' / '枚' / 'ml' など
stock                 decimal(12,2)（マイナスも許容し、要発注として警告）
reorder_point         decimal(12,2)（発注点。これ以下で「要発注」）
unit_cost_cents
supplier
note
created_at / updated_at
```

### 21.9 product_materials

```text
product_id / material_id    組で unique
quantity                    decimal(12,3)（商品1個あたりの使用量）
created_at / updated_at
```

### 21.10 model_assets（3Dモデル・DIY設計図）

```text
id
kind                  既定 'model'（model 3Dモデル / blueprint DIY設計図。作成後は変更不可）
name
description           既定 ''
license               既定 ''（販売時の利用許諾）
assembly_notes        既定 ''（組み立てに必要な部品・工具。Markdown）
for_sale              既定 false（販売フラグ。ショップの商品と連動）
price_cents           既定 0
product_id            unique・nullable（連動する商品。3Dモデルはカテゴリ 3d-models・SKU MDL-<id>、DIY設計図は diy-plans・DIY-<id>）
created_by_id         users・nullable
created_at / updated_at
```

- プレビュー画像は ActiveStorage の `preview_image` 添付（PNG / JPEG）。

### 21.11 model_versions（3Dモデル・DIY設計図のファイルの版）

```text
id
model_asset_id
number                モデルごとに1から。最大（同じなら minor が最大）が最新版
minor                 既定 0（枝番。最新版にファイルを追加した版は 1 から。表示は v<number>.<minor>）。unique [model_asset_id, number, minor]
note                  既定 ''（変更内容）
file_categories       jsonb・既定 {}（ファイルのカテゴリ。キー = blob_id、値 = all_in_one / parts。その他は持たない）
created_by_id         users・nullable
created_at / updated_at
```

- ファイルは ActiveStorage の `files` 添付（複数。3Dモデルは STL / 3MF / OBJ / STEP / ZIP、DIY設計図は PDF / PNG / JPG / SVG / DXF / DWG / JWW と完成品の3Dデータ STL / OBJ / 3MF。20個・合計100MBまで）。
- `bundle` 添付：複数ファイルの版をまとめた ZIP（[20.3節](#203-ファイルの保存と配布)）。
- `file_categories` は blob_id で持つので、ファイル追加・「この版に戻す」で引き継いだ blob のカテゴリをそのまま写せる。

### 21.12 model_photos（3Dモデルの写真）

```text
id
model_asset_id
kind                  'real_model' 実モデル画像 | 'in_use' 実利用画像
caption               既定 ''（200文字まで）
position              種類ごとの並び順（1始まり）。index [model_asset_id, kind, position]
featured              既定 false（プレビュー表示。モデルごとに最大3枚）
created_at / updated_at
```

- 画像は ActiveStorage の `image` 添付（JPEG / PNG / WebP・10MBまで。種類ごとに20枚まで）。

### 21.13 assembly_steps（組み立て手順）

```text
id
model_asset_id
position              1始まりの並び順
title                 既定 ''
body                  既定 ''（Markdown）。title と body のどちらかは必須
created_at / updated_at
```

- 画像は ActiveStorage の `image` 添付（PNG / JPEG・5MBまで）。

### 21.14 tips（投げ銭）

```text
id
order_id              0円の商品を含む注文
user_id               申し込んだ購入者（注文の会員）
amount_cents          100〜100,000
message               既定 ''（500文字まで）
status                既定 'pending'（'pending' 入金待ち | 'paid' 入金確認済み | 'cancelled' 取り消し）
paid_at               nullable
confirmed_by_id       users・nullable（入金確認・取り消しをした店舗側のユーザー）
created_at / updated_at
index [status, created_at]
```

### 21.15 service_requests（問い合わせ・オーダーメイド依頼）

```text
id
user_id
kind                  'inquiry' 問い合わせ | 'custom' オーダーメイド依頼
status                inquiry: 'pending' → 'answered' → 'closed'
                      custom:  'pending' → 'quoted' → 'in_progress' → 'completed' / 'cancelled'
subject               件名 / 作りたいもの（inquiry では必須）
order_id              nullable（問い合わせ対象の注文。本人の注文のみ）
product_id            nullable（オーダーメイドで参考にする商品）
preferred_at          nullable（オーダーメイドの希望納期）
budget_cents          nullable（オーダーメイドの予算）
body
contact_phone
reply                 既定 ''（店舗からの回答。回答で inquiry は 'answered' に）
replied_at
created_at / updated_at
```

### 21.16 subscriptions

```text
id
user_id
subscription_plan_id
product_id
status                'active' | 'paused' | 'cancelled'
next_delivery_on      date
interval_days
stripe_subscription_id
created_at / updated_at
```

### 21.17 ai_conversations / ai_messages

```text
ai_conversations
  id
  user_id               nullable（ゲスト可）
  dify_conversation_id
  started_at
  created_at / updated_at

ai_messages
  id
  ai_conversation_id
  role                  'user' | 'assistant' | 'system'
  content
  cta                   nullable
  created_at
```

## 22. API

- Rails で実装する。ベースパスは `/api/v1`。
- 認証は `Authorization: Bearer <jwt>`（匿名でアクセスできるエンドポイントを除く。[第19章](#19-認証の実装)）。
- エラーは `{ "error": { "code": "...", "message": "..." } }` の形式で返す。
- ページングは `?page=1&per=20`。レスポンスヘッダー `X-Total-Count`・`X-Page`・`X-Per-Page` を返す。

### 22.1 認証・会員

| Method | Path | 説明 |
|---|---|---|
| POST | `/auth/register` | 会員登録 |
| POST | `/auth/login` | ログイン → JWT |
| POST | `/auth/refresh` | リフレッシュ |
| GET | `/me` | プロフィールの取得 |
| PATCH | `/me` | プロフィールの更新 |
| GET/POST/PATCH/DELETE | `/me/addresses[/:id]` | 住所の CRUD |
| GET/POST/DELETE | `/me/payment_methods[/:id]` | 支払い方法 |

### 22.2 商品・検索

| Method | Path | 説明 |
|---|---|---|
| GET | `/products` | 一覧（params：`q`、`category_id`、`category_slug`、`min_price`、`max_price`、`tags[]`、`sort`、`page`） |
| GET | `/products/:id` | 詳細 |
| GET | `/products/search` | ベクトル検索（`q` 必須） |
| GET | `/categories` | カテゴリ一覧 |

- 商品のレスポンスには `category_slug` / `image_url` / `is_digital` を含む。`custom` カテゴリの商品はカートではなくオーダーメイド依頼へ誘導する。
- デジタル商品（3Dモデルデータ）の詳細は `license` / `file_format` / `file_size` を返し、`stock` は返さない（配布ファイルの URL は含まない）。
- 販売中の3Dモデルの商品は、`photos`（`{ id, url, kind, kind_label, caption }`、最大3枚）でプレビュー写真を返す。

### 22.3 カート・注文

| Method | Path | 説明 |
|---|---|---|
| GET | `/cart` | 自分のカート |
| POST | `/cart/items` | 追加（body：`product_id`、`quantity`） |
| PATCH | `/cart/items/:id` | 数量の変更 |
| DELETE | `/cart/items/:id` | 削除 |
| POST | `/orders` | 注文確定（body：`address_id`、`payment_method_id`）。デジタル商品のみなら `address_id` は省略可 |
| GET | `/orders` | 自分の注文一覧 |
| GET | `/orders/:id` | 注文詳細（`status_label`、制作の進み具合の `events` / `physical` / `due_on`、`downloadable`、明細ごとの `is_digital`、投げ銭の `accepts_tips` と自分の `tips` を含む） |

- カートの `requires_shipping` が `false`（デジタル商品のみ）なら配送先は要らない。
- デジタル商品の数量は常に1。購入済みのデータをカートに追加すると `422 already_purchased`。

### 22.4 3Dモデルデータのダウンロード

| Method | Path | 説明 |
|---|---|---|
| GET | `/downloads` | 購入済み（支払い済みの注文の）デジタル商品の一覧 |
| GET | `/downloads/:product_id` | 期限付き（5分）のダウンロード URL を発行 → `{ url, filename, byte_size, expires_in }`。`url` は API と同じオリジンの `/rails/active_storage/...` |
| GET | `/downloads/:product_id/assembly` | 組み立て説明書（PDF）の期限付き（5分）リンクを発行 → `{ url, filename, expires_in }`。`url` は `/api/v1/assembly_pdfs/:token`（ログインなしで開ける） |
| GET | `/assembly_pdfs/:token` | 組み立て説明書 PDF（`application/pdf`、attachment）。期限切れ・不正なトークンは `404` |

- 未購入・未払い・他人の注文の商品は `404`。`GET /downloads` と注文詳細の明細は、組み立て説明書を配布できるかを `has_assembly` で返す。

### 22.5 投げ銭（購入者）

0円の商品を含む自分の注文（キャンセル以外）に申し込める。

| Method | Path | 説明 |
|---|---|---|
| POST | `/orders/:order_id/tips` | 申し込み（body：`amount_cents` = 100〜100,000、`message` 500文字まで）→ `201`、状態は `pending`。対象外の注文は `422`、他人の注文は `404` |
| DELETE | `/orders/:order_id/tips/:id` | 入金待ちの投げ銭を取り消す（`204`）。入金確認済みは `422 not_pending` |

### 22.6 サブスク

| Method | Path | 説明 |
|---|---|---|
| GET | `/subscription_plans` | プラン一覧 |
| GET | `/subscriptions` | 自分のサブスク一覧 |
| POST | `/subscriptions` | 新規購読（body：`subscription_plan_id`、`product_id`、`address_id`、`payment_method_id`） |
| PATCH | `/subscriptions/:id` | 一時停止 / 再開 / 次回日の変更 |
| DELETE | `/subscriptions/:id` | 解約 |
| POST | `/subscriptions/:id/skip` | 次回スキップ |

### 22.7 問い合わせ・オーダーメイド依頼

| Method | Path | 説明 |
|---|---|---|
| GET | `/service_requests` | 自分の問い合わせ・依頼の一覧（filter：`kind` = `inquiry` \| `custom`）。店舗の回答 `reply` を含む |
| GET | `/service_requests/:id` | 詳細 |
| POST | `/service_requests` | 作成（body：`kind`、`subject`（inquiry は必須）、`body`、`order_id?`（inquiry：自分の注文）、`product_id?` / `preferred_at?`（希望納期） / `budget_cents?`（custom）、`contact_phone?`）。status は常に `pending` から |

ステータス：inquiry = `pending` → `answered` → `closed` / custom = `pending` → `quoted` → `in_progress` → `completed` / `cancelled`

### 22.8 AIコンシェルジュ

| Method | Path | 説明 |
|---|---|---|
| POST | `/ai_concierge/conversations` | 新しい会話を始める |
| POST | `/ai_concierge/conversations/:id/messages` | 発話（body：`content`）。レスポンスは SSE で逐次返す |
| GET | `/ai_concierge/conversations/:id` | 会話履歴 |

### 22.9 管理 API の権限

管理 API はスタッフに付与された権限（`sales` 販売 / `production` 制作 / `orders` 注文）で可否が決まる。管理者（admin）はすべての権限を持つ。権限がなければ `403 forbidden`（例：`販売の権限が必要です`）。

### 22.10 管理 — 注文（`orders` 権限）

| Method | Path | 説明 |
|---|---|---|
| GET | `/admin/orders` | 全注文（filter：`status`、`assignee_id`、`from`、`to`） |
| GET | `/admin/orders/:id` | 注文詳細（顧客・配送先・明細・担当・納期・遷移履歴 `events`、投げ銭の `accepts_tips`・`tips`） |
| PATCH | `/admin/orders/:id` | ステータスの変更・担当 / 納期の設定（body：`status`、`note`、`carrier`、`tracking_number`、`assignee_id`、`due_on`） |
| GET | `/admin/tips` | 投げ銭の一覧（params：`status` = `pending` / `paid` / `cancelled`）→ `{ summary: { pending_count, pending_cents, paid_count, paid_cents }, tips: [{ id, order_id, amount_cents, message, status, status_label, created_at, paid_at, user, confirmed_by }] }` |
| PATCH | `/admin/tips/:id` | 入金確認・取り消し（body：`status` = `paid` / `cancelled` / `pending`）。確認した人と日時を記録する |
| GET | `/admin/service_requests` | 問い合わせ・依頼の全件（filter：`kind`、`status`、`user_id`） |
| GET | `/admin/service_requests/:id` | 詳細 |
| PATCH | `/admin/service_requests/:id` | 回答・ステータスの更新（body：`reply`、`status`）。未対応の問い合わせは回答で `answered` になる |
| GET | `/admin/customers` | 会員一覧（`orders_count`、`total_spent_cents` は入金確認以降の注文、`last_order_at`、`open_requests_count`）。params：`q`（名前・メール）、`sort`（`recent` / `spent` / `orders`） |
| GET | `/admin/customers/:id` | 顧客詳細（住所・購入履歴・よく買う商品・問い合わせ・顧客メモ） |
| PATCH | `/admin/customers/:id` | 顧客メモ（body：`admin_note`） |

注文ステータス：`received` 注文受付 → `paid` 入金確認 → `awaiting_production` 制作待ち → `in_production` 制作中 → `inspection` 検品 → `ready_to_ship` 発送準備 → `shipped` 発送済み → `completed` 完了（＋ `cancelled`）

- 入金確認前に制作・発送へ進めると `422 bad_transition`。キャンセル済みは変更不可、`received` へは戻せない。
- `paid`：販売在庫を確定出庫（デジタル商品のみの注文は自動で `completed`）。`in_production`：レシピに従い材料を消費（1回のみ）。`shipped`：`carrier` / `tracking_number` を記録。
- 遷移・担当変更は `order_events` に記録される。

### 22.11 管理 — 販売（`sales` 権限）

| Method | Path | 説明 |
|---|---|---|
| GET | `/admin/products` | 商品管理 |
| POST/PATCH/DELETE | `/admin/products[/:id]` | 商品の CRUD |
| POST | `/admin/products/:id/image` | 商品画像のアップロード（multipart：`image`）。ActiveStorage に保存し `image_url` を更新する |
| POST | `/admin/products/:id/model_file` | 3Dモデルデータの配布ファイルの登録（multipart：`model_file`、STL/3MF/OBJ/STEP/ZIP・最大100MB）。`is_digital` の商品のみ |
| PATCH | `/admin/inventories/:product_id` | 販売在庫の更新 |
| GET | `/admin/dashboard/sales` | 売上分析（params：`from`、`to`。既定は直近30日、日本時間で日を区切る）。`total_revenue_cents`、`total_orders`、`average_order_cents`、`by_day`（0埋め）、`by_category`、`top_products`、`customers`（購入者数・リピート率・新規会員）、`production`（工程別の件数 `wip`・納期遅れ・入金→発送の平均日数・工程ごとの平均滞留時間 `stage_hours`） |

### 22.12 管理 — 制作（`production` 権限）

| Method | Path | 説明 |
|---|---|---|
| GET | `/admin/production` | 制作ボード。`columns`（ステータスの列ごとの注文カード。完了は直近20件） / `staff` / `low_materials`（filter：`assignee_id`） |
| PATCH | `/admin/production/:id` | カードの移動・担当・納期（body：`status`、`assignee_id`、`due_on`、`note`、`carrier`、`tracking_number`）→ 注文カード |
| GET | `/admin/staff` | 製作担当に指定できるユーザー（制作権限を持つスタッフ / admin）。`production` または `orders` 権限 |
| GET | `/admin/materials` | 材料一覧（`stock`、`reorder_point`、`low`、制作待ちの注文での使用予定 `required_for_queue`、見込み在庫 `projected_stock`、使用する商品） |
| POST/PATCH/DELETE | `/admin/materials[/:id]` | 材料の CRUD（body：`code`、`name`、`unit`、`stock`、`reorder_point`、`unit_cost_cents`、`supplier`、`note`） |
| POST | `/admin/materials/:id/adjust` | 在庫の増減（body：`delta`。入荷は正、廃棄・棚卸し差異は負） |
| GET | `/admin/products/:product_id/materials` | 商品のレシピ（1個あたりの使用材料） |
| PUT | `/admin/products/:product_id/materials` | レシピの置き換え（body：`items: [{ material_id, quantity }]`） |

### 22.13 管理 — 3Dモデル・DIY設計図（`production` 権限）

| Method | Path | 説明 |
|---|---|---|
| GET | `/admin/model_assets` | 3Dモデル・DIY設計図の一覧（params：`kind` = `model`（省略時） / `blueprint`。`kind`、`kind_label`、`current_version`、`for_sale`、`price_cents`、`preview_image_url`、`versions_count`、`assembly_steps_count`、連動する商品 `product: { id, sku, published }`） |
| POST | `/admin/model_assets` | 登録（multipart：`kind` = `model`（省略時） / `blueprint`、`name`、`description`、`license`、初版のファイル = `all_in_one_files[]`（オールインワン）/ `parts_files[]`（分割）/ `files[]`（その他。1つなら `file` でも可）（種別ごとの形式。それぞれ複数可・どれか1つ以上）、`note`）→ 詳細 |
| GET | `/admin/model_assets/:id` | 詳細（一覧の項目 ＋ `description`、`license`、`assembly_notes`、`versions`、`assembly_steps`） |
| PATCH | `/admin/model_assets/:id` | 更新（body：`name`、`description`、`license`、`assembly_notes` = Markdown、`for_sale`、`price_cents`）。販売フラグはショップの商品に反映する。ファイルなしで販売しようとすると `422 listing_failed` |
| DELETE | `/admin/model_assets/:id` | 削除（版・手順も削除。連動する商品は非公開にして残す） |
| POST | `/admin/model_assets/:id/preview` | プレビュー画像の保存（multipart：`image`、PNG/JPEG 5MBまで） |
| GET | `/admin/model_assets/:id/assembly_pdf` | 組み立て説明書 PDF |
| POST | `/admin/model_assets/:id/versions` | 新しい版（multipart：`all_in_one_files[]` / `parts_files[]` / `files[]`（カテゴリごと。複数可・合わせて20個・合計100MBまで）、`note`、`append`）。`append=true` は最新版のファイル（カテゴリも）を引き継いで選んだファイルを足した枝番の版（v3 → v3.1。`note` の省略時は「ファイルを追加」）を作る。販売中なら配布ファイルを差し替える（複数ファイルは ZIP） |
| PATCH | `/admin/model_assets/:id/versions/:version_id` | ファイルのカテゴリの変更（JSON：`categories` = `{ "<file_id>": "all_in_one" / "parts" / "other" }`）。ファイルは変えない。ZIP を作り直し、販売中の最新版なら配布ファイルを差し替える。不正なカテゴリは `422`、他の版のファイルは `404` |
| POST | `/admin/model_assets/:id/versions/:version_id/restore` | 過去の版のファイル（カテゴリも）で新しい版を作る |
| GET | `/admin/model_assets/:id/versions/:version_id/file` | 版の中の1ファイルのプレビュー・ダウンロード用の期限付き（10分）URL（params：`file_id`（省略時は最初のファイル）、`disposition` = `inline` / `attachment`）→ `{ url, filename, byte_size, expires_in }` |
| GET | `/admin/model_assets/:id/versions/:version_id/bundle` | 版のファイルをまとめてダウンロードする期限付き URL（複数なら `<モデル名>_v<版>.zip`、1つならそのファイル） |
| POST | `/admin/model_assets/:id/assembly_steps` | 手順の追加（multipart：`title`、`body` = Markdown、`image`）。末尾に追加する |
| PATCH | `/admin/model_assets/:id/assembly_steps/:step_id` | 手順の更新（`title`、`body`、`image`、`remove_image`、`position` = 1始まりの並び順） |
| DELETE | `/admin/model_assets/:id/assembly_steps/:step_id` | 手順の削除（並び順を詰める） |
| POST | `/admin/model_assets/:id/photos` | 写真の追加（multipart：`files[]`（複数可）、`kind` = `real_model` 実モデル画像 / `in_use` 実利用画像）。JPEG/PNG/WebP・10MB・種類ごとに20枚まで。プレビュー表示が3枚に満たなければ追加分から自動で `featured` |
| PATCH | `/admin/model_assets/:id/photos/:photo_id` | 写真の更新（`caption`、`featured`（モデルごとに最大3枚。超えると `422`）、`kind`、`position` = 種類ごとの並び順） |
| DELETE | `/admin/model_assets/:id/photos/:photo_id` | 写真の削除（並び順を詰める） |
| POST | `/admin/model_assets/:id/assembly_import` | Markdown ファイル（1MB・UTF-8）から部品・工具と手順を取り込む（multipart：`file`、`dry_run`、`mode` = `append` / `replace`）。`dry_run=true` は登録せず `{ assembly_notes（無ければ null）, steps: [{ title, body }], warnings }` を返す。取り込めるものがなければ `422 import_failed` |

- 版の JSON：`{ id, number, minor, label（表示用。"3" / "3.1"）, note, current, byte_size（合計）, files: [{ id, filename, format, byte_size, previewable（3Dモデルは STL/OBJ/3MF、DIY設計図は PDF/PNG/JPG/JPEG/SVG/DXF/STL/OBJ/3MF）, category（`all_in_one` / `parts` / `other`） }], created_at, created_by }`。一覧の `current_version` は `{ number, minor, label, files_count, formats, categories（その他以外で含まれるカテゴリ） }`。ZIP 名・組み立て説明書 PDF の版も `label` で表す。
- 写真の JSON：`{ id, kind, kind_label, caption, featured, position, url }`。一覧・詳細は `preview_photos`（featured の最大3枚）と `photos_count`、詳細は全件の `photos` を返す。
- 更新系はすべて最新の詳細を返す。

### 22.14 管理 — スタッフ権限（管理者専用）

| Method | Path | 説明 |
|---|---|---|
| GET | `/admin/users` | スタッフ・管理者の一覧（`role`、`permissions`）。params：`q`（名前・メール。指定時は会員も検索） |
| PATCH | `/admin/users/:id` | ロール・権限の設定（body：`role` = `member` / `staff` / `admin`、`permissions` = `sales` / `production` / `orders` の配列。スタッフのみ有効）。不明な権限・自分自身のロールの変更（`own_role`）は `422` |

## 23. 非機能要件

| 項目 | 内容 |
|---|---|
| 同時接続 | 100セッション程度 |
| 応答時間 | 検索 95p < 500ms、注文確定 95p < 1.5s |
| 可用性 | 開発環境のため SLA なし（本番は別に定める） |
| 通信 | すべての API は HTTPS を前提とする（本番） |
| 認証 | パスワードは bcrypt（cost=12）、JWT は HS256・有効期限1時間・リフレッシュトークン7日 |
| 認可 | 管理 API はコントローラごとに必要な権限を宣言して検査する。顧客の API は自分のデータにだけアクセスできる（[第19章](#19-認証の実装)） |
| ログ | Rails の標準出力 → Docker logs |
| ファイル | ActiveStorage のディスク（`/app/storage`）。本番は名前付きボリュームに置く |
| アップロードの上限 | Nginx の `client_max_body_size` は110MB（3Dモデルデータの最大100MBに合わせる） |

---

# 付録

## 24. 決定事項

| # | 決定内容 |
|---|---|
| D1 | カテゴリは `3d-prints` / `3d-models` / `diy-plans` / `handmade` / `materials` / `custom` の6つとする（`diy-plans` は 2026-09 に追加）。ライダーズカフェ期の旧カテゴリ（coffee / parts / maintenance / system）は廃止し、注文履歴のある旧商品は非公開にして残す |
| D2 | オーダーメイド（`custom`）はカートで購入させず、依頼フォームから問い合わせと同じ仕組み（`service_requests`）で受け付ける |
| D3 | 注文ステータスは8段階（＋キャンセル）とし、制作ボードの列と顧客のステッパーに同じものを使う。工程は飛ばす・戻すことができるが、入金確認前は制作・発送へ進めない |
| D4 | 材料在庫は販売在庫とは別に持つ。在庫のマイナスを許容し、発注点以下を警告する。消費は「制作中」への移動で1注文1回だけ行う |
| D5 | デジタル商品は1ライセンス単位（数量1）で、再購入は不可・再ダウンロードは何度でも可とする。配布ファイルの恒久 URL は公開せず、本人にだけ5分の署名付き URL を払い出す |
| D6 | 3Dモデルは販売フラグでショップの商品（SKU `MDL-<id>`）と連動させ、最新版のファイルを配布する。モデルを削除しても、注文から参照される商品は削除せず非公開にする |
| D7 | 管理画面は Web のみとし、モバイルアプリは顧客向けにする |
| D8 | スタッフの権限は「販売」「制作」「注文」の組み合わせとする。可否は常に API が判定し、Web のメニューの出し分けは表示のためだけに使う |
| D9 | Dify は本リポジトリの compose に含めず、公式の compose を別のディレクトリで起動する（同梱の Nginx・Rails と同一オリジンにできず、Cookie 認証が壊れるため）。Dify が未設定でも、AIコンシェルジュ以外の機能は動く |
| D10 | 投げ銭はカード決済を使わず、入金は店舗が確認する。投げ銭は注文の売上に含めず、別に集計する |
| D11 | 入金後のキャンセルの返品・返金は、店舗が個別に対応する（自動の在庫戻し・返金はしない） |
| D12 | 3Dモデルの写真は、保存前にブラウザで長辺1920pxの JPEG に縮小し、位置情報などの EXIF を取り除く |
| D13 | DIY設計図は別機能にせず、3Dモデル管理の種別（`kind = blueprint`）として扱う。版管理・写真・組み立て方法・販売・配布の仕組みと API を共通にし、形式・プレビュー・販売先カテゴリ（`diy-plans`、SKU `DIY-<id>`）だけを種別で切り替える |
| D14 | 版のファイルは作成後に変えない。最新版へのファイル追加は、ファイルを引き継いだ枝番の版（v3.1）として作り、いつ追加したかを履歴に残す |
| D15 | 版の中のファイルのカテゴリ（オールインワン / 分割 / その他）は固定の3種類にする。カテゴリはファイルへのラベルで中身ではないので、D14 と違い登録済みの版でも変えられる（配布 ZIP のフォルダ分けは作り直す） |

## 25. 未決事項

| # | 論点 | 選択肢の例 |
|---|---|---|
| Q1 | ステータス変更・問い合わせへの回答を、顧客にどう知らせるか | メール / プッシュ通知 / 画面で確認するだけ（現在の仕様） |
| Q2 | オーダーメイド依頼を注文にする方法 | 見積もりの承諾で注文を作り制作ボードに載せる / 依頼のステータス管理だけ（現在の仕様） |
| Q3 | 入金後のキャンセルで、在庫戻しと返金を自動にするか | 在庫戻しと Stripe の返金を自動で行う / 個別対応（現在の仕様。D11） |
| Q4 | 材料の入出庫履歴を持つか | 履歴のテーブルを追加し棚卸し差異を追えるようにする / 在庫数のみ（現在の仕様） |
| Q5 | 制作スタッフ向けのモバイル画面を作るか | 制作ボードをモバイルに追加する / Web のみ（現在の仕様。D7） |
| Q6 | AIコンシェルジュに進行中の問い合わせ・依頼を渡すか | `service_requests` を文脈に加える / 会員名・カート・直近の注文のみ（現在の仕様） |
