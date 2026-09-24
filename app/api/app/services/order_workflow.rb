# 注文ステータスの遷移と、それに伴う副作用をまとめて扱う。
#
#   注文受付 → 入金確認 → 制作待ち → 制作中 → 検品 → 発送準備 → 発送済み → 完了
#
# - 入金確認 (paid)     : 販売在庫の引き当てを確定 (reserved → 出庫)。デジタル商品のみの注文は自動で完了へ
# - 制作中 (in_production): レシピ (product_materials) に従って材料在庫を消費 (1注文1回)
# - 発送済み (shipped)  : 配送業者・追跡番号を記録
# - キャンセル           : 入金前なら販売在庫の引き当てを解除
#
# 制作ボードでは工程を飛ばしたり戻したりできるが、入金確認前に制作・発送へは進めない。
class OrderWorkflow
  class Error < StandardError; end

  def initialize(order, actor: nil)
    @order = order
    @actor = actor
  end

  def transition!(to, note: "", carrier: nil, tracking_number: nil)
    raise Error, "不正なステータスです: #{to}" unless Order::STATUSES.include?(to)
    return @order if @order.status == to

    Order.transaction do
      @order.lock!
      validate!(to)
      from = @order.status

      confirm_payment! if to != "cancelled" && @order.paid_at.nil?
      consume_materials! if to == "in_production"
      update_shipment!(to, carrier: carrier, tracking_number: tracking_number)
      release_inventory! if to == "cancelled"

      @order.update!(status: to)
      @order.events.create!(from_status: from, status: to, actor: @actor, note: note.to_s)
    end

    # デジタル商品だけの注文は制作・発送がないので入金確認と同時に完了
    if to == "paid" && !@order.physical?
      self.class.new(@order).transition!("completed", note: "デジタル商品のみのため自動完了")
    end
    @order
  end

  # 製作担当・納期の変更。担当の変更は履歴に残す
  def plan!(attrs)
    attrs = attrs.to_h.symbolize_keys.slice(:assignee_id, :due_on)
    return @order if attrs.empty?

    @order.update!(attrs)
    if @order.saved_change_to_assignee_id?
      @order.events.create!(from_status: @order.status, status: @order.status, actor: @actor,
                            note: "製作担当: #{@order.assignee&.name || '未割り当て'}")
    end
    @order
  end

  private

  def validate!(to)
    from = @order.status
    raise Error, "キャンセル済みの注文は変更できません" if from == "cancelled"
    raise Error, "注文受付には戻せません" if to == "received"
    if @order.paid_at.nil? && !%w[paid cancelled].include?(to)
      raise Error, "入金確認前です。先に「入金確認」へ移動してください"
    end
  end

  def physical_items
    @order.items.includes(product: :inventory).select { |i| i.product.physical? }
  end

  def confirm_payment!
    physical_items.each { |i| i.product.inventory.consume!(i.quantity) }
    @order.update!(paid_at: Time.current)
  rescue ApplicationController::NotFoundError => e # Inventory は在庫不足をこの例外で通知する
    raise Error, e.message
  end

  def consume_materials!
    return if @order.materials_consumed_at

    physical_items.each do |item|
      item.product.product_materials.includes(:material).each do |pm|
        pm.material.adjust!(-(pm.quantity * item.quantity))
      end
    end
    @order.update!(materials_consumed_at: Time.current)
  end

  def update_shipment!(to, carrier:, tracking_number:)
    shipment = @order.shipment
    return unless shipment

    case to
    when "shipped"
      shipment.update!(status: "shipped", shipped_at: shipment.shipped_at || Time.current,
                       carrier: carrier.presence || shipment.carrier,
                       tracking_number: tracking_number.presence || shipment.tracking_number)
    when "completed"
      shipment.update!(status: "delivered", delivered_at: Time.current) if shipment.status == "shipped"
    end
  end

  # 入金前のキャンセルは販売在庫の仮押さえを戻す (入金後の返品・返金は店舗で個別対応)
  def release_inventory!
    return if @order.paid_at

    physical_items.each { |i| i.product.inventory.release!(i.quantity) }
  end
end
