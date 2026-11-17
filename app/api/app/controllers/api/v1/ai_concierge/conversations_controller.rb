module Api
  module V1
    module AiConcierge
      class ConversationsController < BaseController
        def create
          convo = AiConversation.create!(user: current_user, started_at: Time.current)
          render json: serialize(convo).merge(guest_token: guest_token_for(convo)), status: :created
        end

        # 会話履歴 (画面を開き直したときの復元に使う)
        def show
          convo = find_conversation(params[:id])
          render json: serialize(convo).merge(
            messages: convo.messages.where(role: %w[user assistant]).order(:id).map { |m| serialize_message(m) }
          )
        end

        private

        def serialize(c)
          { id: c.id, started_at: c.started_at }
        end
      end
    end
  end
end
