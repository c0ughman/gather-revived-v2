import { UserUsage, UsageAlert, UsageLimits } from '../types/pricing';
import { getPlanById } from '../data/plans';

export class UsageService {
  private static instance: UsageService;
  
  static getInstance(): UsageService {
    if (!UsageService.instance) {
      UsageService.instance = new UsageService();
    }
    return UsageService.instance;
  }

  async getUserUsage(userId: string): Promise<UserUsage> {
    try {
      // In a real implementation, this would fetch from your database
      const stored = localStorage.getItem(`usage_${userId}`);
      if (stored) {
        const usage = JSON.parse(stored);
        return {
          ...usage,
          lastResetDate: new Date(usage.lastResetDate)
        };
      }

      // Default usage for new users
      return {
        userId,
        currentPlan: 'free',
        callTimeUsed: 0,
        agentsCreated: 0,
        integrationsActive: 0,
        storageUsed: 0,
        chatTokensUsed: 0,
        lastResetDate: new Date(),
        billingCycle: 'weekly'
      };
    } catch (error) {
      console.error('Error getting user usage:', error);
      throw new Error('Failed to load usage data');
    }
  }

  async updateUsage(userId: string, updates: Partial<UserUsage>): Promise<void> {
    try {
      const currentUsage = await this.getUserUsage(userId);
      const updatedUsage = { ...currentUsage, ...updates };
      
      localStorage.setItem(`usage_${userId}`, JSON.stringify(updatedUsage));
    } catch (error) {
      console.error('Error updating usage:', error);
      throw new Error('Failed to update usage data');
    }
  }

  async incrementUsage(
    userId: string, 
    type: 'callTime' | 'agents' | 'integrations' | 'storage' | 'chatTokens',
    amount: number
  ): Promise<void> {
    const usage = await this.getUserUsage(userId);
    
    switch (type) {
      case 'callTime':
        usage.callTimeUsed += amount;
        break;
      case 'agents':
        usage.agentsCreated += amount;
        break;
      case 'integrations':
        usage.integrationsActive += amount;
        break;
      case 'storage':
        usage.storageUsed += amount;
        break;
      case 'chatTokens':
        usage.chatTokensUsed += amount;
        break;
    }

    await this.updateUsage(userId, usage);
  }

  async checkUsageLimits(userId: string): Promise<UsageAlert[]> {
    const usage = await this.getUserUsage(userId);
    const plan = getPlanById(usage.currentPlan);
    
    if (!plan) {
      return [];
    }

    const alerts: UsageAlert[] = [];
    const limits = plan.limits;

    // Check each limit
    this.checkLimit(alerts, 'callTime', usage.callTimeUsed, limits.callTimeMinutes, 'minutes');
    this.checkLimit(alerts, 'agents', usage.agentsCreated, limits.maxAgents, 'agents');
    this.checkLimit(alerts, 'storage', usage.storageUsed / 1024, limits.storageGB, 'GB');
    this.checkLimit(alerts, 'chatTokens', usage.chatTokensUsed, limits.chatTokens, 'tokens');

    return alerts;
  }

  private checkLimit(
    alerts: UsageAlert[],
    resource: 'callTime' | 'agents' | 'integrations' | 'storage' | 'chatTokens',
    current: number,
    limit: number,
    unit: string
  ): void {
    if (limit === -1) return; // Unlimited

    const percentage = (current / limit) * 100;

    if (percentage >= 100) {
      alerts.push({
        type: 'limit_reached',
        resource,
        currentUsage: current,
        limit,
        percentage,
        message: `You've reached your ${resource} limit of ${limit} ${unit}. Upgrade to continue.`
      });
    } else if (percentage >= 80) {
      alerts.push({
        type: 'warning',
        resource,
        currentUsage: current,
        limit,
        percentage,
        message: `You're using ${Math.round(percentage)}% of your ${resource} limit (${current}/${limit} ${unit}).`
      });
    }
  }

  async canPerformAction(
    userId: string,
    action: 'createAgent' | 'startCall' | 'sendMessage' | 'uploadFile'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const usage = await this.getUserUsage(userId);
    const plan = getPlanById(usage.currentPlan);
    
    if (!plan) {
      return { allowed: false, reason: 'Invalid plan' };
    }

    const limits = plan.limits;

    switch (action) {
      case 'createAgent':
        if (limits.maxAgents !== -1 && usage.agentsCreated >= limits.maxAgents) {
          return { 
            allowed: false, 
            reason: `You've reached your limit of ${limits.maxAgents} agents. Upgrade to create more.` 
          };
        }
        break;

      case 'startCall':
        if (limits.callTimeMinutes !== -1 && usage.callTimeUsed >= limits.callTimeMinutes) {
          const period = usage.billingCycle === 'weekly' ? 'week' : 'day';
          return { 
            allowed: false, 
            reason: `You've used all ${limits.callTimeMinutes} minutes for this ${period}. Upgrade for more call time.` 
          };
        }
        break;

      case 'sendMessage':
        if (limits.chatTokens !== -1 && usage.chatTokensUsed >= limits.chatTokens) {
          return { 
            allowed: false, 
            reason: `You've reached your monthly chat limit. Upgrade to continue chatting.` 
          };
        }
        break;

      case 'uploadFile':
        if (limits.storageGB !== -1 && usage.storageUsed / 1024 >= limits.storageGB) {
          return { 
            allowed: false, 
            reason: `You've reached your storage limit of ${limits.storageGB}GB. Upgrade for more storage.` 
          };
        }
        break;
    }

    return { allowed: true };
  }

  async resetUsage(userId: string): Promise<void> {
    const usage = await this.getUserUsage(userId);
    const now = new Date();
    
    // Reset based on billing cycle
    if (usage.billingCycle === 'weekly') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (usage.lastResetDate < weekAgo) {
        usage.callTimeUsed = 0;
        usage.chatTokensUsed = 0;
        usage.lastResetDate = now;
      }
    } else if (usage.billingCycle === 'daily') {
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (usage.lastResetDate < dayAgo) {
        usage.callTimeUsed = 0;
        usage.lastResetDate = now;
      }
    }

    await this.updateUsage(userId, usage);
  }
}

export const usageService = UsageService.getInstance();