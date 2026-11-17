require "jwt"

class JsonWebToken
  ALGORITHM = "HS256".freeze
  ACCESS_EXP = 1.hour
  REFRESH_EXP = 7.days
  # ログインした方法。amr クレームに入れ、「SSO だけ」の判定に使う (以前のトークン = 方法なしは pwd)。
  # リフレッシュしても引き継ぐ
  LOGIN_PASSWORD = "pwd".freeze
  LOGIN_SSO = "sso".freeze

  class << self
    def encode_access(user_id:, method: LOGIN_PASSWORD)
      encode(sub: user_id, type: "access", exp: ACCESS_EXP.from_now.to_i, amr: [method])
    end

    def encode_refresh(user_id:, method: LOGIN_PASSWORD)
      encode(sub: user_id, type: "refresh", exp: REFRESH_EXP.from_now.to_i, amr: [method])
    end

    def login_method(payload)
      amr = payload[:amr]
      amr.is_a?(Array) && amr.include?(LOGIN_SSO) ? LOGIN_SSO : LOGIN_PASSWORD
    end

    def decode(token)
      payload, _ = JWT.decode(token, secret, true, algorithm: ALGORITHM)
      payload.with_indifferent_access
    rescue JWT::DecodeError
      nil
    end

    private

    def encode(payload)
      JWT.encode(payload, secret, ALGORITHM)
    end

    def secret
      ENV.fetch("JWT_SECRET") { Rails.application.secret_key_base }
    end
  end
end
