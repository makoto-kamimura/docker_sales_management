module Api
  module V1
    # 特定商取引法に基づく表記 (ログイン不要)。販売者の情報と店舗の方針は ShopSetting、
    # 料金・支払方法・定期便のプランなどは実際の計算に使う定数と DB から返す (文面と動きが食い違わないように)
    class LegalNoticesController < BaseController
      def show
        s = ShopSetting.current
        render json: {
          complete: s.complete?,
          seller: {
            name: s.seller_name, representative: s.representative_name, email: s.email, contact_hours: s.contact_hours,
            disclose_on_request: s.disclose_on_request,
            # 請求時開示のときは、住所・電話番号を API からも出さない
            address: s.disclose_on_request ? nil : s.address,
            phone: s.disclose_on_request ? nil : s.phone
          },
          transfer_payment_due: s.transfer_payment_due,
          shipping_lead_time: s.shipping_lead_time,
          returns_policy: s.returns_policy,
          extra_notes: s.extra_notes,
          pricing: {
            tax_rate_percent: (Pricing::TAX_RATE * 100).round,
            shipping_flat_cents: Pricing::SHIPPING_FLAT_CENTS,
            free_shipping_threshold_cents: Pricing::FREE_SHIPPING_THRESHOLD_CENTS
          },
          card_enabled: StripeService.enabled?,
          card_min_amount_cents: StripeService::MIN_AMOUNT_CENTS,
          subscription_plans: SubscriptionPlan.active.order(:interval_days).map { |p|
            { name: p.name, interval_days: p.interval_days, discount_percent: p.discount_percent }
          },
          tip_range_cents: { min: Tip::MIN_AMOUNT_CENTS, max: Tip::MAX_AMOUNT_CENTS },
          updated_at: s.updated_at
        }
      end
    end
  end
end
