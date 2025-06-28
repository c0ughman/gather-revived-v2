/*
  # Add subscription plan to user profiles

  1. Changes
    - Add subscription_plan column to user_profiles table
    - Set default value to 'free'
    - Add check constraint for valid plan values
    - Update existing users to have 'free' plan

  2. Security
    - No changes to RLS policies needed
*/

-- Add subscription_plan column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_plan'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_plan text DEFAULT 'free';
  END IF;
END $$;

-- Add check constraint for valid subscription plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_profiles' AND constraint_name = 'user_profiles_subscription_plan_check'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_subscription_plan_check 
    CHECK (subscription_plan = ANY (ARRAY['free'::text, 'starter'::text, 'pro'::text, 'enterprise'::text]));
  END IF;
END $$;

-- Update existing users to have 'free' plan if null
UPDATE user_profiles 
SET subscription_plan = 'free' 
WHERE subscription_plan IS NULL;