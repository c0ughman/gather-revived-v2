import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { usageService } from '../services/usageService';
import { PLAN_LIMITS, UsageStats, UsageLimits } from '../../../core/types/limits';
import { supabase } from '../../database/lib/supabase';

export interface LimitsState {
  isLoading: boolean;
  plan: string;
  limits: UsageLimits;
  usage: UsageStats | null;
  hasExceededCallTime: boolean;
  hasExceededChatTokens: boolean;
  hasExceededStorage: boolean;
  hasExceededAgents: boolean;
  hasExceededIntegrations: boolean;
  error: string | null;
}

export function useLimits() {
  const { user } = useAuth();
  const [state, setState] = useState<LimitsState>({
    isLoading: true,
    plan: 'free',
    limits: PLAN_LIMITS.free,
    usage: null,
    hasExceededCallTime: false,
    hasExceededChatTokens: false,
    hasExceededStorage: false,
    hasExceededAgents: false,
    hasExceededIntegrations: false,
    error: null
  });

  useEffect(() => {
    const fetchLimits = async () => {
      if (!user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Get user's plan from profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('preferences')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Failed to fetch user profile'
          }));
          return;
        }
        
        // Get plan from preferences
        const plan = profile?.preferences?.plan || 'free';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
        
        // Get usage stats
        const usage = await usageService.getUserUsage(user.id);
        
        if (!usage) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            plan,
            limits,
            error: 'Failed to fetch usage stats'
          }));
          return;
        }
        
        // Count agents and integrations
        const { data: agents, error: agentsError } = await supabase
          .from('user_agents')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id);
        
        if (agentsError) {
          console.error('Error counting agents:', agentsError);
        }
        
        const agentCount = agents?.length || 0;
        
        // Count integrations
        const { data: integrations, error: integrationsError } = await supabase
          .from('agent_integrations')
          .select('agent_id')
          .in('agent_id', 
            (await supabase.from('user_agents').select('id').eq('user_id', user.id)).data?.map(agent => agent.id) || []
          );
        
        if (integrationsError) {
          console.error('Error counting integrations:', integrationsError);
        }
        
        const integrationCount = integrations?.length || 0;
        
        // Update usage with current counts
        await usageService.updateAgentsCreated(user.id, agentCount);
        await usageService.updateIntegrationsActive(user.id, integrationCount);
        
        // Check if limits are exceeded
        const hasExceededCallTime = usage.callTimeUsedMinutes >= limits.callTimeMinutes;
        const hasExceededChatTokens = usage.chatTokensUsed >= Math.floor(limits.maxChatTokens / 30); // Daily limit
        const hasExceededStorage = usage.storageUsedMB >= limits.maxStorageMB;
        const hasExceededAgents = agentCount >= limits.maxAgents;
        const hasExceededIntegrations = integrationCount >= limits.maxIntegrations;
        
        setState({
          isLoading: false,
          plan,
          limits,
          usage: {
            ...usage,
            agentsCreated: agentCount,
            integrationsActive: integrationCount
          },
          hasExceededCallTime,
          hasExceededChatTokens,
          hasExceededStorage,
          hasExceededAgents,
          hasExceededIntegrations,
          error: null
        });
        
      } catch (error) {
        console.error('Error fetching limits:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to fetch usage limits'
        }));
      }
    };

    fetchLimits();
  }, [user]);

  // Function to update call time usage
  const updateCallTimeUsage = async (additionalMinutes: number) => {
    if (!user) return false;
    
    try {
      const success = await usageService.updateCallTimeUsage(user.id, additionalMinutes);
      
      if (success) {
        // Update local state
        setState(prev => {
          const newCallTimeUsed = (prev.usage?.callTimeUsedMinutes || 0) + additionalMinutes;
          const hasExceededCallTime = newCallTimeUsed >= prev.limits.callTimeMinutes;
          
          return {
            ...prev,
            usage: prev.usage ? {
              ...prev.usage,
              callTimeUsedMinutes: newCallTimeUsed
            } : null,
            hasExceededCallTime
          };
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error updating call time usage:', error);
      return false;
    }
  };

  // Function to update chat tokens usage
  const updateChatTokensUsage = async (additionalTokens: number) => {
    if (!user) return false;
    
    try {
      const success = await usageService.updateChatTokensUsage(user.id, additionalTokens);
      
      if (success) {
        // Update local state
        setState(prev => {
          const newTokensUsed = (prev.usage?.chatTokensUsed || 0) + additionalTokens;
          const dailyLimit = Math.floor(prev.limits.maxChatTokens / 30);
          const hasExceededChatTokens = newTokensUsed >= dailyLimit;
          
          return {
            ...prev,
            usage: prev.usage ? {
              ...prev.usage,
              chatTokensUsed: newTokensUsed
            } : null,
            hasExceededChatTokens
          };
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error updating chat tokens usage:', error);
      return false;
    }
  };

  // Function to update storage usage
  const updateStorageUsage = async (additionalStorageMB: number) => {
    if (!user) return false;
    
    try {
      const success = await usageService.updateStorageUsage(user.id, additionalStorageMB);
      
      if (success) {
        // Update local state
        setState(prev => {
          const newStorageUsed = (prev.usage?.storageUsedMB || 0) + additionalStorageMB;
          const hasExceededStorage = newStorageUsed >= prev.limits.maxStorageMB;
          
          return {
            ...prev,
            usage: prev.usage ? {
              ...prev.usage,
              storageUsedMB: newStorageUsed
            } : null,
            hasExceededStorage
          };
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error updating storage usage:', error);
      return false;
    }
  };

  // Function to check if creating a new agent would exceed limits
  const canCreateAgent = (): boolean => {
    if (state.isLoading) return false;
    return !state.hasExceededAgents;
  };

  // Function to check if adding a new integration would exceed limits
  const canAddIntegration = (): boolean => {
    if (state.isLoading) return false;
    return !state.hasExceededIntegrations;
  };

  // Function to check if user can make a call
  const canMakeCall = (): boolean => {
    if (state.isLoading) return false;
    return !state.hasExceededCallTime;
  };

  // Function to check if user can send a message
  const canSendMessage = (): boolean => {
    if (state.isLoading) return false;
    return !state.hasExceededChatTokens;
  };

  // Function to check if user can upload a file
  const canUploadFile = (fileSizeBytes: number): boolean => {
    if (state.isLoading) return false;
    
    const fileSizeMB = usageService.calculateFileSizeMB(fileSizeBytes);
    const newStorageUsed = (state.usage?.storageUsedMB || 0) + fileSizeMB;
    
    return newStorageUsed <= state.limits.maxStorageMB;
  };

  return {
    ...state,
    updateCallTimeUsage,
    updateChatTokensUsage,
    updateStorageUsage,
    canCreateAgent,
    canAddIntegration,
    canMakeCall,
    canSendMessage,
    canUploadFile
  };
}