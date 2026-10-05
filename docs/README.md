# docs

仕様書の本体はリポジトリ直下の [README.md](../README.md)。`docs/` には、それ以外の資料を種類ごとのフォルダに分けて置く。

| フォルダ | 置くもの | 書く人 |
|---|---|---|
| [design/](design/) | 設計・計画・デザインの資料（[トップのヒーローアニメーションの原案](design/hero.html)） | 人 |
| [runbooks/](runbooks/) | 運用手順書（作業ごと。[開発環境の起動・トラブルシュート](runbooks/development.md)、[カード決済（Stripe）の設定](runbooks/stripe.md)） | 人 |
| [incidents/](incidents/) | 障害のふりかえり（`YYYY-MM-DD-<概要>.md`） | 人 |
| [automation/](automation/) | 定期的に回す作業やエージェントに任せる作業の手順 | 人（エージェントに変えさせない） |
| [tasks/](tasks/) | 不具合・要望・残作業のタスク（[残タスクの一覧](tasks/task.md)） | 人・エージェント |

- まだ中身のないフォルダには、フォルダを git に残すための `.gitkeep` を置いている。中身ができても消さなくてよい。
- 不具合・要望のタスクは `tasks/` にだけ置く。設計・運用の資料と混ぜない。
- 仕様（機能・画面・データモデル・API）は README に書き、`docs/` に仕様書の写しを作らない。
- 本番サーバーの IP・接続先など公開しない情報は `docs/` に置いてもコミットしない（例：Expo Go 用の `docs/qr.*` は `.gitignore` 済み）。
