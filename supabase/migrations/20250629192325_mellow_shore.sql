/*
  # Call Time Tracking

  1. New Tables
    - None (using existing user_usage table)
  
  2. Changes
    - Add function to track call time usage
    - Add function to reset daily usage
    - Add function to check if user has exceeded limits
  
  3. Security
    - Ensure RLS policies are in place for user_usage table
*/

-- Make sure user_usage table exists
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT DEFAULT 'free',
  call_time_used INTEGER DEFAULT 0,
  agents_created INTEGER DEFAULT 0,
  integrations_active INTEGER DEFAULT 0,
  storage_used BIGINT DEFAULT 0,
  chat_tokens_used BIGINT DEFAULT 0,
  billing_cycle TEXT DEFAULT 'weekly',
  last_reset_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create RLS policies for user_usage table
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Check if policies exist before creating them
DO $$
BEGIN
  -- Check and create "Users can view own usage" policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_usage' AND policyname = 'Users can view own usage'
  ) THEN
    CREATE POLICY "Users can view own usage" 
    ON user_usage FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);
  END IF;

  -- Check and create "Users can insert own usage" policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_usage' AND policyname = 'Users can insert own usage'
  ) THEN
    CREATE POLICY "Users can insert own usage" 
    ON user_usage FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check and create "Users can update own usage" policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_usage' AND policyname = 'Users can update own usage'
  ) THEN
    CREATE POLICY "Users can update own usage" 
    ON user_usage FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Create function to increment call time usage
CREATE OR REPLACE FUNCTION increment_call_time(user_id UUID, seconds INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_usage INTEGER;
  new_usage INTEGER;
BEGIN
  -- Get current usage
  SELECT call_time_used INTO current_usage
  FROM user_usage
  WHERE user_id = user_id;
  
  -- Calculate new usage
  new_usage := COALESCE(current_usage, 0) + seconds;
  
  -- Update usage
  UPDATE user_usage
  SET 
    call_time_used = new_usage,
    updated_at = now()
  WHERE user_id = user_id;
  
  -- Return new usage
  RETURN new_usage;
END;
$$;

-- Create function to check if user has exceeded call time limit
CREATE OR REPLACE FUNCTION has_exceeded_call_time_limit(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_usage INTEGER;
  user_plan TEXT;
  daily_limit INTEGER;
BEGIN
  -- Get user's plan and current usage
  SELECT call_time_used, plan_id INTO current_usage, user_plan
  FROM user_usage
  WHERE user_id = user_id;
  
  -- Set daily limit based on plan
  CASE user_plan
    WHEN 'free' THEN daily_limit := 600; -- 10 minutes in seconds
    WHEN 'standard' THEN daily_limit := 1200; -- 20 minutes in seconds
    WHEN 'premium' THEN daily_limit := 6000; -- 100 minutes in seconds
    WHEN 'pro' THEN daily_limit := 86400; -- 24 hours in seconds (unlimited)
    ELSE daily_limit := 600; -- Default to free plan
  END CASE;
  
  -- Check if usage exceeds limit
  RETURN COALESCE(current_usage, 0) >= daily_limit;
END;
$$;

-- Create function to reset daily usage
CREATE OR REPLACE FUNCTION reset_daily_call_time_usage()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reset call time for users whose last reset was more than 24 hours ago
  UPDATE user_usage
  SET 
    call_time_used = 0,
    last_reset_date = now(),
    updated_at = now()
  WHERE now() - last_reset_date > INTERVAL '1 day';
END;
$$;

-- Create function to initialize user usage on signup
CREATE OR REPLACE FUNCTION initialize_user_usage()
RETURNS TRIGGER AS $$
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
    last_reset_date
  ) VALUES (
    NEW.id,
    'free',
    0,
    0,
    0,
    0,
    0,
    'daily',
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to initialize user usage on signup
DROP TRIGGER IF EXISTS on_auth_user_created_usage ON auth.users;

CREATE TRIGGER on_auth_user_created_usage
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_usage();

-- Add constraint for billing_cycle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_usage_billing_cycle_check'
  ) THEN
    ALTER TABLE user_usage 
    ADD CONSTRAINT user_usage_billing_cycle_check 
    CHECK (billing_cycle = ANY (ARRAY['weekly', 'daily', 'monthly']));
  END IF;
END
$$;