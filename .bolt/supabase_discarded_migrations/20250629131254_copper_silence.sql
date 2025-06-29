/*
  # Add User Plan Field and Fix Signup Name

  1. New Fields
    - Ensure subscription_plan field exists in user_profiles table
    - Add check constraint for valid plan values (free, standard, premium, pro)
    - Update existing users to have 'free' plan

  2. Signup Name Fix
    - Update handle_new_user function to properly save the name from signup
    - Ensure display_name is set from form input
*/

-- Ensure subscription_plan field exists with proper constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_plan'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_plan text DEFAULT 'free';
  END IF;
END $$;

-- Update the constraint to include all plan types
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_plan_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_subscription_plan_check 
  CHECK (subscription_plan = ANY (ARRAY['free'::text, 'standard'::text, 'premium'::text, 'pro'::text]));

-- Update existing users to have 'free' plan if null
UPDATE user_profiles 
SET subscription_plan = 'free' 
WHERE subscription_plan IS NULL;

-- Update handle_new_user function to properly save the name from signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create user profile with proper name handling
  BEGIN
    INSERT INTO public.user_profiles (
      id,
      display_name,
      avatar_url,
      timezone,
      preferences,
      subscription_tier,
      subscription_plan,
      usage_stats,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'name', -- First try to get name from metadata
        NEW.raw_user_meta_data->>'display_name', -- Then try display_name
        split_part(NEW.email, '@', 1) -- Fall back to email username
      ),
      NEW.raw_user_meta_data->>'avatar_url',
      'UTC',
      '{}',
      'free',
      'free',
      '{}',
      now(),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
  END;

  -- Create user usage record with error handling
  BEGIN
    INSERT INTO public.user_usage (
      user_id,
      plan_id,
      call_time_used,
      agents_created,
      integrations_active,
      storage_used,
      chat_tokens_used,
      billing_cycle,
      last_reset_date,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      'free',
      0,
      0,
      0,
      0,
      0,
      'weekly',
      now(),
      now(),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user usage: %', SQLERRM;
  END;

  -- Create user subscription record with error handling
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      trial_end,
      cancel_at_period_end,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      'free',
      'active',
      now(),
      NULL,
      NULL,
      false,
      now(),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user subscription: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;