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

        render json: tokens_for(user).merge(user: user_json(user))
      end

      def refresh
        token = params.require(:refresh_token)
        payload = JsonWebToken.decode(token)
        raise AuthError, "リフレッシュトークンが無効です" unless payload && payload[:type] == "refresh"

        user = User.find(payload[:sub])
        render json: tokens_for(user)
      end

      private

      def tokens_for(user)
        {
          access_token:  JsonWebToken.encode_access(user_id: user.id),
          refresh_token: JsonWebToken.encode_refresh(user_id: user.id),
          token_type: "Bearer",
          expires_in: JsonWebToken::ACCESS_EXP.to_i
        }
      end

      def user_json(user)
        { id: user.id, email: user.email, name: user.name, role: user.role }
      end
    end
  end
end
