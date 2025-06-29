/*
  # Add subscription to user profile preferences

  1. Changes
    - Ensure user_profiles table has preferences column
    - Add subscription data to preferences JSON structure
    - Add helper function to update user profile with subscription data
*/

-- Make sure user_profiles has preferences column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'preferences'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create function to update user profile with subscription data
CREATE OR REPLACE FUNCTION update_user_profile_subscription()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  preferences JSONB;
BEGIN
  -- Get user_id from stripe_customers
  SELECT sc.user_id INTO user_id
  FROM stripe_customers sc
  WHERE sc.customer_id = NEW.customer_id;
  
  IF user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get current preferences
  SELECT up.preferences INTO preferences
  FROM user_profiles up
  WHERE up.id = user_id;
  
  IF preferences IS NULL THEN
    preferences := '{}'::jsonb;
  END IF;
  
  -- Update preferences with subscription data
  preferences := jsonb_set(
    preferences,
    '{subscription}',
    to_jsonb(NEW)
  );
  
  -- Update user profile
  UPDATE user_profiles
  SET 
    preferences = preferences,
    updated_at = NOW()
  WHERE id = user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update user profile when subscription changes
DROP TRIGGER IF EXISTS update_user_profile_on_subscription_change ON stripe_subscriptions;

CREATE TRIGGER update_user_profile_on_subscription_change
AFTER INSERT OR UPDATE ON stripe_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_user_profile_subscription();