-- Create or replace the stripe_user_subscriptions view
CREATE OR REPLACE VIEW public.stripe_user_subscriptions AS
SELECT
  sc.user_id,
  ss.customer_id,
  ss.subscription_id,
  ss.price_id,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at_period_end,
  ss.payment_method_brand,
  ss.payment_method_last4,
  ss.status AS subscription_status
FROM
  public.stripe_subscriptions ss
JOIN
  public.stripe_customers sc ON ss.customer_id = sc.customer_id
WHERE
  ss.deleted_at IS NULL
  AND sc.deleted_at IS NULL;

-- Create RLS policy for authenticated users to view their own subscription data
CREATE POLICY "Users can view their own subscription data"
ON public.stripe_user_subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create a view for user orders
CREATE OR REPLACE VIEW public.stripe_user_orders AS
SELECT
  sc.user_id,
  so.id AS order_id,
  so.checkout_session_id,
  so.payment_intent_id,
  so.amount_subtotal,
  so.amount_total,
  so.currency,
  so.payment_status,
  so.status AS order_status,
  so.created_at AS order_date
FROM
  public.stripe_orders so
JOIN
  public.stripe_customers sc ON so.customer_id = sc.customer_id
WHERE
  so.deleted_at IS NULL
  AND sc.deleted_at IS NULL;

-- Create RLS policy for authenticated users to view their own order data
CREATE POLICY "Users can view their own order data"
ON public.stripe_user_orders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());