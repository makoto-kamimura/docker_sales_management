module Api
  module V1
    module AiConcierge
      class MessagesController < BaseController
        # 発話 → Dify Workflow API → 応答保存 → 返却
        def create
          convo = find_conversation
          content = params.require(:content)

          AiMessage.create!(ai_conversation: convo, role: "user", content: content)

          inputs = build_inputs
          result = DifyClient.new.chat(
            query: content,
            inputs: inputs,
            user: "user-#{convo.user_id || "guest-#{convo.id}"}",
            conversation_id: convo.dify_conversation_id
          )

          convo.update!(dify_conversation_id: result[:conversation_id]) if result[:conversation_id].present?

          assistant_text, cta = extract_cta(result[:answer])
          assistant = AiMessage.create!(
            ai_conversation: convo, role: "assistant", content: assistant_text, cta: cta
          )

          render json: { id: assistant.id, role: assistant.role, content: assistant.content, cta: assistant.cta },
                 status: :created
        rescue DifyClient::Error => e
          Rails.logger.error("Dify error: #{e.message}")
          render_error(code: "ai_unavailable", message: "AIに接続できませんでした。時間をおいて再度お試しください。", status: :bad_gateway)
        end

        private

        def find_conversation
          scope = current_user ? current_user.ai_conversations : AiConversation.where(user_id: nil)
          scope.find(params[:conversation_id])
        end

        def build_inputs
          if current_user
            cart_items = current_user.cart&.items&.includes(:product)&.map { |i|
              { sku: i.product.sku, name: i.product.name, qty: i.quantity }
            } || []
            recent = current_user.orders.recent.limit(3).map { |o|
              { id: o.id, status: o.status, total: o.total_cents, placed_at: o.placed_at }
            }
            {
              member_name: current_user.name,
              cart_items: cart_items.to_json,
              recent_orders: recent.to_json
            }
          else
            { member_name: "ゲスト", cart_items: "[]", recent_orders: "[]" }
          end
        end

        # 末尾の "[CTA: action]" を抽出
        def extract_cta(text)
          if (m = text.match(/\[CTA:\s*([^\]]+)\]\s*\z/))
            [text.sub(m[0], "").strip, m[1].strip]
          else
            [text, nil]
          end
        end
      end
    end
  end
end
