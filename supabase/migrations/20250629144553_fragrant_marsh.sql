/*
  # Fix User Signup Database Trigger

  1. Database Functions
    - Create `handle_new_user` function to automatically create user profiles
    - Create `initialize_user_profile` function for profile initialization
    - Create `update_updated_at_column` function for timestamp updates

  2. Triggers
    - Add trigger on auth.users to automatically create user_profiles
    - Ensure proper error handling and data consistency

  3. Security
    - Maintain existing RLS policies
    - Ensure functions run with proper security context
*/

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user registration
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
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        'free',
        'free',
        'free',
        '{}',
        '{}',
        now(),
        now()
    );
    
    -- Also create initial usage record
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
        RAISE LOG 'Error creating user profile for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize user profile (alternative approach)
CREATE OR REPLACE FUNCTION initialize_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    RETURN handle_new_user();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table to automatically create user profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Ensure RLS is properly configured for user_profiles (should already exist but let's be safe)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Ensure the insert policy exists and is correct
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
    ON user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Ensure the select policy exists and is correct
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
    ON user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Ensure the update policy exists and is correct
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
    ON user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Ensure RLS is properly configured for user_usage
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Ensure user_usage policies exist
DROP POLICY IF EXISTS "Users can insert own usage" ON user_usage;
CREATE POLICY "Users can insert own usage"
    ON user_usage
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
CREATE POLICY "Users can view own usage"
    ON user_usage
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage" ON user_usage;
CREATE POLICY "Users can update own usage"
    ON user_usage
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);