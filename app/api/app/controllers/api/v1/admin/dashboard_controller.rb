module Api
  module V1
    module Admin
      class DashboardController < BaseController
        def sales
          from = (params[:from].presence || 30.days.ago.to_date.to_s)
          to   = (params[:to].presence   || Date.current.to_s)
          range = Date.parse(from)..Date.parse(to)

          orders = Order.where(status: %w[paid shipped delivered]).where(placed_at: range)
          by_day = orders.group("DATE(placed_at)").sum(:total_cents)

          render json: {
            from: from, to: to,
            total_orders: orders.count,
            total_revenue_cents: orders.sum(:total_cents),
            by_day: by_day.map { |d, v| { date: d.to_s, revenue_cents: v } }.sort_by { |x| x[:date] }
          }
        end
      end
    end
  end
end
