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
    // Try to get session
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (!session || error) {
      // Fallback: force refresh
      const {
        data: refreshedSession,
        error: refreshError
      } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession.session) {
        console.error('Unable to get valid session', refreshError);
        throw new Error('You must be logged in to make a purchase');
      }

      return await this._postCheckout(refreshedSession.session.access_token, options);
    }

    return await this._postCheckout(session.access_token, options);
  },

  /**
   * Private helper to send fetch to the Edge Function
   */
  async _postCheckout(token: string, options: CheckoutOptions): Promise<CheckoutResponse> {
    console.log('[Access Token]', token); // Debug: ensure token is valid

    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        price_id: options.priceId,
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        mode: options.mode
      })
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create checkout session';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse error JSON', e);
        errorMessage = await response.text();
      }

      console.error('[Stripe Checkout Error]', errorMessage);
      throw new Error(errorMessage);
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
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
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
    return (
      subscription?.subscription_status === 'active' ||
      subscription?.subscription_status === 'trialing'
    );
  },

  /**
   * Get the user's current plan based on subscription
   */
  async getCurrentPlan(): Promise<string> {
    const subscription = await this.getUserSubscription();

    if (!subscription || !subscription.subscription_id) return 'free';

    if (
      subscription.subscription_status !== 'active' &&
      subscription.subscription_status !== 'trialing'
    ) {
      return 'free';
    }

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
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (!session || error) {
      const {
        data: refreshedSession,
        error: refreshError
      } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession.session) {
        throw new Error('You must be logged in to access the customer portal');
      }

      return await this._postPortal(refreshedSession.session.access_token);
    }

    return await this._postPortal(session.access_token);
  },

  async _postPortal(token: string): Promise<string> {
    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create portal session');
    }

    const { url } = await response.json();
    return url;
  }
};
