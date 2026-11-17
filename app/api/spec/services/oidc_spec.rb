require "rails_helper"

RSpec.describe Oidc do
  include SsoHelpers

  let(:rsa) { SsoHelpers::Signer.new("RS256", "rsa-1") }
  let(:ed) { SsoHelpers::Signer.new("EdDSA", "ed-1") }
  let(:ec) { SsoHelpers::Signer.new("ES256", "ec-1") }
  let(:keys) { Oidc.parse_jwks("keys" => [rsa.jwk, ed.jwk, ec.jwk]) }

  def verify(token, require_mfa: true)
    Oidc.verify_id_token(token, keys, issuer: SsoHelpers::ISSUER, client_id: SsoHelpers::CLIENT_ID,
                                      nonce: "n0nce", require_mfa: require_mfa)
  end

  def rejected(token, **kw)
    verify(token, **kw)
    nil
  rescue Oidc::Rejected => e
    e.reason
  end

  def b64(s) = Base64.urlsafe_encode64(s, padding: false)

  it "各方式の正しいトークンを受け付ける" do
    [rsa, ed, ec].each { |s| expect(verify(s.sign(sso_claims))["sub"]).to eq "sub-1" }
  end

  it "正しくないトークンを断る" do
    other = SsoHelpers::Signer.new("RS256", "rsa-1") # 同じ kid の別の鍵
    expect(rejected(other.sign(sso_claims))).to eq "signature"
    head, _body, sig = rsa.sign(sso_claims).split(".")
    expect(rejected("#{head}.#{b64(sso_claims(sub: 'x').to_json)}.#{sig}")).to eq "signature"
    # HS256 (公開鍵を共通鍵として使わせる攻撃) と none
    h = b64({ alg: "HS256", kid: "rsa-1" }.to_json)
    b = b64(sso_claims.to_json)
    mac = OpenSSL::HMAC.digest("SHA256", rsa.jwk.to_json, "#{h}.#{b}")
    expect(rejected("#{h}.#{b}.#{b64(mac)}")).to eq "alg"
    expect(rejected("#{b64({ alg: 'none', kid: 'rsa-1' }.to_json)}.#{b}.")).to eq "alg"
    expect(rejected(rsa.sign(sso_claims, alg: "PS256"))).to eq "alg_mismatch"
    expect(rejected(rsa.sign(sso_claims, kid: "nope"))).to eq "unknown_kid"
    expect(rejected(rsa.sign(sso_claims(iss: "https://evil.test/auth/v1")))).to eq "iss"
    expect(rejected(rsa.sign(sso_claims(aud: "other")))).to eq "aud"
    expect(rejected(rsa.sign(sso_claims(aud: [SsoHelpers::CLIENT_ID, "other"])))).to eq "azp"
    expect(verify(rsa.sign(sso_claims(aud: [SsoHelpers::CLIENT_ID, "other"], azp: SsoHelpers::CLIENT_ID)))["sub"]).to eq "sub-1"
    expect(rejected(rsa.sign(sso_claims(exp: Time.now.to_i - 120)))).to eq "exp"
    expect(rejected(rsa.sign(sso_claims(exp: nil)))).to eq "exp"
    expect(rejected(rsa.sign(sso_claims(nonce: "other")))).to eq "nonce"
    expect(rejected(rsa.sign(sso_claims(sub: "")))).to eq "sub"
    expect(rejected(rsa.sign(sso_claims(amr: ["pwd"])))).to eq "mfa_required"
    expect(verify(rsa.sign(sso_claims(amr: ["pwd"])), require_mfa: false)["sub"]).to eq "sub-1"
    expect(rejected("not.a.jwt")).to eq "header"
  end

  it "PKCE・戻り先・デモ用ドメインを判定する" do
    # RFC 7636 の付録 B の例
    expect(Oidc.pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).to eq "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    expect(Oidc.verify_pkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).to be true
    expect(Oidc.verify_pkce("short", Oidc.pkce_challenge("short"))).to be false
    prefixes = %w[craftflow:// exp://]
    expect(Oidc.mobile_redirect_allowed?("craftflow://auth/sso", prefixes)).to be true
    expect(Oidc.mobile_redirect_allowed?("exp://192.168.0.2:8081/--/auth/sso", prefixes)).to be true
    ["https://evil.test/", "http://x/", "evil://auth/sso", "craftflow://auth/sso#x", ""].each do |bad|
      expect(Oidc.mobile_redirect_allowed?(bad, prefixes)).to be(false), bad
    end
    expect(Oidc.link_denied?("demo@example.com", ["example.com"])).to be true
    expect(Oidc.link_denied?("no-at-mark", ["example.com"])).to be true
    expect(Oidc.link_denied?("me@family.test", ["example.com"])).to be false
  end

  it "方法のないトークンはパスワード扱い" do
    expect(JsonWebToken.login_method(JsonWebToken.decode(JsonWebToken.encode_access(user_id: 1)))).to eq "pwd"
    legacy = JWT.encode({ sub: 1, type: "access", exp: 1.hour.from_now.to_i }, ENV.fetch("JWT_SECRET") { Rails.application.secret_key_base }, "HS256")
    expect(JsonWebToken.login_method(JsonWebToken.decode(legacy))).to eq "pwd"
    expect(JsonWebToken.login_method(JsonWebToken.decode(JsonWebToken.encode_access(user_id: 1, method: "sso")))).to eq "sso"
  end
end
