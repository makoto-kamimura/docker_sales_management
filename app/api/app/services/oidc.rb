require "openssl"

# SSO (OpenID Connect) のクライアント。接続先は設定の発行元 (OIDC_ISSUER) だけで決まり、
# エンドポイントと公開鍵は /.well-known/openid-configuration から読む。
#
# 乗っ取りを防ぐ要 (認証サーバー (別リポジトリ) のアプリ連携の手順の 2.2):
# - ID トークンは公開鍵 (JWKS) で署名を確かめ、iss・aud・exp・nonce も確かめる
# - 利用者の特定には sub だけを使う
# - 戻ったあとは使い捨ての結果コードを返し、開始したクライアントの code_verifier と引き換える
#
# 署名の確認は OpenSSL で直接行う (許す方式を明示し、鍵の種類と方式の取り違えを起こさないため)
module Oidc
  PROVIDER = "sso".freeze
  CACHE_TTL = 3600             # 設定の公開と公開鍵を読み直す間隔 (秒)
  JWKS_FORCE_REFRESH_MIN = 10  # 知らない kid のときに公開鍵を読み直してよい最短の間隔 (秒)
  LEEWAY = 60                  # 時計のずれの許容 (秒)
  # ID トークンの署名に許す方式。共通鍵 (HS*) と none は許さない
  ALLOWED_ALGS = %w[RS256 RS384 RS512 PS256 PS384 PS512 ES256 EdDSA].freeze
  # Ed25519 の公開鍵 (32 バイト) を SubjectPublicKeyInfo にする前置き
  ED25519_SPKI_PREFIX = ["302a300506032b6570032100"].pack("H*").freeze

  class Rejected < StandardError
    attr_reader :reason

    def initialize(reason)
      @reason = reason
      super(reason)
    end
  end

  Key = Struct.new(:kid, :kty, :alg, :pkey)

  module_function

  # ---- 設定 -------------------------------------------------------------------

  def env(name, default = "")
    ENV.fetch(name, default).to_s.strip
  end

  def list(name, default)
    env(name, default).split(",").map(&:strip).reject(&:empty?)
  end

  def flag(name, default)
    %w[true 1 yes].include?(env(name, default ? "true" : "false").downcase)
  end

  def issuer = env("OIDC_ISSUER")
  def client_id = env("OIDC_CLIENT_ID")
  def client_secret = env("OIDC_CLIENT_SECRET")
  def public_base_url = env("PUBLIC_BASE_URL").chomp("/")
  def display_name = env("OIDC_DISPLAY_NAME", "SSO").presence || "SSO"
  def scope = env("OIDC_SCOPE", "openid email profile").presence || "openid email profile"
  def require_mfa? = flag("OIDC_REQUIRE_MFA", true)
  def mobile_redirect_prefixes = list("OIDC_MOBILE_REDIRECT_PREFIXES", "craftflow://,exp://")
  def link_deny_domains = list("OIDC_LINK_DENY_EMAIL_DOMAINS", "example.com").map(&:downcase)
  def allow_password_for_sso_only? = flag("OIDC_ALLOW_PASSWORD_FOR_SSO_ONLY", false)

  def enabled?
    [issuer, client_id, client_secret, public_base_url].all?(&:present?)
  end

  def callback_url = "#{public_base_url}/api/v1/auth/sso/callback"
  def web_return_url = "#{public_base_url}/auth/sso/complete"

  # このログイン方法 (pwd / sso) を、この利用者に許すか (「SSO だけ」の判定)。
  # SSO が無効な環境と、非常用の切り替え (OIDC_ALLOW_PASSWORD_FOR_SSO_ONLY) では、パスワードも許す
  def login_method_allowed?(user, method)
    return true if method == "sso" || !user.sso_only?

    !enabled? || allow_password_for_sso_only?
  end

  # ---- 乱数・PKCE・戻り先 -------------------------------------------------------

  def b64url(bytes) = Base64.urlsafe_encode64(bytes, padding: false)

  def b64url_decode(str)
    raise ArgumentError, "not base64url" unless str.is_a?(String) && str.match?(/\A[A-Za-z0-9_-]*\z/)

    Base64.urlsafe_decode64(str + ("=" * (-str.length % 4)))
  end

  # 推測できない 32 バイトの乱数 (base64url、43 文字)
  def random_token = b64url(SecureRandom.random_bytes(32))

  # DB に保存するためのハッシュ。トークンそのものは保存しない
  def hash_token(token) = b64url(OpenSSL::Digest::SHA256.digest(token.to_s))

  def pkce_challenge(verifier) = b64url(OpenSSL::Digest::SHA256.digest(verifier.to_s))

  def valid_verifier?(v) = v.is_a?(String) && v.match?(/\A[A-Za-z0-9\-._~]{43,128}\z/)
  def valid_challenge?(c) = c.is_a?(String) && c.match?(/\A[A-Za-z0-9\-_]{43}\z/)

  def verify_pkce(verifier, challenge)
    valid_verifier?(verifier) && ActiveSupport::SecurityUtils.secure_compare(challenge.to_s, pkce_challenge(verifier))
  end

  # モバイルの戻り先が許可リストの先頭に一致するか (http・https・フラグメント付きは拒否)
  def mobile_redirect_allowed?(uri, prefixes)
    return false unless uri.is_a?(String) && !uri.include?("#")

    scheme = uri[/\A([A-Za-z][A-Za-z0-9+.\-]*):/, 1]&.downcase
    return false if scheme.nil? || %w[http https].include?(scheme)

    prefixes.any? { |p| p.present? && uri.start_with?(p) }
  end

  def with_query(base, key, value)
    "#{base}#{base.include?('?') ? '&' : '?'}#{ERB::Util.url_encode(key)}=#{ERB::Util.url_encode(value)}"
  end

  # このメールアドレスの利用者に連携させないか (デモ用アカウント)
  def link_denied?(email, deny_domains)
    email = email.to_s.strip.downcase
    return true unless email.include?("@")

    deny_domains.include?(email.rpartition("@").last)
  end

  # ---- ID トークンの確認 ---------------------------------------------------------

  def bn(b64) = OpenSSL::BN.new(b64url_decode(b64), 2)

  def rsa_key(n, e)
    der = OpenSSL::ASN1::Sequence([OpenSSL::ASN1::Integer(bn(n)), OpenSSL::ASN1::Integer(bn(e))]).to_der
    spki = OpenSSL::ASN1::Sequence([
      OpenSSL::ASN1::Sequence([OpenSSL::ASN1::ObjectId("rsaEncryption"), OpenSSL::ASN1::Null(nil)]),
      OpenSSL::ASN1::BitString(der)
    ])
    OpenSSL::PKey.read(spki.to_der)
  end

  def ec_key(x, y)
    xb = b64url_decode(x)
    yb = b64url_decode(y)
    raise ArgumentError, "bad P-256 point" unless xb.bytesize == 32 && yb.bytesize == 32

    point = "\x04".b + xb + yb
    spki = OpenSSL::ASN1::Sequence([
      OpenSSL::ASN1::Sequence([OpenSSL::ASN1::ObjectId("id-ecPublicKey"), OpenSSL::ASN1::ObjectId("prime256v1")]),
      OpenSSL::ASN1::BitString(point)
    ])
    OpenSSL::PKey.read(spki.to_der)
  end

  def ed25519_key(x)
    raw = b64url_decode(x)
    raise ArgumentError, "bad Ed25519 key" unless raw.bytesize == 32

    OpenSSL::PKey.read(ED25519_SPKI_PREFIX + raw)
  end

  # 公開鍵の一覧 (JWKS) から、読めた署名用の鍵だけを kid => Key にする (知らない種類の鍵は飛ばす)
  def parse_jwks(jwks)
    keys = {}
    Array(jwks.is_a?(Hash) ? jwks["keys"] : nil).each do |jwk|
      next unless jwk.is_a?(Hash) && jwk["kid"].present? && (jwk["use"] || "sig") == "sig"

      pkey =
        begin
          case [jwk["kty"], jwk["crv"]]
          in ["RSA", _] then rsa_key(jwk["n"], jwk["e"])
          in ["EC", "P-256"] then ec_key(jwk["x"], jwk["y"])
          in ["OKP", "Ed25519"] then ed25519_key(jwk["x"])
          else next
          end
        rescue StandardError
          next # 使えない鍵は飛ばす
        end
      keys[jwk["kid"].to_s] = Key.new(jwk["kid"].to_s, jwk["kty"], jwk["alg"], pkey)
    end
    keys
  end

  def header(token)
    parts = token.to_s.split(".", -1)
    return nil unless parts.size == 3

    h = JSON.parse(b64url_decode(parts[0]))
    h.is_a?(Hash) ? h : nil
  rescue StandardError
    nil
  end

  # 方式と鍵の種類が合わなければ、署名を見る前に断る (RS 鍵で別の方式を名乗らせない)
  def verify_signature!(alg, key, data, sig)
    digest = "SHA#{alg[2..]}"
    ok =
      if alg.start_with?("RS") && key.kty == "RSA"
        key.pkey.verify(digest, sig, data)
      elsif alg.start_with?("PS") && key.kty == "RSA"
        key.pkey.verify_pss(digest, sig, data, salt_length: :digest, mgf1_hash: digest)
      elsif alg == "ES256" && key.kty == "EC"
        raise Rejected, "signature" unless sig.bytesize == 64

        der = OpenSSL::ASN1::Sequence([
          OpenSSL::ASN1::Integer(OpenSSL::BN.new(sig[0, 32], 2)),
          OpenSSL::ASN1::Integer(OpenSSL::BN.new(sig[32, 32], 2))
        ]).to_der
        key.pkey.verify("SHA256", der, data)
      elsif alg == "EdDSA" && key.kty == "OKP"
        key.pkey.verify(nil, sig, data)
      else
        raise Rejected, "alg_mismatch"
      end
    raise Rejected, "signature" unless ok
  rescue OpenSSL::PKey::PKeyError
    raise Rejected, "signature"
  end

  # ID トークンの署名と中身を確かめて claims を返す。受け付けないときは Rejected
  def verify_id_token(token, keys, issuer:, client_id:, nonce:, require_mfa:, now: Time.now.to_i)
    h = header(token) or raise Rejected, "header"
    alg = h["alg"]
    raise Rejected, "alg" unless ALLOWED_ALGS.include?(alg)

    kid = h["kid"]
    raise Rejected, "kid" unless kid.is_a?(String) && kid.present?

    key = keys[kid] or raise Rejected, "unknown_kid"
    raise Rejected, "alg_mismatch" if key.alg && key.alg != alg

    head, body, sig = token.split(".", -1)
    signature = begin
      b64url_decode(sig)
    rescue ArgumentError
      raise Rejected, "signature"
    end
    verify_signature!(alg, key, "#{head}.#{body}", signature)
    claims = begin
      JSON.parse(b64url_decode(body))
    rescue StandardError
      raise Rejected, "claims"
    end
    raise Rejected, "claims" unless claims.is_a?(Hash)

    exp = claims["exp"]
    raise Rejected, "exp" unless exp.is_a?(Numeric) && exp + LEEWAY >= now
    raise Rejected, "nbf" if claims["nbf"].is_a?(Numeric) && claims["nbf"] - LEEWAY > now
    raise Rejected, "iat" if claims["iat"].is_a?(Numeric) && claims["iat"] - LEEWAY > now
    # 設定の公開に書かれた発行元と完全に一致すること
    raise Rejected, "iss" unless claims["iss"] == issuer

    auds = claims["aud"].is_a?(Array) ? claims["aud"] : [claims["aud"]]
    raise Rejected, "aud" unless auds.include?(client_id)
    raise Rejected, "azp" if auds.size > 1 && claims["azp"] != client_id

    got = claims["nonce"]
    raise Rejected, "nonce" unless got.is_a?(String) && ActiveSupport::SecurityUtils.secure_compare(got, nonce)

    sub = claims["sub"]
    raise Rejected, "sub" unless sub.is_a?(String) && sub.present? && sub.bytesize <= 255
    raise Rejected, "mfa_required" if require_mfa && !(claims["amr"].is_a?(Array) && claims["amr"].include?("mfa"))

    claims
  end

  # 末尾の / だけが違う発行元は同じとみなす (設定の書き方の揺れ)
  def same_issuer?(a, b) = a.to_s.chomp("/") == b.to_s.chomp("/")

  # ---- 認証サーバーとの通信 (起動時には取りに行かない)。キャッシュはプロセスごと --------------

  CACHE = {} # rubocop:disable Style/MutableConstant
  LOCK = Mutex.new

  def reset_cache! = LOCK.synchronize { CACHE.clear }

  def now_f = Time.now.to_f

  def connection
    Faraday.new { |f| f.options.timeout = 10; f.options.open_timeout = 5 }
  end

  def http_get_json(url)
    res = connection.get(url, nil, { "Accept" => "application/json" })
    raise "GET #{url} returned #{res.status}" unless res.status == 200

    data = JSON.parse(res.body)
    raise "GET #{url}: not a JSON object" unless data.is_a?(Hash)

    data
  end

  def http_post_form(url, form)
    res = connection.post(url, URI.encode_www_form(form),
                          { "Content-Type" => "application/x-www-form-urlencoded", "Accept" => "application/json" })
    [res.status, res.body.to_s]
  end

  def origin(url)
    u = URI.parse(url)
    "#{u.scheme&.downcase}://#{u.host&.downcase}#{u.port && u.port != u.default_port ? ":#{u.port}" : ''}"
  end

  # 設定の公開を読む。発行元が設定と違う、エンドポイントが発行元と別のオリジン、なら使わない
  def metadata
    hit = LOCK.synchronize { CACHE[:metadata] }
    return hit[1] if hit && now_f - hit[0] < CACHE_TTL

    meta = http_get_json("#{issuer.chomp('/')}/.well-known/openid-configuration")
    %w[issuer authorization_endpoint token_endpoint jwks_uri].each do |k|
      raise "discovery document has no #{k}" unless meta[k].is_a?(String) && meta[k].present?
    end
    raise "discovery issuer #{meta['issuer']} does not match OIDC_ISSUER" unless same_issuer?(meta["issuer"], issuer)

    o = origin(meta["issuer"])
    %w[authorization_endpoint token_endpoint jwks_uri].each do |k|
      raise "#{k} is not on the issuer's origin" unless origin(meta[k]) == o
    end
    LOCK.synchronize { CACHE[:metadata] = [now_f, meta] }
    meta
  end

  def jwks(force: false)
    hit = LOCK.synchronize { CACHE[:jwks] }
    if hit
      age = now_f - hit[0]
      return parse_jwks(hit[1]) if (!force && age < CACHE_TTL) || (force && age < JWKS_FORCE_REFRESH_MIN)
    end
    raw = http_get_json(metadata["jwks_uri"])
    raise "JWKS has no usable keys" if parse_jwks(raw).empty?

    LOCK.synchronize { CACHE[:jwks] = [now_f, raw] }
    parse_jwks(raw)
  end

  def authorization_url(state:, nonce:, server_challenge:)
    q = URI.encode_www_form(
      client_id: client_id, redirect_uri: callback_url, response_type: "code", scope: scope,
      state: state, nonce: nonce, code_challenge: server_challenge, code_challenge_method: "S256"
    ).gsub("+", "%20")
    endpoint = metadata["authorization_endpoint"]
    "#{endpoint}#{endpoint.include?('?') ? '&' : '?'}#{q}"
  end

  # 認可コードを交換して ID トークンを返す
  def exchange_code(code, server_verifier)
    status, body = http_post_form(metadata["token_endpoint"], {
      grant_type: "authorization_code", code: code, redirect_uri: callback_url,
      client_id: client_id, client_secret: client_secret, code_verifier: server_verifier
    })
    # 応答には秘密は含まれない (error と error_description だけ)
    raise "token endpoint returned #{status}: #{body[0, 200]}" unless status == 200

    id_token = JSON.parse(body)["id_token"]
    raise "token response has no id_token" unless id_token.is_a?(String) && id_token.present?

    id_token
  end

  # ID トークンを確かめる。知らない鍵 (鍵の入れ替え直後) なら、公開鍵を 1 回だけ読み直す
  def verify(id_token, nonce)
    iss = metadata["issuer"]
    check = ->(keys) {
      verify_id_token(id_token, keys, issuer: iss, client_id: client_id, nonce: nonce, require_mfa: require_mfa?)
    }
    begin
      check.call(jwks)
    rescue Rejected => e
      raise unless e.reason == "unknown_kid"

      check.call(jwks(force: true))
    end
  end
end
