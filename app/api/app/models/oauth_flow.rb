# SSO の途中の状態 (state・intent・結果コードはハッシュだけ。使ったら消す)
class OauthFlow < ApplicationRecord
  belongs_to :user, optional: true
end
