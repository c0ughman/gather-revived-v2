import { useState, useEffect } from 'react';
import { stripeClient, SubscriptionData } from '../stripe-client';
import { supabase } from '../../database/lib/supabase';

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
        // First try to get subscription from Stripe data
        const subscription = await stripeClient.getUserSubscription();
        const isActive = subscription?.subscription_status === 'active' || 
                         subscription?.subscription_status === 'trialing';
        
        // Determine plan based on price_id
        let plan = 'free';
        if (subscription?.price_id) {
          switch (subscription.price_id) {
            case 'price_1RfLCZCHpOkAgMGGUtW046jz':
              plan = 'standard';
              break;
            case 'price_1RfLEACHpOkAgMGGl3yIkLiX':
              plan = 'premium';
              break;
            case 'price_1RfLFJCHpOkAgMGGtGJlOf2I':
              plan = 'pro';
              break;
          }
        }
        
        // If no subscription from Stripe, check user profile
        if (!subscription) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('plan, subscription_tier, subscription_plan')
            .single();
            
          if (profile) {
            // Use the most specific plan field available
            plan = profile.plan || profile.subscription_plan || profile.subscription_tier || 'free';
          }
        }
        
        setStatus({
          isLoading: false,
          isActive,
          subscription,
          plan,
          error: null
        });
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