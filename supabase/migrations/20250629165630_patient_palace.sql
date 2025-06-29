/*
  # Stripe Integration Tables

  1. New Tables
    - `stripe_customers` - Maps users to Stripe customers
    - `stripe_subscriptions` - Stores subscription data
    - `stripe_orders` - Stores one-time payment data
  
  2. New Views
    - `stripe_user_subscriptions` - User-friendly view of subscription data
    - `stripe_user_orders` - User-friendly view of order data
  
  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create enum types for subscription and order status
CREATE TYPE stripe_subscription_status AS ENUM (
  'trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 
  'past_due', 'unpaid', 'paused', 'not_started'
);

CREATE TYPE stripe_order_status AS ENUM (
  'pending', 'processing', 'completed', 'canceled', 'refunded', 'failed'
);

-- Create stripe_customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

-- Create stripe_subscriptions table
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL REFERENCES stripe_customers(customer_id) ON DELETE CASCADE,
  subscription_id text UNIQUE,
  price_id text,
  current_period_start bigint,
  current_period_end bigint,
  cancel_at_period_end boolean DEFAULT false,
  payment_method_brand text,
  payment_method_last4 text,
  status stripe_subscription_status DEFAULT 'not_started',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stripe_orders table
CREATE TABLE IF NOT EXISTS stripe_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL REFERENCES stripe_customers(customer_id) ON DELETE CASCADE,
  checkout_session_id text UNIQUE,
  payment_intent_id text,
  amount_subtotal integer,
  amount_total integer,
  currency text,
  payment_status text,
  status stripe_order_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create view for user subscriptions
CREATE OR REPLACE VIEW stripe_user_subscriptions AS
SELECT
  u.id as user_id,
  c.customer_id,
  s.subscription_id,
  s.status as subscription_status,
  s.price_id,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.payment_method_brand,
  s.payment_method_last4
FROM
  auth.users u
  JOIN stripe_customers c ON u.id = c.user_id
  LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE
  c.deleted_at IS NULL;

-- Create view for user orders
CREATE OR REPLACE VIEW stripe_user_orders AS
SELECT
  u.id as user_id,
  c.customer_id,
  o.id as order_id,
  o.checkout_session_id,
  o.payment_intent_id,
  o.amount_total,
  o.currency,
  o.payment_status,
  o.status as order_status,
  o.created_at
FROM
  auth.users u
  JOIN stripe_customers c ON u.id = c.user_id
  LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE
  c.deleted_at IS NULL;

-- Enable RLS on all tables
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Customers table policies
CREATE POLICY "Users can view their own customer data"
  ON stripe_customers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Subscriptions table policies
CREATE POLICY "Users can view their own subscriptions"
  ON stripe_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

-- Orders table policies
CREATE POLICY "Users can view their own orders"
  ON stripe_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_orders.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stripe_customers_updated_at
BEFORE UPDATE ON stripe_customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_subscriptions_updated_at
BEFORE UPDATE ON stripe_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_orders_updated_at
BEFORE UPDATE ON stripe_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX idx_stripe_subscriptions_customer_id ON stripe_subscriptions(customer_id);
CREATE INDEX idx_stripe_orders_customer_id ON stripe_orders(customer_id);