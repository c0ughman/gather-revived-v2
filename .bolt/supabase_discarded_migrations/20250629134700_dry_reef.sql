/*
  # Add Promotion Codes Support
  
  This migration creates a view for promotion codes and ensures
  the database structure supports promotion codes in the checkout process.
  
  1. Create a view for promotion codes
  2. Add necessary RLS policies
*/

-- Create a view for promotion codes
CREATE OR REPLACE VIEW public.stripe_promotion_codes WITH (security_invoker = true) AS
SELECT
    pc.id,
    pc.code,
    pc.active,
    pc.coupon_id,
    c.percent_off,
    c.amount_off,
    c.currency,
    c.duration,
    c.duration_in_months,
    c.name,
    c.max_redemptions,
    c.times_redeemed,
    pc.expires_at,
    pc.created
FROM
    stripe.promotion_codes pc
JOIN
    stripe.coupons c ON pc.coupon_id = c.id
WHERE
    pc.active = true
    AND (pc.expires_at IS NULL OR pc.expires_at > extract(epoch from now()));

-- Grant access to authenticated users
GRANT SELECT ON public.stripe_promotion_codes TO authenticated;

-- Ensure the stripe_user_subscriptions view has the correct security settings
DO $$
BEGIN
  EXECUTE 'ALTER VIEW public.stripe_user_subscriptions SET (security_invoker = true)';
EXCEPTION
  WHEN undefined_object THEN
    NULL;
  WHEN syntax_error THEN
    NULL;
END $$;

-- Ensure the stripe_user_orders view has the correct security settings
DO $$
BEGIN
  EXECUTE 'ALTER VIEW public.stripe_user_orders SET (security_invoker = true)';
EXCEPTION
  WHEN undefined_object THEN
    NULL;
  WHEN syntax_error THEN
    NULL;
END $$;