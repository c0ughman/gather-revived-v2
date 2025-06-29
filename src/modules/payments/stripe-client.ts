import { createClient } from '@supabase/supabase-js';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

if (!stripePublicKey) {
  console.warn('Missing Stripe public key. Payments will not work.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Stripe
let stripePromise: Promise<any> | null = null;

const getStripe = () => {
  if (!stripePromise && stripePublicKey) {
    stripePromise = loadStripe(stripePublicKey);
  }
  return stripePromise;
};

export interface CheckoutOptions {
  priceId: string;
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
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
  async redirectToCheckout(options: CheckoutOptions): Promise<void> {
    try {
      console.log('Creating checkout session for price:', options.priceId);
      
      // Get the current user session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        console.error('Authentication error:', sessionError);
        throw new Error('You must be logged in to make a purchase');
      }

      // Create a checkout session via Supabase Edge Function
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
        const errorData = await response.json();
        console.error('Checkout session creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      if (!url) {
        throw new Error('No checkout URL returned from server');
      }

      console.log('Redirecting to Stripe checkout:', url);
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
      console.log('Fetching user subscription data');
      
      const { data, error } = await supabase
        .from('stripe_subscriptions_view')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      return null;
    }
  },

  /**
   * Check if user has an active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    const subscription = await this.getUserSubscription();
    return subscription?.subscription_status === 'active' || 
           subscription?.subscription_status === 'trialing';
  },

  /**
   * Get the user's current plan based on subscription
   */
  async getCurrentPlan(): Promise<string> {
    const subscription = await this.getUserSubscription();
    
    if (!subscription || !subscription.subscription_id) {
      return 'free';
    }
    
    if (subscription.subscription_status !== 'active' && 
        subscription.subscription_status !== 'trialing') {
      return 'free';
    }
    
    // Map price_id to plan name
    switch (subscription.price_id) {
      case 'price_standard':
        return 'standard';
      case 'price_premium':
        return 'premium';
      case 'price_pro':
        return 'pro';
      default:
        return 'free';
    }
  },

  /**
   * Create a portal session for managing subscription
   */
  async createPortalSession(): Promise<string> {
    try {
      console.log('Creating customer portal session');
      
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        console.error('Authentication error:', sessionError);
        throw new Error('You must be logged in to access the customer portal');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Portal session creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const { url } = await response.json();
      
      if (!url) {
        throw new Error('No portal URL returned from server');
      }

      console.log('Redirecting to customer portal:', url);
      return url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }
};