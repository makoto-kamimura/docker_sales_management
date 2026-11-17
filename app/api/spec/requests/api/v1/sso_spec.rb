require "rails_helper"

RSpec.describe "SSO", type: :request do
  let(:signer) { SsoHelpers::Signer.new("RS256", "rsa-1") }
  let(:idp) { SsoHelpers::FakeIdp.new(signer) }
  let!(:me) { create(:user, email: "me@family.test", password: "pw-1234") }
  let!(:other) { create(:user, email: "you@family.test", password: "pw-5678") }
  let!(:demo) { create(:user, email: "demo@example.com", password: "demo123") }

  around { |ex| with_sso_env { ex.run } }

  before do
    allow(Oidc).to receive(:http_get_json) { |url| idp.get(url) }
    allow(Oidc).to receive(:http_post_form) { |url, form| idp.post(url, form) }
  end

  def b64(s) = Base64.urlsafe_encode64(s, padding: false)
  def new_verifier = b64(SecureRandom.random_bytes(32))
  def bearer(token) = { "Authorization" => "Bearer #{token}" }
  def json = JSON.parse(response.body)

  def pwd_login(email, password)
    post "/api/v1/auth/login", params: { email: email, password: password }, as: :json
    response
  end

  def path_of(url)
    u = URI.parse(url)
    "#{u.path}?#{u.query}"
  end

  # Web の流れを通し、交換の応答 (または戻り先の error) を返す
  def run_flow(mode, token: nil, sub: "sub-1", amr: %w[pwd mfa])
    verifier = new_verifier
    params = { mode: mode, client: "web", code_challenge: Oidc.pkce_challenge(verifier) }
    if mode == "link"
      post "/api/v1/me/identities/sso/intent", headers: bearer(token)
      params[:intent] = json["intent"]
    end
    get "/api/v1/auth/sso/start", params: params
    expect(response).to have_http_status(:see_other)
    back = idp.authorize(response.location, sub: sub, amr: amr)
    get path_of(back)
    expect(response).to have_http_status(:see_other)
    expect(response.location).to start_with("https://sales.test/auth/sso/complete?")
    q = Rack::Utils.parse_query(URI.parse(response.location).query)
    return q["error"] if q["error"]

    post "/api/v1/auth/sso/exchange", params: { code: q["code"], code_verifier: verifier }, headers: token ? bearer(token) : {}, as: :json
    response
  end

  it "設定がなければ無効" do
    with_sso_env("OIDC_CLIENT_SECRET" => "") do
      get "/api/v1/auth/providers"
      expect(json).to eq("sso" => false, "sso_name" => nil)
      get "/api/v1/auth/sso/start", params: { mode: "login" }
      expect(response).to have_http_status(:not_found)
    end
  end

  it "連携 → SSO でログイン → 「SSO だけ」→ 解除" do
    expect(run_flow("login")).to eq "not_linked"

    pwd = pwd_login("me@family.test", "pw-1234").parsed_body["access_token"]
    pwd_refresh = response.parsed_body["refresh_token"]
    get "/api/v1/me/identities", headers: bearer(pwd)
    expect(json).to include("sso_enabled" => true, "can_link" => true, "identities" => [], "login_method" => "pwd")
    res = run_flow("link", token: pwd)
    expect(res).to have_http_status(:ok)
    expect(res.parsed_body).to eq("mode" => "link", "email" => "me@family.test")

    res = run_flow("login")
    expect(res).to have_http_status(:ok)
    expect(res.parsed_body).to include("mode" => "login")
    expect(res.parsed_body["user"]["email"]).to eq "me@family.test"
    sso = res.parsed_body["access_token"]
    sso_refresh = res.parsed_body["refresh_token"]
    get "/api/v1/me", headers: bearer(sso)
    expect(response).to have_http_status(:ok)

    # 「SSO だけ」はパスワードのログインではオンにできない
    put "/api/v1/me/sso-only", params: { enabled: true }, headers: bearer(pwd), as: :json
    expect(response).to have_http_status(:bad_request)
    put "/api/v1/me/sso-only", params: { enabled: true }, headers: bearer(sso), as: :json
    expect(json).to eq("sso_only" => true)
    # パスワードのトークンとリフレッシュトークンは、その時点から 401。パスワードのログインは 403 (違えば 401)
    get "/api/v1/me", headers: bearer(pwd)
    expect(response).to have_http_status(:unauthorized)
    post "/api/v1/auth/refresh", params: { refresh_token: pwd_refresh }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(pwd_login("me@family.test", "pw-1234")).to have_http_status(:forbidden)
    expect(pwd_login("me@family.test", "wrong")).to have_http_status(:unauthorized)
    # SSO のリフレッシュは SSO のまま引き継ぐ
    post "/api/v1/auth/refresh", params: { refresh_token: sso_refresh }, as: :json
    expect(response).to have_http_status(:ok)
    get "/api/v1/me/identities", headers: bearer(json["access_token"])
    expect(json).to include("login_method" => "sso", "sso_only" => true)
    # 以前のトークン (amr なし) もパスワード扱い
    legacy = JWT.encode({ sub: me.id, type: "access", exp: 1.hour.from_now.to_i }, ENV.fetch("JWT_SECRET") { Rails.application.secret_key_base }, "HS256")
    get "/api/v1/me", headers: bearer(legacy)
    expect(response).to have_http_status(:unauthorized)

    # 非常用の切り替え
    with_sso_env("OIDC_ALLOW_PASSWORD_FOR_SSO_ONLY" => "true") do
      expect(pwd_login("me@family.test", "pw-1234")).to have_http_status(:ok)
    end
    allow(Oidc).to receive(:http_get_json) { |url| idp.get(url) }

    # 解除すると「SSO だけ」も外れ、SSO では入れなくなる
    delete "/api/v1/me/identities/sso", headers: bearer(sso)
    expect(json).to eq("unlinked" => true)
    expect(pwd_login("me@family.test", "pw-1234")).to have_http_status(:ok)
    expect(run_flow("login")).to eq "not_linked"
  end

  it "結果コードは 1 回だけ、code_verifier がないと交換できない" do
    pwd = pwd_login("me@family.test", "pw-1234").parsed_body["access_token"]
    expect(run_flow("link", token: pwd)).to have_http_status(:ok)

    verifier = new_verifier
    get "/api/v1/auth/sso/start", params: { mode: "login", client: "web", code_challenge: Oidc.pkce_challenge(verifier) }
    back = idp.authorize(response.location)
    get path_of(back)
    code = Rack::Utils.parse_query(URI.parse(response.location).query)["code"]
    post "/api/v1/auth/sso/exchange", params: { code: code, code_verifier: new_verifier }, as: :json
    expect(response).to have_http_status(:unauthorized)
    post "/api/v1/auth/sso/exchange", params: { code: code, code_verifier: verifier }, as: :json
    expect(response).to have_http_status(:unauthorized)
    # state の再利用は 400
    get path_of(back)
    expect(response).to have_http_status(:bad_request)
  end

  it "連携の守り (デモ用・他人の intent・1 対 1)" do
    demo_tok = pwd_login("demo@example.com", "demo123").parsed_body["access_token"]
    get "/api/v1/me/identities", headers: bearer(demo_tok)
    expect(json["can_link"]).to be false
    post "/api/v1/me/identities/sso/intent", headers: bearer(demo_tok)
    expect(response).to have_http_status(:bad_request)

    mine = pwd_login("me@family.test", "pw-1234").parsed_body["access_token"]
    theirs = pwd_login("you@family.test", "pw-5678").parsed_body["access_token"]
    # 他人の intent で始めた連携を、自分のトークンで交換しても通らない
    verifier = new_verifier
    post "/api/v1/me/identities/sso/intent", headers: bearer(theirs)
    intent = json["intent"]
    get "/api/v1/auth/sso/start", params: { mode: "link", client: "web", code_challenge: Oidc.pkce_challenge(verifier), intent: intent }
    back = idp.authorize(response.location)
    get path_of(back)
    code = Rack::Utils.parse_query(URI.parse(response.location).query)["code"]
    post "/api/v1/auth/sso/exchange", params: { code: code, code_verifier: verifier }, headers: bearer(mine), as: :json
    expect(response).to have_http_status(:forbidden)
    # intent は 1 回だけ
    get "/api/v1/auth/sso/start", params: { mode: "link", client: "web", code_challenge: Oidc.pkce_challenge(verifier), intent: intent }
    expect(response.location).to include("error=expired")

    expect(run_flow("link", token: mine)).to have_http_status(:ok)
    expect(run_flow("link", token: theirs)).to have_http_status(:conflict)
    expect(run_flow("link", token: mine, sub: "sub-2")).to have_http_status(:conflict)
  end

  it "2 段階認証・中止・戻り先を確かめる" do
    mine = pwd_login("me@family.test", "pw-1234").parsed_body["access_token"]
    expect(run_flow("link", token: mine)).to have_http_status(:ok)
    expect(run_flow("login", amr: ["pwd"])).to eq "mfa_required"

    verifier = new_verifier
    get "/api/v1/auth/sso/start", params: { mode: "login", client: "web", code_challenge: Oidc.pkce_challenge(verifier) }
    state = Rack::Utils.parse_query(URI.parse(response.location).query)["state"]
    get "/api/v1/auth/sso/callback", params: { error: "access_denied", state: state }
    expect(response.location).to end_with("error=cancelled")

    ["https://evil.test/cb", "evil://x"].each do |bad|
      get "/api/v1/auth/sso/start", params: { mode: "login", client: "mobile", code_challenge: Oidc.pkce_challenge(verifier), redirect_uri: bad }
      expect(response).to have_http_status(:bad_request)
    end
    get "/api/v1/auth/sso/start", params: { mode: "login", client: "mobile", code_challenge: Oidc.pkce_challenge(verifier),
                                            redirect_uri: "exp://192.168.0.2:8081/--/auth/sso" }
    expect(response).to have_http_status(:see_other)
  end

  it "鍵が入れ替わった直後でも、知らない kid なら読み直す" do
    mine = pwd_login("me@family.test", "pw-1234").parsed_body["access_token"]
    expect(run_flow("link", token: mine)).to have_http_status(:ok)
    idp.signer = SsoHelpers::Signer.new("EdDSA", "ed-1")
    t0 = Time.now.to_f
    allow(Oidc).to receive(:now_f).and_return(t0 + Oidc::JWKS_FORCE_REFRESH_MIN + 1)
    expect(run_flow("login")).to have_http_status(:ok)
    expect(idp.jwks_hits).to eq 2
  end
end
