import { PricingPlan } from '../types/pricing';

export const pricingPlans: PricingPlan[] = [
  {
    id: 'standard',
    name: 'Standard',
    price: 20,
    yearlyPrice: 200,
    description: 'Perfect for individuals and small teams',
    color: 'from-blue-600 to-blue-700',
    features: [
      '30 minutes call time per day',
      'Up to 7 AI agents',
      'Premium integrations',
      '5GB storage',
      '4M chat tokens per month'
    ],
    limits: {
      callTimeMinutes: 30, // per day
      maxAgents: 7,
      integrations: 'PREMIUM',
      storageGB: 5,
      chatTokens: 4000 // 4M tokens
    }
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 80,
    yearlyPrice: 800,
    description: 'For power users and growing teams',
    color: 'from-purple-600 to-purple-700',
    popular: true,
    features: [
      '100 minutes call time per day',
      'Up to 50 AI agents',
      'Premium integrations',
      '50GB storage',
      '15M chat tokens per month'
    ],
    limits: {
      callTimeMinutes: 100, // per day
      maxAgents: 50,
      integrations: 'PREMIUM',
      storageGB: 50,
      chatTokens: 15000 // 15M tokens
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 250,
    yearlyPrice: 2500,
    description: 'For enterprises and unlimited usage',
    color: 'from-emerald-600 to-emerald-700',
    features: [
      'Unlimited call time*',
      'Unlimited AI agents*',
      'Custom integrations',
      'Unlimited storage*',
      'Unlimited chat tokens*'
    ],
    limits: {
      callTimeMinutes: -1, // unlimited
      maxAgents: -1, // unlimited
      integrations: 'CUSTOM',
      storageGB: -1, // unlimited
      chatTokens: -1, // unlimited
      isUnlimited: true
    }
  }
];

export const freePlan: PricingPlan = {
  id: 'free',
  name: 'Free',
  price: 0,
  yearlyPrice: 0,
  description: 'Get started with basic features',
  color: 'from-slate-600 to-slate-700',
  features: [
    '10 minutes call time per week',
    'Up to 4 AI agents',
    'Basic integrations',
    '100MB storage',
    '100K chat tokens per month'
  ],
  limits: {
    callTimeMinutes: 10, // per week
    maxAgents: 4,
    integrations: 'BASIC',
    storageGB: 0.1, // 100MB
    chatTokens: 100 // 100K tokens
  }
};

export const getAllPlans = () => [freePlan, ...pricingPlans];

export const getPlanById = (planId: string): PricingPlan | undefined => {
  return getAllPlans().find(plan => plan.id === planId);
};