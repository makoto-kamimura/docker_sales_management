module Api
  module V1
    module AiConcierge
      class ConversationsController < BaseController
        def create
          convo = AiConversation.create!(user: current_user, started_at: Time.current)
          render json: serialize(convo), status: :created
        end

        def show
          convo = scope.find(params[:id])
          render json: serialize(convo).merge(
            messages: convo.messages.order(:id).map { |m|
              { id: m.id, role: m.role, content: m.content, cta: m.cta, created_at: m.created_at }
            }
          )
        end

        private

        def scope
          current_user ? current_user.ai_conversations : AiConversation.where(user_id: nil)
        end

        def serialize(c)
          { id: c.id, dify_conversation_id: c.dify_conversation_id, started_at: c.started_at }
        end
      end
    end
  end
end
