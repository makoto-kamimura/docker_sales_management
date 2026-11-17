module Api
  module V1
    # SSO (OpenID Connect) でのログイン。Web とモバイルで同じ流れを使う。
    #
    # 1. (連携のときだけ) POST /me/identities/sso/intent … ログイン中の利用者に、使い捨ての intent を発行
    # 2. GET  /auth/sso/start    … クライアントが作った code_challenge を受け取り、認証サーバーへ送る
    # 3. GET  /auth/sso/callback … 認証サーバーから戻る。使い捨ての結果コードを付けてクライアントへ戻す
    # 4. POST /auth/sso/exchange … 結果コードと code_verifier を引き換える。ここでログイン / 連携が成立する
    #
    # 新しい利用者は作らない (公開の会員登録はあるが、SSO からは作らない)。SSO で入れるのは、パスワードでログインしたうえで連携した人だけ。
    class SsoController < BaseController
      FLOW_TTL = 600   # 開始から認証サーバーでの操作を終えるまでの猶予 (秒)
      RESULT_TTL = 60  # 結果コードの有効期間 (秒)

      before_action :ensure_enabled!, except: %i[providers callback identities unlink]
      before_action :authenticate!, only: %i[identities intent unlink sso_only]

      CALLBACK_ERROR_HTML = '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width">' \
                            "<p>ログインの有効期限が切れたか、正しくない要求です。アプリに戻って、もう一度やり直してください。</p>".freeze

      # ログイン画面が「SSO でログイン」を出すかどうかと、その名前
      def providers
        on = Oidc.enabled?
        render json: { sso: on, sso_name: on ? Oidc.display_name : nil }
      end

      def start
        challenge = params[:code_challenge].to_s
        return bad_request_msg("code_challenge が正しくありません") unless Oidc.valid_challenge?(challenge)

        case params[:client].to_s
        when "web"
          return_to = Oidc.web_return_url
        when "mobile"
          return_to = params[:redirect_uri].to_s
          return bad_request_msg("redirect_uri が許可されていません") unless Oidc.mobile_redirect_allowed?(return_to, Oidc.mobile_redirect_prefixes)
        else
          return bad_request_msg("client が正しくありません")
        end
        mode = params[:mode].to_s
        return bad_request_msg("mode が正しくありません") unless %w[login link].include?(mode)

        OauthFlow.where("expires_at < ?", Time.current).delete_all
        state = Oidc.random_token
        nonce = Oidc.random_token
        server_verifier = Oidc.random_token
        fields = {
          state_hash: Oidc.hash_token(state), nonce: nonce, server_verifier: server_verifier,
          client_challenge: challenge, return_to: return_to, expires_at: FLOW_TTL.seconds.from_now
        }
        if mode == "login"
          OauthFlow.create!(fields.merge(mode: "login", created_at: Time.current))
        else
          # intent は 1 回だけ使える。使ったら消して state に進める
          updated = OauthFlow.where(intent_hash: Oidc.hash_token(params[:intent].to_s), mode: "link")
                             .where("expires_at > ?", Time.current)
                             .update_all(fields.merge(intent_hash: nil))
          return redirect_to(Oidc.with_query(return_to, "error", "expired"), status: :see_other, allow_other_host: true) if updated.zero?
        end

        begin
          url = Oidc.authorization_url(state: state, nonce: nonce, server_challenge: Oidc.pkce_challenge(server_verifier))
        rescue StandardError => e
          Rails.logger.error("sso: cannot reach the identity provider: #{e.message}")
          return render_error(code: "bad_gateway", message: "認証サーバーに接続できません", status: :bad_gateway)
        end
        redirect_to url, status: :see_other, allow_other_host: true
      end

      def callback
        redirect_to handle_callback, status: :see_other, allow_other_host: true
      rescue StandardError => e
        Rails.logger.warn("sso callback rejected: #{e.message}")
        render plain: CALLBACK_ERROR_HTML, status: :bad_request, content_type: "text/html"
      end

      # 結果コードを、開始したクライアントの code_verifier と引き換える
      def exchange
        code = params[:code].to_s.strip
        verifier = params[:code_verifier].to_s
        # 結果コードは 1 回だけ使える。code_verifier が違っても消す (総当たりさせない)
        flow = OauthFlow.transaction do
          f = OauthFlow.lock.where("expires_at > ?", Time.current).find_by(result_hash: Oidc.hash_token(code))
          f&.destroy!
          f
        end
        if flow.nil? || flow.result_subject.blank? || !Oidc.verify_pkce(verifier, flow.client_challenge.to_s)
          Rails.logger.warn("sso exchange: code_verifier mismatch") if flow
          raise AuthError, "認証情報が無効です"
        end

        if flow.mode == "login"
          identity = UserIdentity.find_by(provider: Oidc::PROVIDER, subject: flow.result_subject)
          user = identity&.user
          raise AuthError, "認証情報が無効です" unless user

          identity.update_columns(last_login_at: Time.current)
          Rails.logger.info("sso login succeeded user_id=#{user.id}")
          m = JsonWebToken::LOGIN_SSO
          return render json: {
            mode: "login",
            access_token: JsonWebToken.encode_access(user_id: user.id, method: m),
            refresh_token: JsonWebToken.encode_refresh(user_id: user.id, method: m),
            token_type: "Bearer",
            expires_in: JsonWebToken::ACCESS_EXP.to_i,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.effective_permissions }
          }
        end

        # 連携: ログイン中の本人と、連携を始めた本人が同じであること (current_user が「SSO だけ」も確かめる)
        me = current_user
        raise AuthError, "認証情報が無効です" unless me
        if flow.user_id != me.id
          Rails.logger.warn("sso link: user mismatch user_id=#{me.id}")
          raise ForbiddenError, "この操作の権限がありません"
        end
        return bad_request_msg("デモ用のアカウントには SSO を連携できません") if Oidc.link_denied?(me.email, Oidc.link_deny_domains)

        owner = UserIdentity.find_by(provider: Oidc::PROVIDER, subject: flow.result_subject)
        return conflict("この SSO のアカウントは、ほかの利用者に連携されています") if owner && owner.user_id != me.id

        if owner
          owner.update!(email: flow.result_email)
        else
          if UserIdentity.exists?(user_id: me.id, provider: Oidc::PROVIDER)
            return conflict("別の SSO のアカウントと連携済みです。解除してから連携してください")
          end

          UserIdentity.create!(user: me, provider: Oidc::PROVIDER, subject: flow.result_subject, email: flow.result_email)
        end
        Rails.logger.info("sso account linked user_id=#{me.id}")
        render json: { mode: "link", email: flow.result_email }
      rescue ActiveRecord::RecordNotUnique
        conflict("この SSO のアカウントは、ほかの利用者に連携されています")
      end

      # 連携を始める。ブラウザの遷移では Bearer を送れないので、ここで使い捨ての intent を渡す
      def intent
        return bad_request_msg("デモ用のアカウントには SSO を連携できません") if Oidc.link_denied?(current_user.email, Oidc.link_deny_domains)

        token = Oidc.random_token
        OauthFlow.create!(mode: "link", user: current_user, intent_hash: Oidc.hash_token(token),
                          expires_at: FLOW_TTL.seconds.from_now, created_at: Time.current)
        render json: { intent: token }
      end

      # 自分の連携の一覧と、SSO が使えるか
      def identities
        on = Oidc.enabled?
        rows = current_user.user_identities.order(:provider)
        render json: {
          sso_enabled: on,
          sso_name: on ? Oidc.display_name : nil,
          can_link: on && !Oidc.link_denied?(current_user.email, Oidc.link_deny_domains),
          identities: rows.map { |r| { provider: r.provider, email: r.email, created_at: r.created_at, last_login_at: r.last_login_at } },
          sso_only: current_user.sso_only?,
          login_method: login_method
        }
      end

      # SSO の連携を解除する。「SSO だけ」も外す (連携がなければ SSO では入れないため)
      def unlink
        removed = User.transaction do
          n = current_user.user_identities.where(provider: Oidc::PROVIDER).delete_all
          current_user.update_columns(sso_only: false)
          n
        end
        Rails.logger.info("sso account unlinked user_id=#{current_user.id}") if removed.positive?
        render json: { unlinked: removed.positive? }
      end

      # 「SSO だけでログインする」を切り替える。オンにできるのは、連携していて、いま SSO でログインしている人だけ。
      # オンにすると、パスワードで入っていたほかの端末のログインもその時点で切れる (authenticate_user が確かめる)
      def sso_only
        enabled = ActiveModel::Type::Boolean.new.cast(params[:enabled]) == true
        if enabled
          return bad_request_msg("先に SSO のアカウントを連携してください") unless current_user.user_identities.exists?(provider: Oidc::PROVIDER)
          unless login_method == JsonWebToken::LOGIN_SSO
            return bad_request_msg("SSO でログインし直してから有効にしてください (SSO で入れることを確かめるため)")
          end
        end
        current_user.update_columns(sso_only: enabled)
        Rails.logger.info("sso-only changed user_id=#{current_user.id} enabled=#{enabled}")
        render json: { sso_only: enabled }
      end

      private

      def ensure_enabled!
        raise NotFoundError, "Not Found" unless Oidc.enabled?
      end

      def bad_request_msg(message)
        render_error(code: "bad_request", message: message, status: :bad_request)
      end

      def conflict(message)
        render_error(code: "conflict", message: message, status: :conflict)
      end

      def handle_callback
        raise "sso is disabled" unless Oidc.enabled?

        # state は 1 回だけ使える
        flow = OauthFlow.transaction do
          f = OauthFlow.lock.where("expires_at > ?", Time.current).find_by(state_hash: Oidc.hash_token(params[:state].to_s))
          f&.update_columns(state_hash: nil)
          f
        end
        raise "unknown or expired state" if flow.nil? || flow.return_to.blank?

        result = finish(flow)
        if result.is_a?(String)
          flow.destroy!
          return Oidc.with_query(flow.return_to, "error", result)
        end
        subject, email = result
        code = Oidc.random_token
        flow.update_columns(result_hash: Oidc.hash_token(code), result_subject: subject, result_email: email,
                            nonce: nil, server_verifier: nil, expires_at: RESULT_TTL.seconds.from_now)
        Oidc.with_query(flow.return_to, "code", code)
      end

      # 認証サーバーから受け取ったものを確かめ、[sub, email] を返す。失敗したときはクライアントに返す理由
      def finish(flow)
        return "cancelled" if params.key?(:error)
        return "failed" if params[:code].blank? || flow.nonce.blank? || flow.server_verifier.blank?

        id_token =
          begin
            Oidc.exchange_code(params[:code].to_s, flow.server_verifier)
          rescue StandardError => e
            Rails.logger.warn("sso token exchange failed: #{e.message}")
            return "failed"
          end
        claims =
          begin
            Oidc.verify(id_token, flow.nonce)
          rescue Oidc::Rejected => e
            if e.reason == "mfa_required"
              Rails.logger.info("sso: login without MFA was rejected")
              return "mfa_required"
            end
            Rails.logger.warn("sso id_token rejected: #{e.reason}")
            return "failed"
          rescue StandardError => e
            Rails.logger.warn("sso id_token could not be verified: #{e.message}")
            return "failed"
          end
        if flow.mode == "login" && !UserIdentity.exists?(provider: Oidc::PROVIDER, subject: claims["sub"])
          Rails.logger.info("sso login: account is not linked")
          return "not_linked"
        end
        [claims["sub"], claims["email"].is_a?(String) ? claims["email"] : nil]
      end
    end
  end
end
