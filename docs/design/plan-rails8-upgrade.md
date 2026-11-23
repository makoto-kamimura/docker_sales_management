# API を Rails 8 へ上げる計画

作成: 2026-11-23。**状態: 2026-11-23 に実施した（Rails 8.1.4.1）。** 実施の内容と計画との違いは[第 10 章](#10-実施の記録)。README には決定事項 D21 として反映した。

## 1. なぜ上げるか

- Rails 7.2 のセキュリティ修正の提供は 2026-08-09 で終わった（README の決定事項 D21。もとは未決事項 Q7）。以降の修正は 8 系にだけ出るので、8 系へ上げる（7.2.4 は不具合の修正版で、`connection_pool` を 3 未満に戻す必要があるので入れていない）。
- 2026-11-23 に、Rails の外の gem（puma・rack・nokogiri・loofah など）は 7.2 のまま上げた。残っているのは Rails 本体と rubyzip（第 5 章）だけである。

## 2. 目標の版

**Rails 8.1 系（2026-11 時点で 8.1.4.1）へ、7.2 から直接上げる。** 8.0 系はサポートの期限が 8.1 より先に来るので、途中で止めない。
各版のサポートの期限は、作業を始める前に <https://rubyonrails.org/maintenance> で確かめる。

- Ruby は今の 3.3.5 のまま上げられる（8.0 / 8.1 とも Ruby 3.2 以上）。Ruby の上げ（3.3 の最新パッチ / 3.4）は別の変更にする。
- `config.load_defaults` は、まず 7.2 のまま Rails だけを上げ、動いてから `new_framework_defaults_8_0.rb` / `_8_1.rb` の項目を 1 つずつ有効にして、最後に `load_defaults 8.1` にする。

## 3. 今の構成で関係する所

`Gemfile.lock` と使っている機能から、変える必要がある所をまとめる。

### 3.1 gem

| gem | 今の版 | Rails 8.1 で | 対応 |
|---|---|---|---|
| rails | 7.2.3.2 | - | `gem "rails", "~> 8.1.4"` |
| rspec-rails | 7.1.1（`~> 7.0`） | 7.1 は Rails 8.0 まで。8.1 は rspec-rails 8 が対応 | `gem "rspec-rails", "~> 8.0"` |
| connection_pool | 3.0.3 | activesupport 8 は `>= 2.2.5`（制約なし） | そのまま |
| neighbor | 1.1.1 | activerecord `>= 7.2` | そのまま |
| pg_search | 2.3.7 | activerecord `>= 6.1` | そのまま（動作はテストで確かめる） |
| factory_bot_rails / dotenv-rails / rack-cors / bootsnap / brakeman / rubocop-rails-omakase | - | Rails 8 に対応済み | そのまま（`bundle update --conservative` で上がる分だけ） |
| jwt / bcrypt / stripe / anthropic / faraday / prawn / kramdown / pg / puma | - | Rails に依存しない | そのまま |

### 3.2 アプリのコードと設定

| 所 | 今の形 | 確かめること・変えること |
|---|---|---|
| `config/application.rb` | `action_mailbox` / `action_text` / `action_cable` の engine を読み込んでいるが、使っていない（テーブルもない） | 読み込みをやめると、Action Mailbox の受信口などの使わないルートがなくなる。8.1 に上げる前の別の変更にしてもよい（Q7） |
| `config/environments/production.rb` | 本番ではこのファイルをホストからマウントしている | `bin/rails app:update` の差分を取り込む。**作業ツリーのこのファイルは、イメージを作り直さなくてもコンテナの再起動で本番に効く**ので、7.2 と 8.1 の両方で動く書き方にするか、イメージの反映と同時に入れる |
| `config/environments/test.rb` | `disallowed_deprecation = :raise`（対象は空） | 上げる前に 7.2 で `RAILS_ENV=test` の非推奨の警告を出し切り、0 にしておく |
| `ActiveRecord::Base.transaction` の中の `purge_later` | `ModelVersion#recategorize!`、組み立て手順の画像の差し替え | Active Job の「コミット後に積む」の既定値が 8.x で変わっている。ロールバックしたときに、ファイルが消されないことをテストで確かめる |
| Active Job のアダプター | 設定なし（`:async`、プロセスの中） | 8 でも、設定しなければ `:async` のまま。Solid Queue は入れない |
| Active Storage | ディスク（`local`）、署名付き URL（`rails_service_blob_path`）、`has_many_attached` / `has_one_attached`、ZIP を blob で作って添付 | 署名 URL の形と期限、`purge_later`、ZIP の配布（`ModelVersion#bundle_blob!`）を request spec で確かめる。variant・プレビューは使っていない |
| `db/schema.rb` | `ActiveRecord::Schema[7.2]` | 上げるだけではマイグレーションは要らない。8.1 では `schema.rb` の列が名前順に並ぶので、差分が大きくなる（中身は変わらない）。拡張（`citext`・`pg_trgm`・`pgcrypto`・`vector`）の書き出しを確かめる |
| `enum` / `serialize` / `Rails.application.secrets` / `ActiveRecord::Base.connection` | 使っていない | 8.0 で消えた・非推奨になった API には当たらない（`grep` で確かめた） |
| `Strong Parameters` | `permit` と `require` | 8.0 の `params.expect` に移すかは任意。管理画面の `permit!` は 2026-11-23 になくした |
| ヘルスチェック | `GET /up`（`rails/health#show`） | そのまま |

## 4. リスク

| リスク | 起きること | 抑え方 |
|---|---|---|
| 既定値の変更 | 時刻の扱い（`to_time` のタイムゾーン）、JSON の書き出し、`schema.rb` の形などが変わる | `load_defaults` を 7.2 のまま上げ、既定値は 1 つずつ有効にする |
| 本番の設定ファイルのずれ | `production.rb` をホストからマウントしているので、イメージと設定の版がずれると起動しない | 両方の版で動く書き方にするか、同時に入れる。起動のログを見てから公開の確認をする |
| 起動時の `db:prepare` | 本番は起動のたびに `rails db:prepare` を動かす | 上げの変更にマイグレーションを入れない。入れる場合は別の反映にする |
| pg_search・neighbor の SQL | 検索・おすすめの結果が変わる | 検索とベクトル検索の request spec、本番での検索の確認 |
| Active Storage の配布 | 購入者のダウンロード・ZIP が壊れる | 配布と ZIP の request spec、本番での署名 URL の確認 |
| メモリ | Rails 8.1 で常駐のメモリが少し増える | 反映の前後でコンテナのメモリを比べる |

## 5. 一緒に考えること

- **rubyzip 3.x**: 2.4.1 から 3 系へ上げる。メジャーの上げなので別の変更にする（`Zip::OutputStream.open` と `Zip.unicode_names` の使い方を 3.x の変更点と見比べる）。
- **Ruby 3.3 の最新パッチ**: Dockerfile の `ruby:3.3.5-slim` を上げる。Rails とは別に反映する。

## 6. 進め方

1. **7.2 のうちに片づける**（半日）
   - テストを全部通す。非推奨の警告を出し切って直す。
   - （任意）使っていない engine の読み込みをやめる（Q7）。
2. **Rails 8.1 へ上げる**（半日〜1 日）
   - `Gemfile` の rails と rspec-rails を上げ、`bundle update rails rspec-rails --conservative`。
   - `bin/rails app:update` を動かし、差分を 1 つずつ取り込む（自分で直した設定を上書きしない）。
   - `load_defaults` は 7.2 のまま。テストと brakeman・`bundler-audit` を通す。
3. **既定値を 8.1 に寄せる**（半日）
   - `new_framework_defaults_8_1.rb` の項目を 1 つずつ有効にしてテストを通し、最後に `load_defaults 8.1` にしてファイルを消す。
4. **本番へ反映する**（1〜2 時間。そのうち止まるのは数十秒）

## 7. テストの方法

- RSpec の全体（`spec/` の request / model / service、2026-11 時点で 24 ファイル）を、手元の使い捨ての PostgreSQL（pgvector 付き）に向けて動かす。手順は README のクイックスタートのテストの節のとおりで、本番の DB には向けない。
- 静的な確認: `brakeman`（`bin/brakeman` が最新版の確認で止まるときは `--no-pager` を付け、bundler から直接読み込む）、`bundler-audit`、`rubocop`。
- 手で確かめること（本番に近いイメージを手元で起動して）: ログイン（パスワード・SSO）、商品の一覧と検索、カートと注文、カード決済の Webhook（テスト用のキー）、3D モデルの版の登録・カテゴリの変更・ZIP のダウンロード、組み立て説明書の PDF、AIコンシェルジュ（キーがあるとき）。
- 本番のデータでの確かめが必要なら、本番の DB のダンプを使い捨ての DB に入れて行う（ダンプの扱いは運用の担当者に確かめる）。

## 8. 本番への反映の手順

1. 本番の DB のバックアップを取る。
2. 今のイメージに戻し用のタグを付ける（`docker tag <今のイメージ> <イメージ>:rollback-YYYYMMDD`）。
3. 新しいイメージを作る（重い処理なので、メモリの空きを確かめ、ほかのビルドと重ねない）。
4. `production.rb` を変える場合は、この時点で入れる（第 3.2 節）。
5. API のコンテナだけを作り直す（依存するほかのサービスを作り直さないようにし、先に dry-run で対象を確かめる）。
6. 起動のログで `db:prepare` と Puma の起動を確かめ、公開の API（商品の一覧・ヘルスチェック）と、Web の画面（ログイン・商品・管理画面の 3D モデル）を確かめる。
7. 戻すとき: 戻し用のタグを元の名前に付け直し、`production.rb` を戻して、API のコンテナを作り直す。マイグレーションを入れていなければ DB は戻さなくてよい。

## 9. 見積もり

| 作業 | 時間 |
|---|---|
| 7.2 のうちの片づけ | 0.5 日 |
| 8.1 への上げとテスト | 0.5〜1 日 |
| 既定値の切り替え | 0.5 日 |
| 本番への反映と確認 | 1〜2 時間 |
| 合計 | 1.5〜2.5 日 |

## 10. 実施の記録

2026-11-23 に、7.2.3.2 から 8.1.4.1 へ直接上げた。

| 項目 | 実施したこと | 計画との違い |
|---|---|---|
| gem | `rails ~> 8.1.4`、`rspec-rails ~> 8.0`（8.1.0）、`rubyzip ~> 3.4`（3.7.0） | rubyzip 3 は別の変更にする予定だったが、使っている API（`Zip::OutputStream.open`・`put_next_entry`・`Zip::File.open_buffer`・`Zip.unicode_names`）がそのまま動いたので一緒に上げた |
| `bundler-audit` | 指摘なし | - |
| 既定値 | `config.load_defaults 8.1` にした（`new_framework_defaults_8_1.rb` は作らない） | 1 つずつ有効にする予定だったが、当たる所を調べて一度に切り替えた。`to_time`・`fresh_when` / `stale?`・パスの相対リダイレクト・ビューは使っていない。JSON の HTML のエスケープをやめる既定値は、JSON を HTML に埋め込んでいないので影響しない |
| `bin/rails app:update` | 差分を読み、`filter_parameter_logging.rb` に `:cvv`・`:cvc` を足しただけにした | `production.rb`・`test.rb`・`development.rb`・`cors.rb`・`puma.rb`・`bin/setup` は、コメントの書き換えか、このアプリでは使わない設定（Solid Queue・`bin/dev`・CI）なので取り込まない。`production.rb` は 7.2 と 8.1 のどちらでも動く今のままにした |
| Active Storage のマイグレーション | `app:update` が写す 3 本（`service_name`・`variant_records`・`checksum` の NULL 可）は入れない | 2026-05 の最初のマイグレーションで、これらはすでに入っている（`schema.rb` で確かめた） |
| 使っていない engine | Action Mailbox・Action Text を読み込まない（`/rails/action_mailbox/...`・`/rails/conductor/...` のルートがなくなる） | Action Cable は `app/channels` があるので残した |
| Active Storage の画像の変換 | `config.active_storage.variant_processor = :disabled` | 8.1 が image_processing gem がないと起動時に警告を出すため。variant は使っていない |
| ステータスのシンボル | `:unprocessable_entity` を `:unprocessable_content` に替えた（コードとテスト） | Rack 3.2 が古い名前を非推奨にしている。応答のコードは同じ 422 |
| テスト | RSpec 173 件がすべて通った。brakeman は Rails のサポート終了の警告が消えた | - |
| 本番 | まだ流れていないマイグレーションがないことを、本番の DB に読み取り専用の接続（`default_transaction_read_only=on`）で確かめてから、API のコンテナだけを作り直した | - |

