module Api
  module V1
    module Admin
      # 売上・分析ダッシュボード。売上は入金確認以降 (キャンセル除く) の注文を対象にする。
      class DashboardController < BaseController
        requires_permission :sales
        ZONE = "Asia/Tokyo" # 日別集計は日本時間で区切る (DB の時刻は UTC)

        def sales
          zone = Time.find_zone(ZONE)
          from = parse_date(params[:from]) || 29.days.ago.in_time_zone(zone).to_date
          to   = parse_date(params[:to])   || Time.current.in_time_zone(zone).to_date
          range = zone.local(from.year, from.month, from.day)..zone.local(to.year, to.month, to.day).end_of_day

          orders = Order.paid.where(placed_at: range)
          items  = OrderItem.joins(:order, product: :category).merge(orders)
          revenue = orders.sum(:total_cents)
          count   = orders.count

          render json: {
            from: from.to_s, to: to.to_s,
            total_orders: count,
            total_revenue_cents: revenue,
            average_order_cents: count.zero? ? 0 : (revenue / count.to_f).round,
            by_day: by_day(orders, from, to),
            by_category: by_category(items),
            top_products: top_products(items),
            customers: customers(orders, range),
            production: production(range)
          }
        end

        private

        def parse_date(s)
          Date.parse(s.to_s) if s.present?
        rescue Date::Error
          nil
        end

        def local_date_sql
          "DATE(orders.placed_at AT TIME ZONE 'UTC' AT TIME ZONE '#{ZONE}')"
        end

        # 期間内の全日を 0 埋めして返す (グラフが途切れないように)
        def by_day(orders, from, to)
          revenue = orders.group(Arel.sql(local_date_sql)).sum(:total_cents)
          counts  = orders.group(Arel.sql(local_date_sql)).count
          (from..to).map { |d| { date: d.to_s, revenue_cents: revenue[d] || 0, orders: counts[d] || 0 } }
        end

        # 商品売上 (税・送料を除く明細合計)
        def by_category(items)
          items.group("categories.slug", "categories.name")
               .pluck("categories.slug", "categories.name", Arel.sql("SUM(order_items.line_total_cents)"),
                      Arel.sql("SUM(order_items.quantity)"))
               .map { |slug, name, cents, qty| { slug: slug, name: name, revenue_cents: cents.to_i, quantity: qty.to_i } }
               .sort_by { |c| -c[:revenue_cents] }
        end

        def top_products(items)
          items.group("products.id", "products.name")
               .order(Arel.sql("SUM(order_items.line_total_cents) DESC")).limit(5)
               .pluck("products.id", "products.name", Arel.sql("SUM(order_items.line_total_cents)"),
                      Arel.sql("SUM(order_items.quantity)"))
               .map { |id, name, cents, qty| { product_id: id, name: name, revenue_cents: cents.to_i, quantity: qty.to_i } }
        end

        # 購入者数・リピート率 (期間内の購入者のうち、累計2回以上購入している割合)・新規会員数
        def customers(orders, range)
          buyer_ids = orders.distinct.pluck(:user_id)
          repeaters = Order.paid.where(user_id: buyer_ids).group(:user_id).having("COUNT(*) >= 2").count.size
          {
            buyers: buyer_ids.size,
            repeat_buyers: repeaters,
            repeat_rate: buyer_ids.empty? ? 0 : (repeaters.to_f / buyer_ids.size).round(3),
            new_members: User.where(role: "member", created_at: range).count
          }
        end

        # 制作の見える化: 現在の工程別件数・納期遅れ・入金→発送のリードタイム・工程ごとの平均滞留時間
        def production(range)
          wip = Order.where(status: Order::OPEN_STATUSES).group(:status).count
          lead_times = OrderEvent.joins(:order)
                                 .where(status: "shipped", created_at: range)
                                 .where.not(orders: { paid_at: nil })
                                 .pluck(Arel.sql("EXTRACT(EPOCH FROM (order_events.created_at - orders.paid_at))"))
                                 .map(&:to_f)
          {
            wip: Order::OPEN_STATUSES.map { |s| { status: s, label: Order::STATUS_LABELS[s], count: wip[s] || 0 } },
            overdue: Order.where(status: Order::OPEN_STATUSES).where("due_on < ?", Date.current).count,
            avg_lead_time_days: lead_times.empty? ? nil : (lead_times.sum / lead_times.size / 1.day).round(1),
            stage_hours: stage_hours(range)
          }
        end

        # 期間内に完了した工程について、その工程に何時間とどまったかの平均 (ボトルネックの把握)
        def stage_hours(range)
          events = OrderEvent.where("from_status IS NULL OR from_status <> status")
                             .where(order_id: OrderEvent.where(created_at: range).select(:order_id))
                             .order(:order_id, :created_at, :id)
                             .pluck(:order_id, :status, :created_at)
          durations = Hash.new { |h, k| h[k] = [] }
          events.group_by(&:first).each_value do |evs|
            evs.each_cons(2) do |(_, status, entered), (_, _, left)|
              durations[status] << (left - entered) if range.cover?(left)
            end
          end
          (Order::STATUSES - %w[completed cancelled]).map do |s|
            d = durations[s]
            { status: s, label: Order::STATUS_LABELS[s], avg_hours: d.empty? ? nil : (d.sum / d.size / 1.hour).round(1), samples: d.size }
          end
        end
      end
    end
  end
end
