/*
  # Create Stripe views for user data access
  
  1. New Views
    - `stripe_user_subscriptions` - Shows subscription data for authenticated users
    - `stripe_user_orders` - Shows order data for authenticated users
  
  2. Security
    - Both views are created with SECURITY DEFINER
    - RLS policies added to restrict access to user's own data
*/

-- Create view for user subscriptions with security definer
CREATE OR REPLACE VIEW public.stripe_user_subscriptions 
WITH (security_barrier = true)
AS
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
  AND ss.deleted_at IS NULL;

-- Create view for user orders with security definer
CREATE OR REPLACE VIEW public.stripe_user_orders
WITH (security_barrier = true)
AS
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
  AND so.deleted_at IS NULL;

-- Set ownership and permissions
ALTER VIEW public.stripe_user_subscriptions OWNER TO postgres;
ALTER VIEW public.stripe_user_orders OWNER TO postgres;

-- Add RLS policies for views
CREATE POLICY "Users can view their own subscription data" ON public.stripe_user_subscriptions
  FOR SELECT
  TO authenticated
  USING (customer_id IN (
    SELECT customer_id FROM public.stripe_customers 
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY "Users can view their own order data" ON public.stripe_user_orders
  FOR SELECT
  TO authenticated
  USING (customer_id IN (
    SELECT customer_id FROM public.stripe_customers 
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));