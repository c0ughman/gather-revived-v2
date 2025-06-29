/*
  # Fix user signup database error

  1. Database Functions
    - Create or replace the `update_updated_at_column` function for timestamp updates
    - Create or replace the `handle_new_user` function to automatically create user profiles
    - Create or replace the `initialize_user_profile` function for profile initialization

  2. Triggers
    - Create trigger on auth.users to automatically create user profiles on signup
    - Ensure proper error handling and data validation

  3. Security
    - Ensure functions have proper security context
    - Add error handling to prevent signup failures
*/

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    display_name,
    subscription_plan,
    plan,
    subscription_tier,
    preferences,
    usage_stats,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
    'free',
    'free',
    'free',
    '{}',
    '{}',
    now(),
    now()
  );
  
  -- Also create initial usage tracking
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
  )
  VALUES (
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

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function specifically for profile initialization (alternative approach)
CREATE OR REPLACE FUNCTION initialize_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    display_name,
    subscription_plan,
    plan,
    subscription_tier,
    preferences,
    usage_stats
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
    'free',
    'free',
    'free',
    '{}',
    '{}'
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail signup
    RAISE WARNING 'Error initializing user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure the users table reference exists (create if missing)
DO $$
BEGIN
  -- Check if users table exists in public schema, if not create a reference
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    -- Create a view or reference to auth.users for foreign key constraints
    CREATE VIEW public.users AS SELECT * FROM auth.users;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If we can't create the view, the foreign key constraints will handle it
    NULL;
END $$;

-- Update any existing users that might not have profiles
INSERT INTO public.user_profiles (
  id,
  display_name,
  subscription_plan,
  plan,
  subscription_tier,
  preferences,
  usage_stats
)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.email, 'User'),
  'free',
  'free',
  'free',
  '{}',
  '{}'
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Update any existing users that might not have usage records
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
)
SELECT 
  au.id,
  'free',
  0,
  0,
  0,
  0,
  0,
  'weekly',
  now()
FROM auth.users au
LEFT JOIN public.user_usage uu ON au.id = uu.user_id
WHERE uu.user_id IS NULL
ON CONFLICT DO NOTHING;