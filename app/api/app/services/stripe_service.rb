require "stripe"

class StripeService
  class Error < StandardError; end

  def initialize
    Stripe.api_key = ENV.fetch("STRIPE_SECRET_KEY", "sk_test_dummy")
  end

  def ensure_customer(user)
    return user.stripe_customer_id if user.stripe_customer_id.present?

    customer = Stripe::Customer.create(email: user.email, name: user.name, metadata: { user_id: user.id })
    user.update!(stripe_customer_id: customer.id)
    customer.id
  rescue Stripe::StripeError => e
    raise Error, e.message
  end

  def create_payment_intent(order, payment_method_id:)
    Stripe::PaymentIntent.create(
      amount: order.total_cents,
      currency: order.currency.downcase,
      customer: order.user.stripe_customer_id,
      payment_method: payment_method_id,
      confirm: true,
      off_session: false,
      metadata: { order_id: order.id }
    )
  rescue Stripe::StripeError => e
    raise Error, e.message
  end

  def create_subscription(user, plan:, product:, payment_method_id:)
    Stripe::Subscription.create(
      customer: user.stripe_customer_id,
      items: [{ price_data: {
        currency: product.currency.downcase,
        product_data: { name: product.name },
        unit_amount: ((product.price_cents * (100 - plan.discount_percent)) / 100.0).round,
        recurring: { interval: "day", interval_count: plan.interval_days }
      } }],
      default_payment_method: payment_method_id,
      metadata: { user_id: user.id, product_id: product.id, plan_code: plan.code }
    )
  rescue Stripe::StripeError => e
    raise Error, e.message
  end
end
