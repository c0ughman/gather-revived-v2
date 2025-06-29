import { useState, useEffect } from 'react';
import { supabase } from '../../database/lib/supabase';
import { useAuth } from '../../auth/hooks/useAuth';
import { useSubscription } from '../../payments/hooks/useSubscription';
import { CallTimeLimit, PLAN_LIMITS } from '../types/voice';

export function useCallTimeLimit() {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const [callTimeLimit, setCallTimeLimit] = useState<CallTimeLimit>({
    limit: 0,
    used: 0,
    remaining: 0,
    isLimitReached: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallTimeUsage = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get user's usage data
        const { data: usageData, error: usageError } = await supabase
          .from('user_usage')
          .select('call_time_used, plan_id, last_reset_date')
          .eq('user_id', user.id)
          .single();

        if (usageError) {
          console.error('Error fetching call time usage:', usageError);
          setError('Failed to fetch call time usage');
          setIsLoading(false);
          return;
        }

        // If no usage data, create it
        if (!usageData) {
          const { error: insertError } = await supabase
            .from('user_usage')
            .insert({
              user_id: user.id,
              plan_id: plan || 'free',
              call_time_used: 0,
              last_reset_date: new Date().toISOString()
            });

          if (insertError) {
            console.error('Error creating usage record:', insertError);
            setError('Failed to create usage record');
            setIsLoading(false);
            return;
          }

          setCallTimeLimit({
            limit: PLAN_LIMITS[plan || 'free'].callTime.daily,
            used: 0,
            remaining: PLAN_LIMITS[plan || 'free'].callTime.daily,
            isLimitReached: false
          });
          setIsLoading(false);
          return;
        }

        // Get the plan limits
        const userPlan = plan || usageData.plan_id || 'free';
        const planLimits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
        
        // Check if we need to reset the counter (daily reset)
        const lastResetDate = new Date(usageData.last_reset_date);
        const now = new Date();
        const daysSinceReset = Math.floor((now.getTime() - lastResetDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let callTimeUsed = usageData.call_time_used || 0;
        
        // Reset counter if it's a new day
        if (daysSinceReset >= 1) {
          // Update the last reset date and reset the counter
          const { error: resetError } = await supabase
            .from('user_usage')
            .update({
              call_time_used: 0,
              last_reset_date: now.toISOString()
            })
            .eq('user_id', user.id);
            
          if (resetError) {
            console.error('Error resetting call time usage:', resetError);
          } else {
            callTimeUsed = 0;
          }
        }
        
        // Calculate remaining time
        const dailyLimit = planLimits.callTime.daily;
        const remaining = Math.max(0, dailyLimit - callTimeUsed);
        const isLimitReached = remaining <= 0;
        
        setCallTimeLimit({
          limit: dailyLimit,
          used: callTimeUsed,
          remaining,
          isLimitReached
        });
        
      } catch (error) {
        console.error('Error in useCallTimeLimit:', error);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCallTimeUsage();
  }, [user, plan]);

  const updateCallTimeUsed = async (seconds: number) => {
    if (!user) return;
    
    try {
      // Get current usage
      const { data: currentUsage, error: usageError } = await supabase
        .from('user_usage')
        .select('call_time_used')
        .eq('user_id', user.id)
        .single();
        
      if (usageError) {
        console.error('Error fetching current call time usage:', usageError);
        return;
      }
      
      const newUsage = (currentUsage?.call_time_used || 0) + seconds;
      
      // Update usage in database
      const { error: updateError } = await supabase
        .from('user_usage')
        .update({
          call_time_used: newUsage,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
        
      if (updateError) {
        console.error('Error updating call time usage:', updateError);
        return;
      }
      
      // Update local state
      const userPlan = plan || 'free';
      const planLimits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
      const dailyLimit = planLimits.callTime.daily;
      const remaining = Math.max(0, dailyLimit - newUsage);
      
      setCallTimeLimit({
        limit: dailyLimit,
        used: newUsage,
        remaining,
        isLimitReached: remaining <= 0
      });
      
    } catch (error) {
      console.error('Error updating call time usage:', error);
    }
  };

  return {
    callTimeLimit,
    isLoading,
    error,
    updateCallTimeUsed
  };
}