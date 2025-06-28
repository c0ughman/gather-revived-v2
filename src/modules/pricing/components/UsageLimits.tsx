import React from 'react';
import { AlertTriangle, Clock, Users, Database, MessageSquare, Zap } from 'lucide-react';
import { useUsage } from '../hooks/useUsage';
import { getPlanById } from '../data/plans';

interface UsageLimitsProps {
  className?: string;
}

export default function UsageLimits({ className = '' }: UsageLimitsProps) {
  const { usage, alerts, loading } = useUsage();

  if (loading || !usage) {
    return (
      <div className={`bg-glass-panel glass-effect rounded-xl p-6 border border-slate-700 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-slate-700 rounded"></div>
            <div className="h-3 bg-slate-700 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  const plan = getPlanById(usage.currentPlan);
  if (!plan) return null;

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  const formatStorage = (mb: number) => {
    if (mb < 1024) return `${Math.round(mb)}MB`;
    return `${(mb / 1024).toFixed(1)}GB`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens < 1000) return `${tokens}`;
    return `${(tokens / 1000).toFixed(1)}K`;
  };

  const usageItems = [
    {
      icon: Clock,
      label: 'Call Time',
      current: usage.callTimeUsed,
      limit: plan.limits.callTimeMinutes,
      unit: 'min',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500'
    },
    {
      icon: Users,
      label: 'AI Agents',
      current: usage.agentsCreated,
      limit: plan.limits.maxAgents,
      unit: 'agents',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500'
    },
    {
      icon: Database,
      label: 'Storage',
      current: usage.storageUsed,
      limit: plan.limits.storageGB * 1024, // Convert to MB
      unit: '',
      formatter: formatStorage,
      color: 'text-green-400',
      bgColor: 'bg-green-500'
    },
    {
      icon: MessageSquare,
      label: 'Chat Tokens',
      current: usage.chatTokensUsed,
      limit: plan.limits.chatTokens,
      unit: '',
      formatter: formatTokens,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500'
    }
  ];

  return (
    <div className={`bg-glass-panel glass-effect rounded-xl border border-slate-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Usage Limits</h3>
          <div className="flex items-center space-x-2">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              plan.id === 'free' 
                ? 'bg-slate-700 text-slate-300'
                : plan.id === 'pro'
                ? 'bg-emerald-900 text-emerald-300'
                : 'bg-purple-900 text-purple-300'
            }`}>
              {plan.name}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="p-4 border-b border-slate-700">
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-center space-x-2 p-2 rounded-lg ${
                  alert.type === 'limit_reached'
                    ? 'bg-red-900/50 border border-red-700'
                    : 'bg-yellow-900/50 border border-yellow-700'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 ${
                  alert.type === 'limit_reached' ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <span className={`text-sm ${
                  alert.type === 'limit_reached' ? 'text-red-300' : 'text-yellow-300'
                }`}>
                  {alert.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Items */}
      <div className="p-4 space-y-4">
        {usageItems.map((item, index) => {
          const percentage = getUsagePercentage(item.current, item.limit);
          const isUnlimited = item.limit === -1;
          const IconComponent = item.icon;

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <IconComponent className={`w-4 h-4 ${item.color}`} />
                  <span className="text-white text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-slate-400 text-sm">
                  {item.formatter ? item.formatter(item.current) : `${item.current}${item.unit}`}
                  {!isUnlimited && (
                    <>
                      {' / '}
                      {item.formatter ? item.formatter(item.limit) : `${item.limit}${item.unit}`}
                    </>
                  )}
                  {isUnlimited && ' (Unlimited)'}
                </span>
              </div>
              
              {!isUnlimited && (
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${item.bgColor}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}