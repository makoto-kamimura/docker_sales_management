module Api
  module V1
    module AiConcierge
      class MessagesController < BaseController
        # 発話 → Claude → 応答を保存して返す
        def create
          convo = find_conversation(params[:conversation_id])
          content = params.require(:content).to_s.strip
          if content.length > ConciergeChat::MAX_CONTENT_LENGTH
            return render_error(code: "unprocessable", message: "メッセージは#{ConciergeChat::MAX_CONTENT_LENGTH}文字以内で入力してください。",
                                status: :unprocessable_content)
          end

          message = ConciergeChat.new(convo, user: current_user).reply(content)
          render json: serialize_message(message), status: :created
        rescue ClaudeConcierge::Error => e
          Rails.logger.error("Concierge error: #{e.message}")
          render_error(code: "ai_unavailable", message: "AIに接続できませんでした。時間をおいて再度お試しください。", status: :bad_gateway)
        end
      end
    end
  end
end
