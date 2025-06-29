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

-- Create or replace function to update user profile with subscription data
CREATE OR REPLACE FUNCTION update_user_profile_subscription()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  preferences JSONB;
  plan_name TEXT := 'free';
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
  
  -- Determine plan name based on price_id
  IF NEW.price_id = 'price_1RfLCZCHpOkAgMGGUtW046jz' THEN
    plan_name := 'standard';
  ELSIF NEW.price_id = 'price_1RfLEACHpOkAgMGGl3yIkLiX' THEN
    plan_name := 'premium';
  ELSIF NEW.price_id = 'price_1RfLFJCHpOkAgMGGtGJlOf2I' THEN
    plan_name := 'pro';
  END IF;
  
  -- Update preferences with subscription data
  preferences := jsonb_set(
    preferences,
    '{subscription}',
    to_jsonb(NEW)
  );
  
  -- Add plan name to preferences
  preferences := jsonb_set(
    preferences,
    '{plan}',
    to_jsonb(plan_name)
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

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS update_user_profile_on_subscription_change ON stripe_subscriptions;

CREATE TRIGGER update_user_profile_on_subscription_change
AFTER INSERT OR UPDATE ON stripe_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_user_profile_subscription();

-- Create a function to initialize user profile on signup
CREATE OR REPLACE FUNCTION initialize_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, preferences)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    jsonb_build_object('plan', 'free')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to initialize user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_profile();