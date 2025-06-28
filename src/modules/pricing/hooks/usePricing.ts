import { useState } from 'react';
import { stripeService } from '../services/stripeService';
import { useUsage } from './useUsage';

export function usePricing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updatePlan } = useUsage();

  const selectPlan = async (planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') => {
    try {
      setLoading(true);
      setError(null);

      if (planId === 'free') {
        await updatePlan('free');
        return { success: true };
      }

      // For development, use mock checkout
      const isDevelopment = import.meta.env.DEV;
      
      if (isDevelopment) {
        const { url } = await stripeService.mockCheckoutSession(planId);
        window.location.href = url;
        return { success: true };
      } else {
        // Production Stripe checkout
        const { url } = await stripeService.createCheckoutSession(planId, 'user-id', billingCycle);
        window.location.href = url;
        return { success: true };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const openBillingPortal = async () => {
    try {
      setLoading(true);
      setError(null);

      const { url } = await stripeService.createPortalSession('customer-id');
      window.location.href = url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    selectPlan,
    openBillingPortal,
    loading,
    error,
    clearError: () => setError(null)
  };
}