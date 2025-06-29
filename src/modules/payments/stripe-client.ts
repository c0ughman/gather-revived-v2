import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface CheckoutOptions {
  priceId: string;
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResponse {
  sessionId: string;
  url: string;
}

export interface SubscriptionData {
  customer_id: string;
  subscription_id: string | null;
  subscription_status: string;
  price_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

export const stripeClient = {
  /**
   * Create a Stripe checkout session
   */
  async createCheckoutSession(options: CheckoutOptions): Promise<CheckoutResponse> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      throw new Error('You must be logged in to make a purchase');
    }

    console.log('Creating checkout session with access token');
    
    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        price_id: options.priceId,
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        mode: options.mode,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Checkout error:', response.status, errorText);
      throw new Error(errorText || 'Failed to create checkout session');
    }

    return await response.json();
  },

  /**
   * Redirect to Stripe Checkout
   */
  async redirectToCheckout(options: CheckoutOptions): Promise<void> {
    try {
      const { url } = await this.createCheckoutSession(options);
      window.location.href = url;
    } catch (error) {
      console.error('Error redirecting to checkout:', error);
      throw error;
    }
  },

  /**
   * Get current user's subscription data
   */
  async getUserSubscription(): Promise<SubscriptionData | null> {
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        return null;
      }

      console.log(`Fetching subscription for user: ${user.id}`);

      // Query the view with user_id filter to ensure we only get the current user's subscription
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      throw error;
    }
  },

  /**
   * Check if user has an active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    const subscription = await this.getUserSubscription();
    return subscription?.subscription_status === 'active' || subscription?.subscription_status === 'trialing';
  },

  /**
   * Get the user's current plan based on subscription
   */
  async getCurrentPlan(): Promise<string> {
    const subscription = await this.getUserSubscription();
    
    if (!subscription || !subscription.subscription_id) {
      return 'free';
    }
    
    if (subscription.subscription_status !== 'active' && subscription.subscription_status !== 'trialing') {
      return 'free';
    }
    
    // Map price_id to plan name
    switch (subscription.price_id) {
      case 'price_1RfLCZCHpOkAgMGGUtW046jz':
        return 'standard';
      case 'price_1RfLEACHpOkAgMGGl3yIkLiX':
        return 'premium';
      case 'price_1RfLFJCHpOkAgMGGtGJlOf2I':
        return 'pro';
      default:
        return 'free';
    }
  },

  /**
   * Create a portal session for managing subscription
   */
  async createPortalSession(): Promise<string> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      throw new Error('You must be logged in to access the customer portal');
    }

    console.log('Creating portal session with access token');
    
    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Portal error:', response.status, errorText);
      throw new Error(errorText || 'Failed to create portal session');
    }

    const { url } = await response.json();
    return url;
  }
};