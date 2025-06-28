/*
  # Pricing and Usage Tables

  1. New Tables
    - `user_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `plan_id` (text)
      - `stripe_subscription_id` (text, nullable)
      - `stripe_customer_id` (text, nullable)
      - `status` (text)
      - `current_period_start` (timestamptz)
      - `current_period_end` (timestamptz)
      - `trial_end` (timestamptz, nullable)
      - `cancel_at_period_end` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `user_usage`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `plan_id` (text)
      - `call_time_used` (integer) - in minutes
      - `agents_created` (integer)
      - `integrations_active` (integer)
      - `storage_used` (bigint) - in bytes
      - `chat_tokens_used` (bigint)
      - `billing_cycle` (text) - 'weekly', 'daily', 'monthly'
      - `last_reset_date` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own data
*/

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'free',
  stripe_subscription_id text,
  stripe_customer_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Usage Table
CREATE TABLE IF NOT EXISTS user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'free',
  call_time_used integer DEFAULT 0,
  agents_created integer DEFAULT 0,
  integrations_active integer DEFAULT 0,
  storage_used bigint DEFAULT 0,
  chat_tokens_used bigint DEFAULT 0,
  billing_cycle text DEFAULT 'weekly' CHECK (billing_cycle IN ('weekly', 'daily', 'monthly')),
  last_reset_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_plan_id ON user_usage(plan_id);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (uid() = user_id);

-- RLS Policies for user_usage
CREATE POLICY "Users can view own usage"
  ON user_usage
  FOR SELECT
  TO authenticated
  USING (uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON user_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON user_usage
  FOR UPDATE
  TO authenticated
  USING (uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_usage_updated_at
  BEFORE UPDATE ON user_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize user usage when they sign up
CREATE OR REPLACE FUNCTION initialize_user_usage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_usage (user_id, plan_id)
  VALUES (NEW.id, 'free');
  
  INSERT INTO user_subscriptions (user_id, plan_id)
  VALUES (NEW.id, 'free');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to initialize usage for new users
CREATE TRIGGER initialize_user_usage_trigger
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_usage();