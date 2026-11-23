module Api
  module V1
    module AiConcierge
      # AIコンシェルジュが提示した下書きで、オーダーメイドを依頼する (確認カードの「はい、オーダーする」)。
      # 本文は下書きの依頼書 (Markdown) をそのまま使い、LLM は呼ばない。
      # 依頼は会員に紐づくのでログインが要る。ゲストの会話は guest_token を添えると、ログイン後に本人の会話として引き継げる
      class CustomOrdersController < BaseController
        before_action :authenticate!

        ORDERED_REPLY = "ご依頼を受け付けました（依頼番号 #%<id>d）。内容を確認のうえ、店舗からご連絡します。" \
                        "進み具合は「問い合わせ・依頼」の画面で確認できます。".freeze
        ACCEPT_TEXT = "はい、この内容でオーダーします".freeze

        # body: message_id (下書きを提示した応答), guest_token (ゲストのときの会話を引き継ぐとき)
        def create
          convo = conversation_for_order
          draft_message = convo.messages.where(role: "assistant").where.not(order_draft: nil).find(params.require(:message_id))

          unless Storefront.custom_orders?
            return render_error(code: "custom_orders_paused", message: "現在、オーダーメイドの受付を休止しています", status: :unprocessable_content)
          end
          return already_ordered if draft_message.service_request
          if convo.messages.where.not(order_draft: nil).maximum(:id) != draft_message.id
            return render_error(code: "draft_outdated", message: "この内容は修正されています。最新の内容でオーダーしてください", status: :unprocessable_content)
          end

          request, reply = ServiceRequest.transaction do
            convo.update!(user: current_user) if convo.user_id.nil? # ゲストの会話を本人のものにする
            req = current_user.service_requests.create!(
              CustomOrderDraft.request_attributes(draft_message.order_draft).merge(ai_message: draft_message)
            )
            convo.messages.create!(role: "user", content: ACCEPT_TEXT)
            [req, convo.messages.create!(role: "assistant", content: format(ORDERED_REPLY, id: req.id), cta: "view_requests")]
          end

          render json: {
            conversation_id: convo.id,
            service_request: { id: request.id, kind: request.kind, status: request.status, subject: request.subject },
            message: serialize_message(reply)
          }, status: :created
        rescue ActiveRecord::RecordNotUnique
          already_ordered # 同じ下書きで同時に送られたとき
        end

        private

        # 本人の会話。guest_token があれば、ゲストのときに始めた会話 (まだ誰のものでもないもの)
        def conversation_for_order
          return find_guest_conversation(params[:conversation_id]) if params[:guest_token].present?

          current_user.ai_conversations.find(params[:conversation_id])
        end

        def already_ordered
          render_error(code: "already_ordered", message: "この内容はすでに依頼済みです", status: :unprocessable_content)
        end
      end
    end
  end
end
