/*
  # Update subscription triggers

  1. New Functions
    - `handle_subscription_change` - Updates user profile when subscription changes
    - `initialize_user_profile` - Creates default profile for new users
  
  2. Triggers
    - Add trigger on `stripe_subscriptions` to update user profile
    - Add trigger on `auth.users` to initialize user profile
*/

-- Function to handle subscription changes and update user profile
CREATE OR REPLACE FUNCTION public.handle_subscription_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_plan text;
BEGIN
  -- Get the user_id from the stripe_customers table
  SELECT user_id INTO v_user_id
  FROM public.stripe_customers
  WHERE customer_id = NEW.customer_id;
  
  -- If no user found, exit
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found for customer_id: %', NEW.customer_id;
    RETURN NEW;
  END IF;
  
  -- Determine plan based on price_id and status
  IF NEW.status = 'active' OR NEW.status = 'trialing' THEN
    CASE NEW.price_id
      WHEN 'price_1RfLCZCHpOkAgMGGUtW046jz' THEN v_plan := 'standard';
      WHEN 'price_1RfLEACHpOkAgMGGl3yIkLiX' THEN v_plan := 'premium';
      WHEN 'price_1RfLFJCHpOkAgMGGtGJlOf2I' THEN v_plan := 'pro';
      ELSE v_plan := 'free';
    END CASE;
  ELSE
    -- For canceled, unpaid, etc.
    v_plan := 'free';
  END IF;
  
  -- Update user_profiles
  INSERT INTO public.user_profiles (id, subscription_tier, subscription_plan, plan, updated_at)
  VALUES (v_user_id, v_plan, v_plan, v_plan, NOW())
  ON CONFLICT (id) DO UPDATE
  SET 
    subscription_tier = v_plan,
    subscription_plan = v_plan,
    plan = v_plan,
    updated_at = NOW();
  
  -- Update user_usage
  INSERT INTO public.user_usage (user_id, plan_id, updated_at)
  VALUES (v_user_id, v_plan, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET 
    plan_id = v_plan,
    updated_at = NOW();
  
  RAISE NOTICE 'Updated user % to plan %', v_user_id, v_plan;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize user profile on signup
CREATE OR REPLACE FUNCTION public.initialize_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default user profile
  INSERT INTO public.user_profiles (
    id, 
    display_name, 
    subscription_tier, 
    subscription_plan, 
    plan, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 
    'free', 
    'free', 
    'free', 
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create default user usage
  INSERT INTO public.user_usage (
    user_id,
    plan_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for subscription changes
DROP TRIGGER IF EXISTS handle_subscription_change_trigger ON public.stripe_subscriptions;
CREATE TRIGGER handle_subscription_change_trigger
AFTER INSERT OR UPDATE ON public.stripe_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_subscription_change();

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS initialize_user_profile_trigger ON auth.users;
CREATE TRIGGER initialize_user_profile_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.initialize_user_profile();

-- Add comment to explain the purpose of these triggers
COMMENT ON FUNCTION public.handle_subscription_change() IS 'Updates user profile when subscription changes';
COMMENT ON FUNCTION public.initialize_user_profile() IS 'Creates default profile for new users';