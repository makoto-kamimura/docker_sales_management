require "jwt"

class JsonWebToken
  ALGORITHM = "HS256".freeze
  ACCESS_EXP = 1.hour
  REFRESH_EXP = 7.days

  class << self
    def encode_access(user_id:)
      encode(sub: user_id, type: "access", exp: ACCESS_EXP.from_now.to_i)
    end

    def encode_refresh(user_id:)
      encode(sub: user_id, type: "refresh", exp: REFRESH_EXP.from_now.to_i)
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
