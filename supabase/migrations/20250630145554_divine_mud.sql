/*
  # Remove user_usage functionality

  This migration removes all user_usage related database objects that are causing
  signup failures. This includes:

  1. Drop Tables
     - `user_usage` table and all its dependencies
  
  2. Drop Functions
     - `initialize_user_usage()` function
     - `update_agent_usage_stats()` function  
     - `update_integration_usage_stats()` function
     - `update_storage_usage_stats()` function
     - Any other usage-related functions

  3. Drop Triggers
     - All triggers that call the above functions
*/

-- Drop triggers that reference usage functions
DROP TRIGGER IF EXISTS update_agent_usage_trigger ON user_agents;
DROP TRIGGER IF EXISTS update_agent_usage_trigger ON messages;
DROP TRIGGER IF EXISTS update_integration_usage_trigger ON agent_integrations;
DROP TRIGGER IF EXISTS update_storage_usage_trigger ON agent_documents;
DROP TRIGGER IF EXISTS on_user_profile_created ON user_profiles;

-- Drop the user_usage table
DROP TABLE IF EXISTS user_usage CASCADE;

-- Drop usage-related functions
DROP FUNCTION IF EXISTS initialize_user_usage() CASCADE;
DROP FUNCTION IF EXISTS update_agent_usage_stats() CASCADE;
DROP FUNCTION IF EXISTS update_integration_usage_stats() CASCADE;
DROP FUNCTION IF EXISTS update_storage_usage_stats() CASCADE;

-- Recreate the user_profiles trigger without usage initialization
CREATE OR REPLACE FUNCTION initialize_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Just return the new record without any usage initialization
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger for user profiles (without usage initialization)
CREATE TRIGGER on_user_profile_created
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_profile();

-- Remove plan_id column from user_profiles if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN plan_id;
  END IF;
END $$;