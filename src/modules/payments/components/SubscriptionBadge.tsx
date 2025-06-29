import React from 'react';
import { Crown, Star, Shield } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface SubscriptionBadgeProps {
  className?: string;
}

export default function SubscriptionBadge({ className = '' }: SubscriptionBadgeProps) {
  const { isLoading, plan } = useSubscription();

  if (isLoading) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full bg-slate-700 text-slate-300 text-xs ${className}`}>
        <div className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-transparent animate-spin mr-1"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (plan === 'free') {
    return null; // Don't show badge for free plan
  }

  const getBadgeConfig = () => {
    switch (plan) {
      case 'standard':
        return {
          icon: Star,
          bgColor: 'bg-blue-900/30',
          textColor: 'text-blue-300',
          borderColor: 'border-blue-700',
          label: 'Standard'
        };
      case 'premium':
        return {
          icon: Crown,
          bgColor: 'bg-[#186799]/30',
          textColor: 'text-[#186799]',
          borderColor: 'border-[#186799]/50',
          label: 'Premium'
        };
      case 'pro':
        return {
          icon: Shield,
          bgColor: 'bg-purple-900/30',
          textColor: 'text-purple-300',
          borderColor: 'border-purple-700',
          label: 'Pro'
        };
      default:
        return {
          icon: Star,
          bgColor: 'bg-slate-700',
          textColor: 'text-slate-300',
          borderColor: 'border-slate-600',
          label: plan.charAt(0).toUpperCase() + plan.slice(1)
        };
    }
  };

  const { icon: Icon, bgColor, textColor, borderColor, label } = getBadgeConfig();

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full ${bgColor} ${textColor} text-xs border ${borderColor} ${className}`}>
      <Icon className="w-3 h-3 mr-1" />
      <span>{label}</span>
    </div>
  );
}