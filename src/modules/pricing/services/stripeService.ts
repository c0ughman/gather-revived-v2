// Stripe service for handling payments and subscriptions
export class StripeService {
  private static instance: StripeService;
  
  static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  async createCheckoutSession(planId: string, userId: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<{ url: string }> {
    try {
      // In a real implementation, this would call your backend API
      // which would create a Stripe checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          userId,
          billingCycle,
          successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/pricing`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      return { url: data.url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to initiate payment. Please try again.');
    }
  }

  async createPortalSession(customerId: string): Promise<{ url: string }> {
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          returnUrl: window.location.origin
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const data = await response.json();
      return { url: data.url };
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw new Error('Failed to access billing portal. Please try again.');
    }
  }

  async getSubscriptionStatus(userId: string): Promise<any> {
    try {
      const response = await fetch(`/api/stripe/subscription-status/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to get subscription status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return null;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/stripe/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId })
      });

      return response.ok;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return false;
    }
  }

  // Mock implementation for development
  async mockCheckoutSession(planId: string): Promise<{ url: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For development, redirect to success page with mock session
    const mockSessionId = `cs_mock_${Date.now()}`;
    return { 
      url: `${window.location.origin}/success?session_id=${mockSessionId}&plan=${planId}` 
    };
  }
}

export const stripeService = StripeService.getInstance();