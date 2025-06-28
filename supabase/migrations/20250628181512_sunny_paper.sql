/*
  # Fix User Data Loading and Database Functions

  1. Database Functions
    - Create user management functions
    - Create utility functions for data handling
    - Set up proper triggers

  2. Security
    - Enable RLS on all tables
    - Create proper policies for data access
    - Set up user permissions

  3. Performance
    - Add necessary indexes
    - Create helper functions for data retrieval
*/

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

-- Create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NOW(),
    NOW()
  );

  -- Create user usage record
  INSERT INTO public.user_usage (user_id, plan_id, created_at, updated_at)
  VALUES (NEW.id, 'free', NOW(), NOW());

  -- Create user subscription record
  INSERT INTO public.user_subscriptions (user_id, plan_id, created_at, updated_at)
  VALUES (NEW.id, 'free', NOW(), NOW());

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for new user creation (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

-- Function to initialize user pricing data
CREATE OR REPLACE FUNCTION public.initialize_user_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function is called when a user profile is created
  -- Ensure usage and subscription records exist
  INSERT INTO public.user_usage (user_id, plan_id, created_at, updated_at)
  VALUES (NEW.id, 'free', NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_subscriptions (user_id, plan_id, created_at, updated_at)
  VALUES (NEW.id, 'free', NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure all RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

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

-- Fix RLS policies for conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;

CREATE POLICY "Users can view own conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix RLS policies for messages
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can manage own messages" ON messages;

CREATE POLICY "Users can view own messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.user_id = auth.uid()
  ));

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
CREATE INDEX IF NOT EXISTS idx_user_usage_user_plan ON user_usage(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions(user_id, status);

-- Function to get user agents with proper data
CREATE OR REPLACE FUNCTION public.get_user_agents(p_user_id uuid)
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

-- Function to get user profile with usage data
CREATE OR REPLACE FUNCTION public.get_user_profile_with_usage(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  timezone text,
  preferences jsonb,
  subscription_plan text,
  usage_stats jsonb,
  call_time_used integer,
  agents_created integer,
  integrations_active integer,
  storage_used bigint,
  chat_tokens_used bigint,
  created_at timestamptz,
  updated_at timestamptz
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
    COALESCE(uu.call_time_used, 0),
    COALESCE(uu.agents_created, 0),
    COALESCE(uu.integrations_active, 0),
    COALESCE(uu.storage_used, 0),
    COALESCE(uu.chat_tokens_used, 0),
    up.created_at,
    up.updated_at
  FROM user_profiles up
  LEFT JOIN user_usage uu ON up.id = uu.user_id
  WHERE up.id = p_user_id;
$$;

-- Grant necessary permissions on public schema only
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Ensure updated_at triggers exist
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_agents_updated_at ON user_agents;
CREATE TRIGGER update_user_agents_updated_at
  BEFORE UPDATE ON user_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_usage_updated_at ON user_usage;
CREATE TRIGGER update_user_usage_updated_at
  BEFORE UPDATE ON user_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure usage tracking triggers exist
DROP TRIGGER IF EXISTS update_agent_usage_trigger ON messages;
CREATE TRIGGER update_agent_usage_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_usage_stats();

DROP TRIGGER IF EXISTS update_conversation_metrics_trigger ON messages;
CREATE TRIGGER update_conversation_metrics_trigger
  AFTER INSERT OR DELETE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_metrics();