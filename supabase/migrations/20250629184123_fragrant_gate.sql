-- Create user_usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT DEFAULT 'free',
  call_time_used INTEGER DEFAULT 0,
  agents_created INTEGER DEFAULT 0,
  integrations_active INTEGER DEFAULT 0,
  storage_used BIGINT DEFAULT 0,
  chat_tokens_used BIGINT DEFAULT 0,
  billing_cycle TEXT DEFAULT 'weekly',
  last_reset_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_plan_id ON user_usage(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_plan ON user_usage(user_id, plan_id);

-- Create RLS policies for user_usage table
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Check if policies exist before creating them
DO $$
BEGIN
  -- Check and create "Users can view own usage" policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_usage' AND policyname = 'Users can view own usage'
  ) THEN
    CREATE POLICY "Users can view own usage" 
    ON user_usage FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);
  END IF;

  -- Check and create "Users can insert own usage" policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_usage' AND policyname = 'Users can insert own usage'
  ) THEN
    CREATE POLICY "Users can insert own usage" 
    ON user_usage FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check and create "Users can update own usage" policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_usage' AND policyname = 'Users can update own usage'
  ) THEN
    CREATE POLICY "Users can update own usage" 
    ON user_usage FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Create function to increment values
CREATE OR REPLACE FUNCTION increment(row_id UUID, column_name TEXT, increment_amount BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  current_value BIGINT;
  new_value BIGINT;
BEGIN
  EXECUTE format('SELECT %I FROM user_usage WHERE user_id = $1', column_name)
  INTO current_value
  USING row_id;
  
  new_value := COALESCE(current_value, 0) + increment_amount;
  
  EXECUTE format('UPDATE user_usage SET %I = $1, updated_at = now() WHERE user_id = $2', column_name)
  USING new_value, row_id;
  
  RETURN new_value;
END;
$$;

-- Create function to initialize user usage on signup
CREATE OR REPLACE FUNCTION initialize_user_usage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_usage (
    user_id,
    plan_id,
    call_time_used,
    agents_created,
    integrations_active,
    storage_used,
    chat_tokens_used,
    billing_cycle,
    last_reset_date
  ) VALUES (
    NEW.id,
    'free',
    0,
    0,
    0,
    0,
    0,
    'weekly',
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to initialize user usage on signup
DROP TRIGGER IF EXISTS on_auth_user_created_usage ON auth.users;

CREATE TRIGGER on_auth_user_created_usage
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_usage();

-- Create function to update usage stats when agents are created/deleted
CREATE OR REPLACE FUNCTION update_agent_usage_stats()
RETURNS TRIGGER AS $$
DECLARE
  agent_count INTEGER;
BEGIN
  -- Count agents for this user
  SELECT COUNT(*) INTO agent_count
  FROM user_agents
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  
  -- Update user_usage with the count
  UPDATE user_usage
  SET 
    agents_created = agent_count,
    updated_at = now()
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update agent count when agents are created/deleted
DROP TRIGGER IF EXISTS update_agent_usage_trigger ON user_agents;

CREATE TRIGGER update_agent_usage_trigger
AFTER INSERT OR DELETE ON user_agents
FOR EACH ROW
EXECUTE FUNCTION update_agent_usage_stats();

-- Create function to update usage stats when integrations are created/deleted
CREATE OR REPLACE FUNCTION update_integration_usage_stats()
RETURNS TRIGGER AS $$
DECLARE
  integration_count INTEGER;
  agent_user_id UUID;
BEGIN
  -- Get user_id from agent
  SELECT user_id INTO agent_user_id
  FROM user_agents
  WHERE id = COALESCE(NEW.agent_id, OLD.agent_id);
  
  -- Count integrations for this user
  SELECT COUNT(*) INTO integration_count
  FROM agent_integrations ai
  JOIN user_agents ua ON ai.agent_id = ua.id
  WHERE ua.user_id = agent_user_id;
  
  -- Update user_usage with the count
  UPDATE user_usage
  SET 
    integrations_active = integration_count,
    updated_at = now()
  WHERE user_id = agent_user_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update integration count when integrations are created/deleted
DROP TRIGGER IF EXISTS update_integration_usage_trigger ON agent_integrations;

CREATE TRIGGER update_integration_usage_trigger
AFTER INSERT OR DELETE ON agent_integrations
FOR EACH ROW
EXECUTE FUNCTION update_integration_usage_stats();

-- Create function to update storage usage when documents are created/deleted
CREATE OR REPLACE FUNCTION update_storage_usage_stats()
RETURNS TRIGGER AS $$
DECLARE
  storage_used BIGINT;
  agent_user_id UUID;
BEGIN
  -- Get user_id from agent
  SELECT user_id INTO agent_user_id
  FROM user_agents
  WHERE id = COALESCE(NEW.agent_id, OLD.agent_id);
  
  -- Calculate total storage used
  SELECT COALESCE(SUM(file_size), 0) INTO storage_used
  FROM agent_documents ad
  JOIN user_agents ua ON ad.agent_id = ua.id
  WHERE ua.user_id = agent_user_id;
  
  -- Convert bytes to MB
  storage_used := storage_used / (1024 * 1024);
  
  -- Update user_usage with the storage used
  UPDATE user_usage
  SET 
    storage_used = storage_used,
    updated_at = now()
  WHERE user_id = agent_user_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update storage usage when documents are created/deleted
DROP TRIGGER IF EXISTS update_storage_usage_trigger ON agent_documents;

CREATE TRIGGER update_storage_usage_trigger
AFTER INSERT OR DELETE ON agent_documents
FOR EACH ROW
EXECUTE FUNCTION update_storage_usage_stats();

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at column
DROP TRIGGER IF EXISTS update_user_usage_updated_at ON user_usage;

CREATE TRIGGER update_user_usage_updated_at
BEFORE UPDATE ON user_usage
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add constraint for billing_cycle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_usage_billing_cycle_check'
  ) THEN
    ALTER TABLE user_usage 
    ADD CONSTRAINT user_usage_billing_cycle_check 
    CHECK (billing_cycle = ANY (ARRAY['weekly', 'daily', 'monthly']));
  END IF;
END
$$;