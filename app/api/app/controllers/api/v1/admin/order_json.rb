module Api
  module V1
    module Admin
      # 注文管理・制作ボードで共通の注文 JSON
      module OrderJson
        private

        # 制作ボードのカード / 注文一覧の1行
        def order_card(o)
          {
            id: o.id, status: o.status, status_label: o.status_label,
            total_cents: o.total_cents, placed_at: o.placed_at, paid_at: o.paid_at,
            due_on: o.due_on, overdue: o.overdue?,
            digital_only: !o.physical?,
            user: { id: o.user_id, name: o.user.name, email: o.user.email },
            assignee: o.assignee && { id: o.assignee.id, name: o.assignee.name },
            items: o.items.map { |i|
              { product_id: i.product_id, name: i.product.name, quantity: i.quantity, is_digital: i.product.is_digital }
            }
          }
        end

        def order_detail(o)
          order_card(o).merge(
            subtotal_cents: o.subtotal_cents, tax_cents: o.tax_cents, shipping_cents: o.shipping_cents,
            materials_consumed_at: o.materials_consumed_at,
            address: o.address&.attributes&.slice("recipient", "postal_code", "prefecture", "city", "line1", "line2", "phone"),
            shipment: o.shipment&.attributes&.slice("status", "carrier", "tracking_number", "shipped_at", "delivered_at"),
            items: o.items.map { |i|
              { product_id: i.product_id, sku: i.product.sku, name: i.product.name, quantity: i.quantity,
                unit_price_cents: i.unit_price_cents, line_total_cents: i.line_total_cents, is_digital: i.product.is_digital }
            },
            events: o.events.map { |e|
              { status: e.status, status_label: Order::STATUS_LABELS[e.status], from_status: e.from_status,
                note: e.note, created_at: e.created_at, actor: e.actor && { id: e.actor.id, name: e.actor.name } }
            },
            accepts_tips: o.accepts_tips?,
            tips: o.tips.includes(:user, :confirmed_by).recent.map { |t| tip_json(t) }
          )
        end

        # 投げ銭 (注文詳細・投げ銭一覧で共通)
        def tip_json(t)
          t.api_attributes.merge(
            user: { id: t.user.id, name: t.user.name, email: t.user.email },
            confirmed_by: t.confirmed_by && { id: t.confirmed_by.id, name: t.confirmed_by.name }
          )
        end

        ORDER_PRELOAD = [:user, :assignee, { items: { product: :inventory } }].freeze
      end
    end
  end
end
