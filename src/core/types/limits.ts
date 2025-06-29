export interface UsageLimits {
  callTimeMinutes: number;
  maxAgents: number;
  maxIntegrations: number;
  maxStorageMB: number;
  maxChatTokens: number;
}

export interface UsageStats {
  callTimeUsedMinutes: number;
  agentsCreated: number;
  integrationsActive: number;
  storageUsedMB: number;
  chatTokensUsed: number;
  lastResetDate?: string;
}

export const PLAN_LIMITS: Record<string, UsageLimits> = {
  free: {
    callTimeMinutes: 10, // 10 min per week
    maxAgents: 4,
    maxIntegrations: 2, // BASIC integrations only
    maxStorageMB: 100,
    maxChatTokens: 100000 // 100k tokens
  },
  standard: {
    callTimeMinutes: 20, // 20 min per day
    maxAgents: 7,
    maxIntegrations: 10,
    maxStorageMB: 5 * 1024, // 5GB
    maxChatTokens: 4000000 // 4M tokens
  },
  premium: {
    callTimeMinutes: 100, // 100 min per day
    maxAgents: 50,
    maxIntegrations: 50,
    maxStorageMB: 50 * 1024, // 50GB
    maxStorageMB: 50 * 1024, // 50GB
    maxChatTokens: 15000000 // 15M tokens
  },
  pro: {
    callTimeMinutes: 1000, // Effectively unlimited
    maxAgents: 1000, // Effectively unlimited
    maxIntegrations: 1000, // Effectively unlimited
    maxStorageMB: 1000 * 1024, // Effectively unlimited (1TB)
    maxChatTokens: 1000000000 // Effectively unlimited (1B tokens)
  }
};

// Default daily chat token limit (divide monthly by 30)
export const getDailyChatTokenLimit = (plan: string): number => {
  const monthlyLimit = PLAN_LIMITS[plan]?.maxChatTokens || PLAN_LIMITS.free.maxChatTokens;
  return Math.floor(monthlyLimit / 30);
};

// Get time until reset based on plan
export const getTimeUntilReset = (plan: string, lastResetDate?: string): Date => {
  const now = new Date();
  const resetDate = new Date();
  
  if (plan === 'free') {
    // For free plan, reset weekly
    const lastReset = lastResetDate ? new Date(lastResetDate) : new Date(now);
    resetDate.setTime(lastReset.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  } else {
    // For paid plans, reset daily at midnight
    resetDate.setHours(24, 0, 0, 0); // Next midnight
  }
  
  return resetDate;
};

// Format time until reset in a human-readable way
export const formatTimeUntilReset = (resetDate: Date): string => {
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'now';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 24) {
    const days = Math.floor(diffHours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  }
  
  return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
};