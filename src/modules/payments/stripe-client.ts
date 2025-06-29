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
   * Get current user's subscription data from user_profiles.preferences
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

      // Get subscription from user_profiles.preferences
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return null;
      }

      if (profileData?.preferences?.subscription) {
        console.log('Found subscription in user profile:', profileData.preferences.subscription);
        return profileData.preferences.subscription;
      }

      // If no subscription found, return default
      const defaultSubscription = {
        user_id: user.id,
        customer_id: null,
        subscription_id: null,
        subscription_status: 'not_started',
        price_id: null,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        payment_method_brand: null,
        payment_method_last4: null
      };
      
      return defaultSubscription;
    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      return null;
    }
  },

  /**
   * Check if user has an active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        return false;
      }

      // Get plan directly from user_profiles.preferences
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return false;
      }

      // Check if subscription is active
      const subscription = profile?.preferences?.subscription;
      if (subscription) {
        return subscription.subscription_status === 'active' || 
               subscription.subscription_status === 'trialing';
      }

      return false;
    } catch (error) {
      console.error('Error in hasActiveSubscription:', error);
      return false;
    }
  },

  /**
   * Get the user's current plan based on user_profiles.preferences
   */
  async getCurrentPlan(): Promise<string> {
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        return 'free';
      }
      
      // Get plan directly from user_profiles.preferences
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return 'free';
      }
      
      // Return the plan from preferences, or default to free
      return profile?.preferences?.plan || 'free';
    } catch (error) {
      console.error('Error in getCurrentPlan:', error);
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