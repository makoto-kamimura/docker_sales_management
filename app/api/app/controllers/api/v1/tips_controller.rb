module Api
  module V1
    # 投げ銭 (購入者): 0円の商品を含む自分の注文に、任意の金額で応援を申し込む。
    # カードは続けて checkout_session で決済の画面を開く (Webhook で入金済みになる)。振込などは店舗が入金を確認する
    class TipsController < BaseController
      before_action :authenticate!
      before_action :set_order

      # body: amount_cents (100〜100,000), message, payment_kind (card / transfer。既定は transfer)
      def create
        payment_kind = params[:payment_kind] == "card" ? "card" : "transfer"
        StripeService.ensure_enabled! if payment_kind == "card"

        tip = @order.tips.create!(user: current_user, amount_cents: params.require(:amount_cents), message: params[:message].to_s,
                                  payment_kind: payment_kind)
        render json: tip.api_attributes, status: :created
      end

      def checkout_session
        tip = @order.tips.find(params[:id])
        stripe = StripeService.new
        unless tip.card_payable?
          return render_error(code: "not_card_payable", message: "この投げ銭はカードで支払えません", status: :unprocessable_entity)
        end

        stripe.expire_checkout_session(tip.stripe_checkout_session_id)
        session = stripe.create_payment_checkout(
          user: current_user, line_items: [{ name: "投げ銭 (ご注文 ##{@order.id})", amount: tip.amount_cents }],
          metadata: { kind: "tip", tip_id: tip.id.to_s, order_id: @order.id.to_s }, **checkout_return_urls("/orders/#{@order.id}")
        )
        tip.update!(stripe_checkout_session_id: session.id)
        render json: { url: session.url }
      end

      # 入金待ちの投げ銭だけ取り消せる
      def destroy
        tip = @order.tips.find(params[:id])
        unless tip.status == "pending"
          return render_error(code: "not_pending", message: "入金待ちの投げ銭だけ取り消せます", status: :unprocessable_entity)
        end

        # 開いたままのカードの決済の画面を閉じる
        StripeService.new.expire_checkout_session(tip.stripe_checkout_session_id) if tip.stripe_checkout_session_id && StripeService.enabled?
        tip.update!(status: "cancelled")
        head :no_content
      end

      private

      def set_order
        @order = current_user.orders.find(params[:order_id])
      end
    end
  end
end
