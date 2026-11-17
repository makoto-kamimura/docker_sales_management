module Api
  module V1
    class AuthController < BaseController
      def register
        user = User.create!(
          email: params.require(:email),
          password: params.require(:password),
          name: params.require(:name)
        )
        render json: tokens_for(user).merge(user: user_json(user)), status: :created
      end

      def login
        user = User.find_by("LOWER(email) = ?", params.require(:email).to_s.downcase)
        raise AuthError, "メールアドレスまたはパスワードが正しくありません" unless user&.authenticate(params.require(:password))
        # 「SSO だけ」の人は、パスワードが合っていても断る (パスワードが違えば上の 401 のまま。設定は漏らさない)
        unless Oidc.login_method_allowed?(user, JsonWebToken::LOGIN_PASSWORD)
          raise ForbiddenError, "このアカウントは #{Oidc.display_name} でのログインだけが許可されています"
        end

        render json: tokens_for(user).merge(user: user_json(user))
      end

      def refresh
        token = params.require(:refresh_token)
        payload = JsonWebToken.decode(token)
        raise AuthError, "リフレッシュトークンが無効です" unless payload && payload[:type] == "refresh"

        user = User.find_by(id: payload[:sub])
        method = JsonWebToken.login_method(payload)
        # 「SSO だけ」にしたあとは、パスワードで入ったリフレッシュトークンも使えない
        raise AuthError, "リフレッシュトークンが無効です" unless user && Oidc.login_method_allowed?(user, method)

        render json: tokens_for(user, method)
      end

      private

      def tokens_for(user, method = JsonWebToken::LOGIN_PASSWORD)
        {
          access_token:  JsonWebToken.encode_access(user_id: user.id, method: method),
          refresh_token: JsonWebToken.encode_refresh(user_id: user.id, method: method),
          token_type: "Bearer",
          expires_in: JsonWebToken::ACCESS_EXP.to_i
        }
      end

      def user_json(user)
        { id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.effective_permissions }
      end
    end
  end
end
