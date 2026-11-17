# 利用者と SSO のアカウント (ID トークンの sub) の連携
class UserIdentity < ApplicationRecord
  belongs_to :user
end
