/*
  # Fix stripe_user_subscriptions view

  1. Views
    - Create or replace `stripe_user_subscriptions` view
    - Join stripe_customers and stripe_subscriptions tables
    - Expose user-specific subscription data

  2. Security
    - Enable RLS on the view
    - Add policy for authenticated users to view their own subscription data
*/

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

-- Enable Row Level Security on the view
ALTER VIEW public.stripe_user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view their own subscription data" ON public.stripe_user_subscriptions;

-- Create RLS policy for authenticated users to view their own subscription data
CREATE POLICY "Users can view their own subscription data"
ON public.stripe_user_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);