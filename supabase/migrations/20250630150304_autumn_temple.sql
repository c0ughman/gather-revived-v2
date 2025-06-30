/*
  # Fix signup issues - Complete database schema repair

  1. Drop and recreate problematic triggers and functions
  2. Ensure all required tables exist with proper constraints
  3. Fix any missing functions that triggers depend on
  4. Clean up any references to non-existent tables
*/

-- First, let's safely drop any problematic triggers
DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;

-- Drop any problematic functions that might reference missing tables
DROP FUNCTION IF EXISTS public.initialize_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.initialize_user_pricing() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Ensure the update_updated_at_column function exists (this is commonly used)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a simple initialize_user_profile function that only works with existing tables
CREATE OR REPLACE FUNCTION public.initialize_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Only initialize basic profile data, no references to missing tables
    UPDATE public.user_profiles 
    SET 
        preferences = COALESCE(preferences, '{}'::jsonb),
        usage_stats = COALESCE(usage_stats, '{}'::jsonb),
        updated_at = now()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the triggers with the fixed function
CREATE TRIGGER on_user_profile_created
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.initialize_user_profile();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure user_profiles table has all necessary constraints
-- Add any missing constraints that might be causing ON CONFLICT issues
DO $$
BEGIN
    -- Ensure the primary key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_profiles' 
        AND constraint_type = 'PRIMARY KEY'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
    END IF;
    
    -- Ensure foreign key constraint to auth.users exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_profiles' 
        AND constraint_name = 'user_profiles_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT user_profiles_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Clean up any references to tables that don't exist in triggers
-- Update the subscription trigger function to be more robust
CREATE OR REPLACE FUNCTION public.update_user_profile_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update user_profiles if it exists and has the necessary columns
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles'
    ) THEN
        UPDATE public.user_profiles 
        SET 
            preferences = COALESCE(preferences, '{}'::jsonb) || 
                         jsonb_build_object('subscription', row_to_json(NEW)::jsonb),
            updated_at = now()
        WHERE id = (
            SELECT user_id FROM public.stripe_customers 
            WHERE customer_id = NEW.customer_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure RLS is properly configured
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies to ensure they're correct
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile_subscription() TO authenticated;