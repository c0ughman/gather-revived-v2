/*
  # Create secure views for Stripe data
  
  1. New Views
    - `stripe_user_subscriptions` - Shows subscription data for authenticated users
    - `stripe_user_orders` - Shows order data for authenticated users
  
  2. Security
    - Both views are created with security_definer to run with owner privileges
    - No RLS policies needed as views filter data based on user ID
*/

-- Create view for user subscriptions with security definer
CREATE OR REPLACE VIEW public.stripe_user_subscriptions AS
SELECT 
  sc.customer_id,
  ss.subscription_id,
  ss.status as subscription_status,
  ss.price_id,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at_period_end,
  ss.payment_method_brand,
  ss.payment_method_last4
FROM 
  public.stripe_customers sc
JOIN 
  public.stripe_subscriptions ss ON sc.customer_id = ss.customer_id
WHERE 
  sc.deleted_at IS NULL
  AND ss.deleted_at IS NULL
  AND sc.user_id = auth.uid(); -- Filter by authenticated user

-- Set view as security definer
ALTER VIEW public.stripe_user_subscriptions SET (security_barrier = true);
ALTER VIEW public.stripe_user_subscriptions OWNER TO postgres;

-- Create view for user orders with security definer
CREATE OR REPLACE VIEW public.stripe_user_orders AS
SELECT 
  sc.customer_id,
  so.id as order_id,
  so.checkout_session_id,
  so.payment_intent_id,
  so.amount_subtotal,
  so.amount_total,
  so.currency,
  so.payment_status,
  so.status as order_status,
  so.created_at as order_date
FROM 
  public.stripe_customers sc
JOIN 
  public.stripe_orders so ON sc.customer_id = so.customer_id
WHERE 
  sc.deleted_at IS NULL
  AND so.deleted_at IS NULL
  AND sc.user_id = auth.uid(); -- Filter by authenticated user

-- Set view as security definer
ALTER VIEW public.stripe_user_orders SET (security_barrier = true);
ALTER VIEW public.stripe_user_orders OWNER TO postgres;

-- Mark views as security definer
COMMENT ON VIEW public.stripe_user_subscriptions IS 'Security definer view for user subscriptions';
COMMENT ON VIEW public.stripe_user_orders IS 'Security definer view for user orders';