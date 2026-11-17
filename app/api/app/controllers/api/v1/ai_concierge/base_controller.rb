module Api
  module V1
    module AiConcierge
      class BaseController < Api::V1::BaseController
        GUEST_TOKEN_PURPOSE = :ai_concierge_guest
        GUEST_TOKEN_TTL = 30.days
        # 発話は 1 回ごとに LLM を呼ぶので、回数を絞る (会員ごと・ゲストは接続元ごと)
        RATE_LIMIT_STORE = ActiveSupport::Cache::MemoryStore.new

        before_action :require_enabled!
        before_action :reject_stale_login!
        rate_limit to: 30, within: 5.minutes, only: :create, store: RATE_LIMIT_STORE,
                   by: -> { current_user ? "user-#{current_user.id}" : request.remote_ip },
                   with: -> { render_error(code: "rate_limited", message: "メッセージが続いています。少し時間をおいてからお試しください。", status: :too_many_requests) }

        private

        # Claude の API キーが未設定なら無効。画面は settings を見てチャットを出さない
        def require_enabled!
          return if ClaudeConcierge.enabled?

          render_error(code: "ai_unavailable", message: "AIコンシェルジュは現在ご利用いただけません。", status: :service_unavailable)
        end

        # 期限切れのトークンをゲストとして扱うと、会員の会話が見つからなくなる。401 を返して画面に更新させる
        def reject_stale_login!
          raise AuthError, "ログインの有効期限が切れました" if request.headers["Authorization"].present? && current_user.nil?
        end

        # 会員は自分の会話だけ。ゲストの会話は、作成時に渡した guest_token を持つ人だけが使える
        def find_conversation(id)
          return current_user.ai_conversations.find(id) if current_user

          find_guest_conversation(id)
        end

        # ゲストの会話 (guest_token が合い、まだ誰のものでもない会話)
        def find_guest_conversation(id)
          convo = AiConversation.find_signed(params[:guest_token].to_s, purpose: GUEST_TOKEN_PURPOSE)
          raise ActiveRecord::RecordNotFound, "会話が見つかりません" unless convo && convo.id == id.to_i && convo.user_id.nil?

          convo
        end

        def guest_token_for(convo)
          convo.user_id ? nil : convo.signed_id(purpose: GUEST_TOKEN_PURPOSE, expires_in: GUEST_TOKEN_TTL)
        end

        def serialize_message(m)
          {
            id: m.id, role: m.role, content: m.content, cta: m.cta, created_at: m.created_at,
            # 提示したオーダーメイドの下書き。依頼にしたら service_request_id が入る
            order_draft: m.order_draft.presence && {
              title: m.order_draft["title"], markdown: m.order_draft["markdown"], service_request_id: m.service_request&.id
            }
          }
        end
      end
    end
  end
end
