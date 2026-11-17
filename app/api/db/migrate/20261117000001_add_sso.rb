# SSO (共通の認証サーバー。OpenID Connect)。仕様は認証サーバー (別リポジトリ) のアプリ連携の手順
class AddSso < ActiveRecord::Migration[7.2]
  def change
    # 利用者と SSO のアカウント (ID トークンの sub) の連携。1 人に 1 つ、1 つの sub は 1 人だけ
    create_table :user_identities do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.string :provider, null: false, limit: 32
      t.string :subject, null: false
      t.string :email
      t.datetime :last_login_at
      t.timestamps
      t.index %i[provider subject], unique: true
      t.index %i[user_id provider], unique: true
    end

    # SSO の途中の状態。state・intent・結果コードはハッシュだけを持ち、使ったら消す
    create_table :oauth_flows do |t|
      t.string :mode, null: false, limit: 8
      t.references :user, foreign_key: { on_delete: :cascade }, index: false
      t.string :intent_hash, limit: 64, index: { unique: true }
      t.string :state_hash, limit: 64, index: { unique: true }
      t.string :nonce, limit: 64
      t.string :server_verifier, limit: 64
      t.string :client_challenge, limit: 64
      t.string :return_to, limit: 2048
      t.string :result_hash, limit: 64, index: { unique: true }
      t.string :result_subject
      t.string :result_email
      t.datetime :expires_at, null: false, index: true
      t.datetime :created_at, null: false
    end

    # 「SSO だけでログインする」
    add_column :users, :sso_only, :boolean, null: false, default: false
  end
end
