import { useState, useEffect } from 'react';
import { UserUsage, UsageAlert } from '../types/pricing';
import { usageService } from '../services/usageService';
import { useAuth } from '../../auth/hooks/useAuth';

export function useUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUsage();
    }
  }, [user]);

  const loadUsage = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userUsage = await usageService.getUserUsage(user.id);
      const usageAlerts = await usageService.checkUsageLimits(user.id);
      
      setUsage(userUsage);
      setAlerts(usageAlerts);
    } catch (error) {
      console.error('Error loading usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const incrementUsage = async (
    type: 'callTime' | 'agents' | 'integrations' | 'storage' | 'chatTokens',
    amount: number
  ) => {
    if (!user) return;

    try {
      await usageService.incrementUsage(user.id, type, amount);
      await loadUsage(); // Refresh usage data
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  };

  const canPerformAction = async (
    action: 'createAgent' | 'startCall' | 'sendMessage' | 'uploadFile'
  ) => {
    if (!user) return { allowed: false, reason: 'Not authenticated' };

    try {
      return await usageService.canPerformAction(user.id, action);
    } catch (error) {
      console.error('Error checking action permission:', error);
      return { allowed: false, reason: 'Error checking permissions' };
    }
  };

  const updatePlan = async (planId: string) => {
    if (!user || !usage) return;

    try {
      const billingCycle = planId === 'free' ? 'weekly' : 'daily';
      await usageService.updateUsage(user.id, { 
        currentPlan: planId,
        billingCycle 
      });
      await loadUsage();
    } catch (error) {
      console.error('Error updating plan:', error);
    }
  };

  return {
    usage,
    alerts,
    loading,
    incrementUsage,
    canPerformAction,
    updatePlan,
    refreshUsage: loadUsage
  };
}