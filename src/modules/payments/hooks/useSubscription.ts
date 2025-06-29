import { useState, useEffect } from 'react';
import { stripeClient, SubscriptionData } from '../stripe-client';

export interface SubscriptionStatus {
  isLoading: boolean;
  isActive: boolean;
  subscription: SubscriptionData | null;
  plan: string;
  error: string | null;
}

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isLoading: true,
    isActive: false,
    subscription: null,
    plan: 'free',
    error: null
  });

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        console.log('Fetching subscription status');
        const subscription = await stripeClient.getUserSubscription();
        
        const isActive = subscription?.subscription_status === 'active' || 
                         subscription?.subscription_status === 'trialing';
        
        // Determine plan based on price_id
        let plan = 'free';
        if (subscription?.price_id) {
          switch (subscription.price_id) {
            case 'price_standard':
              plan = 'standard';
              break;
            case 'price_premium':
              plan = 'premium';
              break;
            case 'price_pro':
              plan = 'pro';
              break;
          }
        }
        
        setStatus({
          isLoading: false,
          isActive,
          subscription,
          plan,
          error: null
        });
        
        console.log('Subscription status:', { isActive, plan });
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setStatus({
          isLoading: false,
          isActive: false,
          subscription: null,
          plan: 'free',
          error: error instanceof Error ? error.message : 'Failed to fetch subscription'
        });
      }
    };

    fetchSubscription();
  }, []);

  return status;
}