/*
  # Remove Stripe and Payment Related Tables

  1. Changes
     - Drop all Stripe-related tables and views
     - Remove payment-related constraints and references
     - Clean up any payment-related data in user_profiles

  2. Tables Removed
     - stripe_customers
     - stripe_orders
     - stripe_subscriptions
     - stripe_user_subscriptions (view)
     - stripe_user_orders (view)

  3. Columns Updated
     - Remove payment-related columns from user_profiles
*/

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS public.stripe_user_subscriptions;
DROP VIEW IF EXISTS public.stripe_user_orders;

-- Drop tables
DROP TABLE IF EXISTS public.stripe_subscriptions;
DROP TABLE IF EXISTS public.stripe_orders;
DROP TABLE IF EXISTS public.stripe_customers;

-- Drop enum types
DROP TYPE IF EXISTS public.stripe_subscription_status;
DROP TYPE IF EXISTS public.stripe_order_status;

-- Update user_profiles to remove payment-related columns
ALTER TABLE public.user_profiles 
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS subscription_plan,
  DROP COLUMN IF EXISTS plan;

-- Remove payment-related constraints from user_profiles
ALTER TABLE public.user_profiles 
  DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check,
  DROP CONSTRAINT IF EXISTS user_profiles_subscription_plan_check,
  DROP CONSTRAINT IF EXISTS user_profiles_plan_check;

-- Update user_profiles to set default plan to 'free'
UPDATE public.user_profiles
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'::jsonb),
  '{plan}',
  '"free"'
);

-- Drop user_subscriptions table if it exists
DROP TABLE IF EXISTS public.user_subscriptions;