-- Check if enum types exist before creating them
DO $$
BEGIN
  -- Create enum types for subscription and order status if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_subscription_status') THEN
    CREATE TYPE stripe_subscription_status AS ENUM (
      'not_started',
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_order_status') THEN
    CREATE TYPE stripe_order_status AS ENUM (
      'pending',
      'completed',
      'canceled'
    );
  END IF;
END
$$;

-- Create customers table
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  subscription_id TEXT,
  price_id TEXT,
  current_period_start BIGINT,
  current_period_end BIGINT,
  cancel_at_period_end BOOLEAN DEFAULT false,
  payment_method_brand TEXT,
  payment_method_last4 TEXT,
  status stripe_subscription_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.stripe_orders (
  id BIGSERIAL PRIMARY KEY,
  checkout_session_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount_subtotal BIGINT NOT NULL,
  amount_total BIGINT NOT NULL,
  currency TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  status stripe_order_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Create view for user subscriptions
CREATE OR REPLACE VIEW public.stripe_user_subscriptions AS
SELECT 
  sc.customer_id,
  ss.subscription_id,
  ss.status as subscription_status,
  ss.price_id,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at_period_end,
  ss.payment_method_brand,
  ss.payment_method_last4
FROM 
  public.stripe_customers sc
JOIN 
  public.stripe_subscriptions ss ON sc.customer_id = ss.customer_id
WHERE 
  sc.deleted_at IS NULL
  AND ss.deleted_at IS NULL;

-- Add comment to subscription view
COMMENT ON VIEW public.stripe_user_subscriptions IS 'Security definer view for user subscriptions';

-- Create view for user orders
CREATE OR REPLACE VIEW public.stripe_user_orders AS
SELECT 
  sc.customer_id,
  so.id as order_id,
  so.checkout_session_id,
  so.payment_intent_id,
  so.amount_subtotal,
  so.amount_total,
  so.currency,
  so.payment_status,
  so.status as order_status,
  so.created_at as order_date
FROM 
  public.stripe_customers sc
JOIN 
  public.stripe_orders so ON sc.customer_id = so.customer_id
WHERE 
  sc.deleted_at IS NULL
  AND so.deleted_at IS NULL;

-- Add comment to orders view
COMMENT ON VIEW public.stripe_user_orders IS 'Security definer view for user orders';

-- Enable RLS on all tables
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own customer data" ON public.stripe_customers
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()) AND (deleted_at IS NULL));

CREATE POLICY "Users can view their own subscription data" ON public.stripe_subscriptions
  FOR SELECT
  TO authenticated
  USING ((customer_id IN (
    SELECT customer_id FROM public.stripe_customers 
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )) AND (deleted_at IS NULL));

CREATE POLICY "Users can view their own order data" ON public.stripe_orders
  FOR SELECT
  TO authenticated
  USING ((customer_id IN (
    SELECT customer_id FROM public.stripe_customers 
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )) AND (deleted_at IS NULL));

-- Create function to handle subscription changes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_subscription_change') THEN
    EXECUTE '
    CREATE FUNCTION public.handle_subscription_change()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Update user profile when subscription changes
      UPDATE public.user_profiles
      SET 
        subscription_plan = 
          CASE 
            WHEN NEW.status = ''active'' OR NEW.status = ''trialing'' THEN
              CASE 
                WHEN NEW.price_id = ''price_1RfLCZCHpOkAgMGGUtW046jz'' THEN ''standard''
                WHEN NEW.price_id = ''price_1RfLEACHpOkAgMGGl3yIkLiX'' THEN ''premium''
                WHEN NEW.price_id = ''price_1RfLFJCHpOkAgMGGtGJlOf2I'' THEN ''pro''
                ELSE ''free''
              END
            ELSE ''free''
          END,
        updated_at = now()
      FROM public.stripe_customers
      WHERE 
        stripe_customers.customer_id = NEW.customer_id AND
        user_profiles.id = stripe_customers.user_id;
        
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
    ';
  END IF;
END
$$;

-- Create trigger for subscription changes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_subscription_change_trigger') THEN
    CREATE TRIGGER handle_subscription_change_trigger
    AFTER INSERT OR UPDATE ON public.stripe_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_subscription_change();
  END IF;
END
$$;

-- Create function to update updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE '
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
    ';
  END IF;
END
$$;

-- Create triggers for updated_at if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stripe_customers_updated_at') THEN
    CREATE TRIGGER update_stripe_customers_updated_at
    BEFORE UPDATE ON public.stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stripe_subscriptions_updated_at') THEN
    CREATE TRIGGER update_stripe_subscriptions_updated_at
    BEFORE UPDATE ON public.stripe_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stripe_orders_updated_at') THEN
    CREATE TRIGGER update_stripe_orders_updated_at
    BEFORE UPDATE ON public.stripe_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;