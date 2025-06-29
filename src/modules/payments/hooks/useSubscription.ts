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
        console.log('Fetching subscription status');
        
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('Error getting user:', userError);
          setStatus({
            isLoading: false,
            isActive: false,
            subscription: null,
            plan: 'free',
            error: null
          });
          return;
        }
        
        // Get subscription info directly from user_profiles.preferences
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('preferences')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          setStatus({
            isLoading: false,
            isActive: false,
            subscription: null,
            plan: 'free',
            error: profileError.message
          });
          return;
        }
        
        // Get subscription and plan from preferences
        const subscription = profile?.preferences?.subscription;
        const plan = profile?.preferences?.plan || 'free';
        
        // Determine if subscription is active
        const isActive = subscription?.subscription_status === 'active' || 
                         subscription?.subscription_status === 'trialing';
        
        setStatus({
          isLoading: false,
          isActive,
          subscription: subscription || null,
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