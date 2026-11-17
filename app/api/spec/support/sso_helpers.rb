# SSO のテスト。偽の認証サーバー (設定の公開・JWKS・トークン) を Oidc の通信に差し込み、本物の鍵で署名する
module SsoHelpers
  ISSUER = "https://auth.test/auth/v1".freeze
  CLIENT_ID = "sales".freeze

  class Signer
    attr_reader :kind, :kid, :jwk

    def initialize(kind, kid)
      @kind = kind
      @kid = kid
      case kind
      when "RS256"
        @key = OpenSSL::PKey::RSA.generate(2048)
        @jwk = { "kty" => "RSA", "kid" => kid, "alg" => "RS256", "use" => "sig",
                 "n" => b64(@key.n.to_s(2)), "e" => b64(@key.e.to_s(2)) }
      when "EdDSA"
        @key = OpenSSL::PKey.generate_key("ED25519")
        @jwk = { "kty" => "OKP", "crv" => "Ed25519", "kid" => kid, "alg" => "EdDSA", "x" => b64(@key.public_to_der[-32..]) }
      else
        @key = OpenSSL::PKey::EC.generate("prime256v1")
        pt = @key.public_key.to_bn.to_s(2)
        @jwk = { "kty" => "EC", "crv" => "P-256", "kid" => kid, "alg" => "ES256", "x" => b64(pt[1, 32]), "y" => b64(pt[33, 32]) }
      end
    end

    def b64(s) = Base64.urlsafe_encode64(s, padding: false)

    def sign(claims, alg: nil, kid: nil)
      head = b64({ alg: alg || kind, kid: kid || @kid, typ: "JWT" }.to_json)
      body = b64(claims.to_json)
      data = "#{head}.#{body}"
      sig =
        case kind
        when "RS256" then @key.sign("SHA256", data)
        when "EdDSA" then @key.sign(nil, data)
        else
          r, s = OpenSSL::ASN1.decode(@key.sign("SHA256", data)).value.map { |i| i.value.to_s(2).rjust(32, "\0") }
          r + s
        end
      "#{data}.#{b64(sig)}"
    end
  end

  def sso_claims(**over) = SsoHelpers.claims(**over)

  def self.claims(**over)
    now = Time.now.to_i
    { "iss" => ISSUER, "aud" => CLIENT_ID, "sub" => "sub-1", "exp" => now + 300, "iat" => now,
      "nonce" => "n0nce", "amr" => %w[pwd mfa], "email" => "me@family.test" }.merge(over.transform_keys(&:to_s)).compact
  end

  # 認可コードと PKCE を確かめ、ID トークンを返す偽の認証サーバー
  class FakeIdp
    attr_accessor :signer
    attr_reader :jwks_hits

    def initialize(signer)
      @signer = signer
      @codes = {}
      @jwks_hits = 0
    end

    def authorize(url, sub: "sub-1", amr: %w[pwd mfa])
      q = Rack::Utils.parse_query(URI.parse(url).query)
      raise "bad client" unless q["client_id"] == CLIENT_ID && q["code_challenge_method"] == "S256"

      code = SecureRandom.hex(8)
      @codes[code] = { q: q, sub: sub, amr: amr }
      "#{q['redirect_uri']}?code=#{code}&state=#{q['state']}"
    end

    def get(url)
      if url.end_with?("/.well-known/openid-configuration")
        { "issuer" => ISSUER, "authorization_endpoint" => "#{ISSUER}/oidc/authorize",
          "token_endpoint" => "#{ISSUER}/oidc/token", "jwks_uri" => "#{ISSUER}/oidc/certs" }
      elsif url.end_with?("/oidc/certs")
        @jwks_hits += 1
        { "keys" => [signer.jwk] }
      else
        raise "GET #{url} returned 404"
      end
    end

    def post(_url, form)
      entry = @codes.delete(form[:code])
      return [400, '{"error":"invalid_grant"}'] if entry.nil? || form[:client_secret] != "s3cret"

      q = entry[:q]
      challenge = Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(form[:code_verifier]), padding: false)
      return [400, '{"error":"invalid_grant"}'] unless challenge == q["code_challenge"] && form[:redirect_uri] == q["redirect_uri"]

      token = signer.sign(SsoHelpers.claims(sub: entry[:sub], nonce: q["nonce"], amr: entry[:amr]))
      [200, { id_token: token, access_token: "x", token_type: "Bearer" }.to_json]
    end
  end

  SSO_ENV = {
    "OIDC_ISSUER" => ISSUER, "OIDC_CLIENT_ID" => CLIENT_ID, "OIDC_CLIENT_SECRET" => "s3cret",
    "PUBLIC_BASE_URL" => "https://sales.test", "OIDC_REQUIRE_MFA" => "true", "OIDC_ALLOW_PASSWORD_FOR_SSO_ONLY" => "false"
  }.freeze

  def with_sso_env(extra = {})
    keys = SSO_ENV.merge(extra)
    saved = keys.keys.index_with { |k| ENV[k] }
    keys.each { |k, v| ENV[k] = v }
    Oidc.reset_cache!
    yield
  ensure
    saved.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
    Oidc.reset_cache!
  end
end

RSpec.configure do |config|
  config.include SsoHelpers
end
