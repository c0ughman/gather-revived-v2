/*
  # Fix user profiles trigger and RLS policies

  1. Database Functions
    - Create or replace the trigger function for user profile initialization
    - Ensure proper error handling and user creation flow

  2. Triggers
    - Create trigger to automatically create user profile on auth.users insert
    - Handle any existing trigger conflicts

  3. Security
    - Verify RLS policies are correctly configured
    - Ensure proper permissions for user profile creation
*/

-- Create or replace the function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into user_profiles
  INSERT INTO public.user_profiles (id, display_name, timezone, preferences, usage_stats)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    'UTC',
    '{}',
    '{}'
  );

  -- Insert into user_usage
  INSERT INTO public.user_usage (user_id, plan_id, call_time_used, agents_created, integrations_active, storage_used, chat_tokens_used, billing_cycle, last_reset_date)
  VALUES (
    NEW.id,
    'free',
    0,
    0,
    0,
    0,
    0,
    'weekly',
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS is enabled on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Ensure RLS is enabled on user_usage
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies for user_profiles if they don't exist
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

  -- Create new policies
  CREATE POLICY "Users can view own profile"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

  CREATE POLICY "Users can insert own profile"
    ON public.user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

  CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);
END $$;

-- Recreate RLS policies for user_usage if they don't exist
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view own usage" ON public.user_usage;
  DROP POLICY IF EXISTS "Users can insert own usage" ON public.user_usage;
  DROP POLICY IF EXISTS "Users can update own usage" ON public.user_usage;

  -- Create new policies
  CREATE POLICY "Users can view own usage"
    ON public.user_usage
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert own usage"
    ON public.user_usage
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update own usage"
    ON public.user_usage
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_usage TO authenticated;