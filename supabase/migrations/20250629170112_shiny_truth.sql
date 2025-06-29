/*
  # Create Stripe views for subscription data

  1. New Views
    - `stripe_user_subscriptions` - View joining users, customers, and subscriptions
    - `stripe_user_orders` - View joining users, customers, and orders
  
  2. Security
    - Grant select permissions to authenticated users
*/

-- Create view for user subscriptions
CREATE OR REPLACE VIEW stripe_user_subscriptions AS
SELECT
  u.id as user_id,
  c.customer_id,
  s.subscription_id,
  s.status as subscription_status,
  s.price_id,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.payment_method_brand,
  s.payment_method_last4
FROM
  auth.users u
JOIN
  public.stripe_customers c ON u.id = c.user_id
LEFT JOIN
  public.stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE
  c.deleted_at IS NULL;

-- Create view for user orders
CREATE OR REPLACE VIEW stripe_user_orders AS
SELECT
  u.id as user_id,
  c.customer_id,
  o.id as order_id,
  o.checkout_session_id,
  o.payment_intent_id,
  o.amount_total,
  o.currency,
  o.payment_status,
  o.status as order_status,
  o.created_at
FROM
  auth.users u
JOIN
  public.stripe_customers c ON u.id = c.user_id
LEFT JOIN
  public.stripe_orders o ON c.customer_id = o.customer_id
WHERE
  c.deleted_at IS NULL;

-- Grant select permissions
GRANT SELECT ON public.stripe_user_subscriptions TO authenticated;
GRANT SELECT ON public.stripe_user_orders TO authenticated;