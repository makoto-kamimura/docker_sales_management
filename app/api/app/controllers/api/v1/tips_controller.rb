module Api
  module V1
    # 投げ銭 (購入者): 0円の商品を含む自分の注文に、任意の金額で応援を申し込む。入金は店舗が確認する
    class TipsController < BaseController
      before_action :authenticate!
      before_action :set_order

      # body: amount_cents (100〜100,000), message
      def create
        tip = @order.tips.create!(user: current_user, amount_cents: params.require(:amount_cents), message: params[:message].to_s)
        render json: tip.api_attributes, status: :created
      end

      # 入金待ちの投げ銭だけ取り消せる
      def destroy
        tip = @order.tips.find(params[:id])
        unless tip.status == "pending"
          return render_error(code: "not_pending", message: "入金待ちの投げ銭だけ取り消せます", status: :unprocessable_entity)
        end

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
