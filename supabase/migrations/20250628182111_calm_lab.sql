/*
  # Fix Database Functions and Policies

  1. Functions
    - Create handle_new_user function with error handling
    - Create utility functions for database operations
    - Drop and recreate functions to avoid type conflicts

  2. Security
    - Enable RLS on all tables
    - Create proper policies for user data access
    - Add performance indexes

  3. Triggers
    - Set up user creation trigger
    - Add update triggers for timestamps and metrics
*/

-- Drop existing functions first to avoid type conflicts
DROP FUNCTION IF EXISTS public.get_user_profile_with_usage(uuid);
DROP FUNCTION IF EXISTS public.get_user_agents(uuid);

-- Create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create user profile with error handling
  BEGIN
    INSERT INTO public.user_profiles (id, display_name, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
      NOW(),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
  END;

  -- Create user usage record with error handling
  BEGIN
    INSERT INTO public.user_usage (user_id, plan_id, created_at, updated_at)
    VALUES (NEW.id, 'free', NOW(), NOW());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user usage: %', SQLERRM;
  END;

  -- Create user subscription record with error handling
  BEGIN
    INSERT INTO public.user_subscriptions (user_id, plan_id, created_at, updated_at)
    VALUES (NEW.id, 'free', NOW(), NOW());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user subscription: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Create trigger for new user creation (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function to update agent usage stats
CREATE OR REPLACE FUNCTION public.update_agent_usage_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update agent's total messages and last used time
  UPDATE user_agents 
  SET 
    total_messages = total_messages + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = (
    SELECT agent_id 
    FROM conversations 
    WHERE id = NEW.conversation_id
  );
  
  RETURN NEW;
END;
$$;

-- Function to update conversation metrics
CREATE OR REPLACE FUNCTION public.update_conversation_metrics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update conversation message count and last message time
    UPDATE conversations 
    SET 
      message_count = message_count + 1,
      last_message_at = NEW.timestamp,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    -- Update total tokens if provided
    IF NEW.tokens_used IS NOT NULL THEN
      UPDATE conversations 
      SET total_tokens = total_tokens + NEW.tokens_used
      WHERE id = NEW.conversation_id;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrease message count
    UPDATE conversations 
    SET 
      message_count = GREATEST(message_count - 1, 0),
      updated_at = NOW()
    WHERE id = OLD.conversation_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Ensure all RLS policies are properly set up
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Fix RLS policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Fix RLS policies for user_agents
DROP POLICY IF EXISTS "Users can view own agents" ON user_agents;
DROP POLICY IF EXISTS "Users can create own agents" ON user_agents;
DROP POLICY IF EXISTS "Users can update own agents" ON user_agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON user_agents;

CREATE POLICY "Users can view own agents"
  ON user_agents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agents"
  ON user_agents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents"
  ON user_agents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents"
  ON user_agents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix RLS policies for user_subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON user_subscriptions;

CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix RLS policies for user_usage
DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can update own usage" ON user_usage;

CREATE POLICY "Users can view own usage"
  ON user_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON user_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON user_usage
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_agents_user_id_active ON user_agents(user_id) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_conversations_user_agent ON conversations(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp ON messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_plan ON user_usage(user_id, plan_id);

-- Function to get user profile with usage data (recreated with proper signature)
CREATE FUNCTION public.get_user_profile_with_usage(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  timezone text,
  preferences jsonb,
  subscription_plan text,
  usage_stats jsonb,
  current_plan text,
  call_time_used integer,
  agents_created integer,
  integrations_active integer,
  storage_used bigint,
  chat_tokens_used bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    up.id,
    up.display_name,
    up.avatar_url,
    up.timezone,
    up.preferences,
    up.subscription_plan,
    up.usage_stats,
    uu.plan_id as current_plan,
    uu.call_time_used,
    uu.agents_created,
    uu.integrations_active,
    uu.storage_used,
    uu.chat_tokens_used
  FROM user_profiles up
  LEFT JOIN user_usage uu ON up.id = uu.user_id
  WHERE up.id = p_user_id;
$$;

-- Function to get user agents
CREATE FUNCTION public.get_user_agents(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  template_id text,
  name text,
  description text,
  initials text,
  color text,
  voice text,
  avatar_url text,
  status text,
  last_seen text,
  personality_prompt text,
  system_instructions text,
  custom_settings jsonb,
  folder text,
  tags jsonb,
  is_favorite boolean,
  sort_order integer,
  total_conversations integer,
  total_messages integer,
  last_used_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    ua.id,
    ua.user_id,
    ua.template_id,
    ua.name,
    ua.description,
    ua.initials,
    ua.color,
    ua.voice,
    ua.avatar_url,
    ua.status,
    ua.last_seen,
    ua.personality_prompt,
    ua.system_instructions,
    ua.custom_settings,
    ua.folder,
    ua.tags,
    ua.is_favorite,
    ua.sort_order,
    ua.total_conversations,
    ua.total_messages,
    ua.last_used_at,
    ua.created_at,
    ua.updated_at
  FROM user_agents ua
  WHERE ua.user_id = p_user_id
  ORDER BY ua.is_favorite DESC, ua.last_used_at DESC NULLS LAST, ua.created_at DESC;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;