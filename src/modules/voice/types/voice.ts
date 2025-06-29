export interface CallState {
  isActive: boolean;
  duration: number;
  isMuted: boolean;
  status: 'connecting' | 'connected' | 'ended';
}

export interface VoiceConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface VoiceResponse {
  text: string;
  isComplete: boolean;
}

export interface CallTimeLimit {
  limit: number; // in seconds
  used: number; // in seconds
  remaining: number; // in seconds
  isLimitReached: boolean;
}

export interface PlanLimits {
  callTime: {
    daily: number; // in seconds
    weekly: number; // in seconds
  };
  agents: number;
  storage: number; // in MB
  integrations: number;
}

// Plan limits in seconds
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    callTime: {
      daily: 10 * 60, // 10 minutes per day
      weekly: 10 * 60, // 10 minutes per week (same as daily for free plan)
    },
    agents: 3,
    storage: 100, // 100 MB
    integrations: 2
  },
  standard: {
    callTime: {
      daily: 20 * 60, // 20 minutes per day
      weekly: 140 * 60, // 140 minutes per week (20 min * 7 days)
    },
    agents: 7,
    storage: 5 * 1024, // 5 GB
    integrations: 10
  },
  premium: {
    callTime: {
      daily: 100 * 60, // 100 minutes per day
      weekly: 700 * 60, // 700 minutes per week (100 min * 7 days)
    },
    agents: 50,
    storage: 50 * 1024, // 50 GB
    integrations: 50
  },
  pro: {
    callTime: {
      daily: 24 * 60 * 60, // 24 hours per day (unlimited)
      weekly: 7 * 24 * 60 * 60, // 7 days per week (unlimited)
    },
    agents: 1000, // practically unlimited
    storage: 1000 * 1024, // 1000 GB (practically unlimited)
    integrations: 1000 // practically unlimited
  }
};