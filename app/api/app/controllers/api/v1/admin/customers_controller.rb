module Api
  module V1
    module Admin
      # 顧客管理: 会員一覧 (購入実績つき)・顧客詳細 (購入履歴・問い合わせ)・顧客メモ
      class CustomersController < BaseController
        requires_permission :orders
        # 購入実績 (入金確認以降の注文) と未対応の問い合わせ数。ステータスはコード内の定数のみ
        PAID_IN = Order::PAID_STATUSES.map { |s| "'#{s}'" }.join(", ")
        STATS_SELECT = <<~SQL.squish.freeze
          users.*,
          (SELECT COUNT(*) FROM orders o WHERE o.user_id = users.id AND o.status IN (#{PAID_IN})) AS orders_count,
          (SELECT COALESCE(SUM(o.total_cents), 0) FROM orders o WHERE o.user_id = users.id AND o.status IN (#{PAID_IN})) AS total_spent_cents,
          (SELECT MAX(o.placed_at) FROM orders o WHERE o.user_id = users.id) AS last_order_at,
          (SELECT COUNT(*) FROM service_requests s WHERE s.user_id = users.id AND s.status IN ('pending', 'quoted', 'in_progress')) AS open_requests_count
        SQL

        def index
          page, per = pagination_params
          base = User.where(role: "member")
          if params[:q].present?
            q = "%#{User.sanitize_sql_like(params[:q])}%"
            base = base.where("users.name ILIKE :q OR users.email ILIKE :q", q: q)
          end
          scope = base.select(STATS_SELECT)
          scope = case params[:sort]
                  when "spent"  then scope.order("total_spent_cents DESC, users.id DESC")
                  when "orders" then scope.order("orders_count DESC, users.id DESC")
                  else scope.order(Arel.sql("last_order_at DESC NULLS LAST, users.id DESC"))
                  end

          set_pagination_headers(base, page: page, per: per)
          render json: scope.offset((page - 1) * per).limit(per).map { |u| summary(u) }
        end

        def show
          user = User.where(role: "member").select(STATS_SELECT).find(params[:id])
          orders = user.orders.recent.includes(items: :product)
          render json: summary(user).merge(
            admin_note: user.admin_note,
            addresses: user.addresses.map { |a| a.attributes.slice("id", "recipient", "postal_code", "prefecture", "city", "line1", "line2", "phone", "is_default") },
            # 購入履歴
            orders: orders.map { |o|
              { id: o.id, status: o.status, status_label: o.status_label, total_cents: o.total_cents, placed_at: o.placed_at,
                items: o.items.map { |i| { name: i.product.name, quantity: i.quantity } } }
            },
            # よく買う商品
            top_products: OrderItem.joins(:order, :product).merge(user.orders.paid)
                                   .group("products.id", "products.name")
                                   .order(Arel.sql("SUM(order_items.quantity) DESC")).limit(5)
                                   .pluck("products.id", "products.name", Arel.sql("SUM(order_items.quantity)"))
                                   .map { |id, name, qty| { product_id: id, name: name, quantity: qty.to_i } },
            requests: user.service_requests.recent.map { |r|
              { id: r.id, kind: r.kind, status: r.status, subject: r.subject, created_at: r.created_at }
            }
          )
        end

        # 店舗側の顧客メモ
        def update
          user = User.where(role: "member").find(params[:id])
          user.update!(admin_note: params[:admin_note].to_s)
          head :no_content
        end

        private

        def summary(u)
          {
            id: u.id, name: u.name, email: u.email, created_at: u.created_at,
            orders_count: u.orders_count.to_i, total_spent_cents: u.total_spent_cents.to_i,
            last_order_at: u.last_order_at, open_requests_count: u.open_requests_count.to_i
          }
        end
      end
    end
  end
end
