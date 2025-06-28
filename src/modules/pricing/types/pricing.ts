export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  yearlyPrice: number;
  features: string[];
  limits: UsageLimits;
  popular?: boolean;
  color: string;
  description: string;
}

export interface UsageLimits {
  callTimeMinutes: number; // per week for free, per day for paid
  maxAgents: number;
  integrations: 'BASIC' | 'PREMIUM' | 'CUSTOM';
  storageGB: number;
  chatTokens: number; // in thousands
  isUnlimited?: boolean;
}

export interface UserUsage {
  userId: string;
  currentPlan: string;
  callTimeUsed: number; // in minutes
  agentsCreated: number;
  integrationsActive: number;
  storageUsed: number; // in MB
  chatTokensUsed: number;
  lastResetDate: Date;
  billingCycle: 'weekly' | 'daily' | 'monthly';
}

export interface SubscriptionStatus {
  isActive: boolean;
  planId: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date;
}

export interface UsageAlert {
  type: 'warning' | 'limit_reached' | 'upgrade_required';
  resource: 'callTime' | 'agents' | 'integrations' | 'storage' | 'chatTokens';
  currentUsage: number;
  limit: number;
  percentage: number;
  message: string;
}