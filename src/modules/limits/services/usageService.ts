import { supabase } from '../../database/lib/supabase';
import { UsageStats, PLAN_LIMITS, getTimeUntilReset } from '../../../core/types/limits';

class UsageService {
  /**
   * Get current usage stats for a user
   */
  async getUserUsage(userId: string): Promise<UsageStats | null> {
    try {
      console.log('📊 Fetching usage stats for user:', userId);
      
      // First check if user has a usage record
      const { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (usageError && usageError.code !== 'PGRST116') {
        console.error('❌ Error fetching user usage:', usageError);
        throw usageError;
      }
      
      // If no usage record exists, create one
      if (!usageData) {
        console.log('📝 Creating new usage record for user');
        
        const newUsage: UsageStats = {
          callTimeUsedMinutes: 0,
          agentsCreated: 0,
          integrationsActive: 0,
          storageUsedMB: 0,
          chatTokensUsed: 0,
          lastResetDate: new Date().toISOString()
        };
        
        const { data: newUsageData, error: createError } = await supabase
          .from('user_usage')
          .insert({
            user_id: userId,
            call_time_used: newUsage.callTimeUsedMinutes,
            agents_created: newUsage.agentsCreated,
            integrations_active: newUsage.integrationsActive,
            storage_used: newUsage.storageUsedMB,
            chat_tokens_used: newUsage.chatTokensUsed,
            last_reset_date: newUsage.lastResetDate
          })
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Error creating user usage record:', createError);
          throw createError;
        }
        
        return {
          callTimeUsedMinutes: newUsageData.call_time_used || 0,
          agentsCreated: newUsageData.agents_created || 0,
          integrationsActive: newUsageData.integrations_active || 0,
          storageUsedMB: newUsageData.storage_used || 0,
          chatTokensUsed: newUsageData.chat_tokens_used || 0,
          lastResetDate: newUsageData.last_reset_date
        };
      }
      
      // Check if usage needs to be reset based on plan
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('❌ Error fetching user profile:', profileError);
        throw profileError;
      }
      
      const plan = profileData?.preferences?.plan || 'free';
      const lastResetDate = usageData.last_reset_date ? new Date(usageData.last_reset_date) : null;
      const resetDate = lastResetDate ? getTimeUntilReset(plan, lastResetDate.toISOString()) : null;
      
      // If reset date has passed, reset usage
      if (resetDate && resetDate.getTime() <= new Date().getTime()) {
        console.log('🔄 Resetting usage for user');
        
        const { data: resetData, error: resetError } = await supabase
          .from('user_usage')
          .update({
            call_time_used: 0,
            chat_tokens_used: 0,
            last_reset_date: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
        
        if (resetError) {
          console.error('❌ Error resetting user usage:', resetError);
          throw resetError;
        }
        
        return {
          callTimeUsedMinutes: resetData.call_time_used || 0,
          agentsCreated: resetData.agents_created || 0,
          integrationsActive: resetData.integrations_active || 0,
          storageUsedMB: resetData.storage_used || 0,
          chatTokensUsed: resetData.chat_tokens_used || 0,
          lastResetDate: resetData.last_reset_date
        };
      }
      
      // Return current usage
      return {
        callTimeUsedMinutes: usageData.call_time_used || 0,
        agentsCreated: usageData.agents_created || 0,
        integrationsActive: usageData.integrations_active || 0,
        storageUsedMB: usageData.storage_used || 0,
        chatTokensUsed: usageData.chat_tokens_used || 0,
        lastResetDate: usageData.last_reset_date
      };
    } catch (error) {
      console.error('❌ Error in getUserUsage:', error);
      return null;
    }
  }
  
  /**
   * Update call time usage
   */
  async updateCallTimeUsage(userId: string, additionalMinutes: number): Promise<boolean> {
    try {
      console.log(`📞 Updating call time usage for user ${userId}: +${additionalMinutes} minutes`);
      
      // First, get current usage
      const { data: currentUsage, error: fetchError } = await supabase
        .from('user_usage')
        .select('call_time_used')
        .eq('user_id', userId)
        .single();
      
      if (fetchError) {
        console.error('❌ Error fetching current call time usage:', fetchError);
        return false;
      }
      
      const newCallTime = (currentUsage.call_time_used || 0) + additionalMinutes;
      
      // Update with new value
      const { error: updateError } = await supabase
        .from('user_usage')
        .update({
          call_time_used: newCallTime,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('❌ Error updating call time usage:', updateError);
        return false;
      }
      
      console.log(`✅ Call time updated to ${newCallTime} minutes`);
      return true;
    } catch (error) {
      console.error('❌ Error in updateCallTimeUsage:', error);
      return false;
    }
  }
  
  /**
   * Update chat tokens usage
   */
  async updateChatTokensUsage(userId: string, additionalTokens: number): Promise<boolean> {
    try {
      console.log(`💬 Updating chat tokens usage for user ${userId}: +${additionalTokens} tokens`);
      
      // First, get current usage
      const { data: currentUsage, error: fetchError } = await supabase
        .from('user_usage')
        .select('chat_tokens_used')
        .eq('user_id', userId)
        .single();
      
      if (fetchError) {
        console.error('❌ Error fetching current chat tokens usage:', fetchError);
        return false;
      }
      
      const newTokensUsed = (currentUsage.chat_tokens_used || 0) + additionalTokens;
      
      // Update with new value
      const { error: updateError } = await supabase
        .from('user_usage')
        .update({
          chat_tokens_used: newTokensUsed,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('❌ Error updating chat tokens usage:', updateError);
        return false;
      }
      
      console.log(`✅ Chat tokens updated to ${newTokensUsed} tokens`);
      return true;
    } catch (error) {
      console.error('❌ Error in updateChatTokensUsage:', error);
      return false;
    }
  }
  
  /**
   * Update storage usage
   */
  async updateStorageUsage(userId: string, additionalStorageMB: number): Promise<boolean> {
    try {
      console.log(`💾 Updating storage usage for user ${userId}: +${additionalStorageMB} MB`);
      
      // First, get current usage
      const { data: currentUsage, error: fetchError } = await supabase
        .from('user_usage')
        .select('storage_used')
        .eq('user_id', userId)
        .single();
      
      if (fetchError) {
        console.error('❌ Error fetching current storage usage:', fetchError);
        return false;
      }
      
      const newStorageUsed = (currentUsage.storage_used || 0) + additionalStorageMB;
      
      // Update with new value
      const { error: updateError } = await supabase
        .from('user_usage')
        .update({
          storage_used: newStorageUsed,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('❌ Error updating storage usage:', updateError);
        return false;
      }
      
      console.log(`✅ Storage updated to ${newStorageUsed} MB`);
      return true;
    } catch (error) {
      console.error('❌ Error in updateStorageUsage:', error);
      return false;
    }
  }
  
  /**
   * Update agents created count
   */
  async updateAgentsCreated(userId: string, count: number): Promise<boolean> {
    try {
      console.log(`🤖 Updating agents created for user ${userId}: ${count} agents`);
      
      const { data, error } = await supabase
        .from('user_usage')
        .update({
          agents_created: count,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) {
        console.error('❌ Error updating agents created:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error in updateAgentsCreated:', error);
      return false;
    }
  }
  
  /**
   * Update integrations active count
   */
  async updateIntegrationsActive(userId: string, count: number): Promise<boolean> {
    try {
      console.log(`🔌 Updating integrations active for user ${userId}: ${count} integrations`);
      
      const { data, error } = await supabase
        .from('user_usage')
        .update({
          integrations_active: count,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) {
        console.error('❌ Error updating integrations active:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error in updateIntegrationsActive:', error);
      return false;
    }
  }
  
  /**
   * Check if user has exceeded call time limit
   */
  async hasExceededCallTimeLimit(userId: string, plan: string): Promise<boolean> {
    try {
      const usage = await this.getUserUsage(userId);
      if (!usage) return false;
      
      const limit = PLAN_LIMITS[plan]?.callTimeMinutes || PLAN_LIMITS.free.callTimeMinutes;
      return usage.callTimeUsedMinutes >= limit;
    } catch (error) {
      console.error('❌ Error in hasExceededCallTimeLimit:', error);
      return false;
    }
  }
  
  /**
   * Check if user has exceeded chat tokens limit
   */
  async hasExceededChatTokensLimit(userId: string, plan: string): Promise<boolean> {
    try {
      const usage = await this.getUserUsage(userId);
      if (!usage) return false;
      
      // For chat tokens, we use a daily limit (monthly limit / 30)
      const dailyLimit = Math.floor((PLAN_LIMITS[plan]?.maxChatTokens || PLAN_LIMITS.free.maxChatTokens) / 30);
      return usage.chatTokensUsed >= dailyLimit;
    } catch (error) {
      console.error('❌ Error in hasExceededChatTokensLimit:', error);
      return false;
    }
  }
  
  /**
   * Check if user has exceeded storage limit
   */
  async hasExceededStorageLimit(userId: string, plan: string): Promise<boolean> {
    try {
      const usage = await this.getUserUsage(userId);
      if (!usage) return false;
      
      const limit = PLAN_LIMITS[plan]?.maxStorageMB || PLAN_LIMITS.free.maxStorageMB;
      return usage.storageUsedMB >= limit;
    } catch (error) {
      console.error('❌ Error in hasExceededStorageLimit:', error);
      return false;
    }
  }
  
  /**
   * Check if user has exceeded agents limit
   */
  async hasExceededAgentsLimit(userId: string, plan: string, currentCount: number): Promise<boolean> {
    try {
      const limit = PLAN_LIMITS[plan]?.maxAgents || PLAN_LIMITS.free.maxAgents;
      return currentCount >= limit;
    } catch (error) {
      console.error('❌ Error in hasExceededAgentsLimit:', error);
      return false;
    }
  }
  
  /**
   * Check if user has exceeded integrations limit
   */
  async hasExceededIntegrationsLimit(userId: string, plan: string, currentCount: number): Promise<boolean> {
    try {
      const limit = PLAN_LIMITS[plan]?.maxIntegrations || PLAN_LIMITS.free.maxIntegrations;
      return currentCount >= limit;
    } catch (error) {
      console.error('❌ Error in hasExceededIntegrationsLimit:', error);
      return false;
    }
  }
  
  /**
   * Calculate file size in MB
   */
  calculateFileSizeMB(bytes: number): number {
    return bytes / (1024 * 1024);
  }
  
  /**
   * Estimate tokens in a message
   * Simple approximation: 1 token ≈ 4 characters
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export const usageService = new UsageService();