/*
  # Fix User Signup Database Functions

  This migration adds the essential database functions and triggers required for 
  Supabase Auth to work properly with user profiles and usage tracking.

  1. Database Functions
    - `uid()` - Gets the current authenticated user's ID
    - `handle_new_user()` - Creates user profile and usage records on signup
    - `update_updated_at_column()` - Updates the updated_at timestamp
    - `update_agent_usage_stats()` - Updates agent usage statistics
    - `update_conversation_metrics()` - Updates conversation metrics

  2. Triggers
    - Creates trigger to automatically handle new user signup
    - Ensures user profiles and usage records are created automatically

  3. Security
    - Ensures proper RLS policies are in place for user management
*/

-- Create the uid() function to get current user ID
CREATE OR REPLACE FUNCTION uid() 
RETURNS uuid 
LANGUAGE sql 
STABLE
AS $$
  SELECT auth.uid();
$$;

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into user_profiles
  INSERT INTO public.user_profiles (
    id,
    display_name,
    avatar_url,
    timezone,
    preferences,
    subscription_tier,
    subscription_plan,
    usage_stats,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'UTC',
    '{}',
    'free',
    'free',
    '{}',
    now(),
    now()
  );

  -- Insert into user_usage
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
  ) VALUES (
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

  -- Insert into user_subscriptions
  INSERT INTO public.user_subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_end,
    cancel_at_period_end,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    'free',
    'active',
    now(),
    NULL,
    NULL,
    false,
    now(),
    now()
  );

  RETURN NEW;
END;
$$;

-- Create function to update agent usage stats
CREATE OR REPLACE FUNCTION update_agent_usage_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  agent_user_id uuid;
BEGIN
  -- Get the user_id for the agent
  SELECT ua.user_id INTO agent_user_id
  FROM user_agents ua
  JOIN conversations c ON c.agent_id = ua.id
  WHERE c.id = NEW.conversation_id;

  -- Update agent usage stats
  IF agent_user_id IS NOT NULL THEN
    UPDATE user_agents 
    SET 
      total_messages = total_messages + 1,
      last_used_at = now(),
      updated_at = now()
    WHERE id = (
      SELECT agent_id 
      FROM conversations 
      WHERE id = NEW.conversation_id
    );

    -- Update user usage stats
    UPDATE user_usage
    SET 
      chat_tokens_used = chat_tokens_used + COALESCE(NEW.tokens_used, 0),
      updated_at = now()
    WHERE user_id = agent_user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create function to update conversation metrics
CREATE OR REPLACE FUNCTION update_conversation_metrics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update conversation message count and last message time
    UPDATE conversations
    SET 
      message_count = message_count + 1,
      total_tokens = total_tokens + COALESCE(NEW.tokens_used, 0),
      last_message_at = NEW.timestamp,
      updated_at = now()
    WHERE id = NEW.conversation_id;

    -- Update agent total conversations if this is the first message
    UPDATE user_agents
    SET total_conversations = (
      SELECT COUNT(DISTINCT c.id)
      FROM conversations c
      WHERE c.agent_id = user_agents.id
    )
    WHERE id = (
      SELECT agent_id 
      FROM conversations 
      WHERE id = NEW.conversation_id
    );

  ELSIF TG_OP = 'DELETE' THEN
    -- Update conversation message count when message is deleted
    UPDATE conversations
    SET 
      message_count = GREATEST(message_count - 1, 0),
      total_tokens = GREATEST(total_tokens - COALESCE(OLD.tokens_used, 0), 0),
      updated_at = now()
    WHERE id = OLD.conversation_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create function to initialize user pricing (placeholder)
CREATE OR REPLACE FUNCTION initialize_user_pricing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function can be used for additional pricing initialization if needed
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Ensure RLS is enabled on all user tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Ensure the users table exists in auth schema (this should already exist)
-- We just need to make sure our functions can access it

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON auth.users TO postgres, service_role;
GRANT SELECT ON auth.users TO anon, authenticated;