/*
  # Add user plan field to user_profiles table

  1. Changes
    - Add `plan` column to `user_profiles` table with default value 'free'
    - Add check constraint to ensure valid plan values
    - Update existing records to have 'free' plan if null

  2. Security
    - No RLS changes needed as table already has proper policies
*/

-- Add plan column to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN plan text DEFAULT 'free';
  END IF;
END $$;

-- Add check constraint for valid plan values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'user_profiles_plan_check'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_plan_check 
    CHECK (plan = ANY (ARRAY['free'::text, 'starter'::text, 'pro'::text, 'enterprise'::text]));
  END IF;
END $$;

-- Update any existing records that might have null plan values
UPDATE user_profiles SET plan = 'free' WHERE plan IS NULL;