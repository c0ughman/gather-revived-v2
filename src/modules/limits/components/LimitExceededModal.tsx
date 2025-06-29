import React from 'react';
import { X, Zap, AlertTriangle } from 'lucide-react';
import { PLAN_LIMITS } from '../../../core/types/limits';

interface LimitExceededModalProps {
  limitType: 'callTime' | 'chatTokens' | 'storage' | 'agents' | 'integrations';
  plan: string;
  onClose: () => void;
  onUpgrade: () => void;
  resetTime?: string;
}

export function LimitExceededModal({ 
  limitType, 
  plan, 
  onClose, 
  onUpgrade,
  resetTime 
}: LimitExceededModalProps) {
  const getLimitInfo = () => {
    switch (limitType) {
      case 'callTime':
        return {
          title: 'Call Time Limit Reached',
          description: plan === 'free' 
            ? `You've used your weekly limit of ${PLAN_LIMITS.free.callTimeMinutes} minutes of call time.` 
            : `You've used your daily limit of ${PLAN_LIMITS[plan]?.callTimeMinutes || 0} minutes of call time.`,
          icon: <Zap className="w-12 h-12 text-yellow-400" />,
          upgradeText: 'Get more call time with a premium plan',
          resetMessage: resetTime ? `Your limit will reset in ${resetTime}.` : ''
        };
      case 'chatTokens':
        return {
          title: 'Daily Message Limit Reached',
          description: `You've reached your daily message limit.`,
          icon: <AlertTriangle className="w-12 h-12 text-yellow-400" />,
          upgradeText: 'Get more messages with a premium plan',
          resetMessage: resetTime ? `Your limit will reset in ${resetTime}.` : ''
        };
      case 'storage':
        return {
          title: 'Storage Limit Reached',
          description: `You've used your ${PLAN_LIMITS[plan]?.maxStorageMB || 0}MB storage limit.`,
          icon: <AlertTriangle className="w-12 h-12 text-yellow-400" />,
          upgradeText: 'Get more storage with a premium plan',
          resetMessage: ''
        };
      case 'agents':
        return {
          title: 'Agent Limit Reached',
          description: `You've created the maximum number of agents (${PLAN_LIMITS[plan]?.maxAgents || 0}) allowed on your plan.`,
          icon: <AlertTriangle className="w-12 h-12 text-yellow-400" />,
          upgradeText: 'Create more agents with a premium plan',
          resetMessage: ''
        };
      case 'integrations':
        return {
          title: 'Integration Limit Reached',
          description: `You've added the maximum number of integrations (${PLAN_LIMITS[plan]?.maxIntegrations || 0}) allowed on your plan.`,
          icon: <AlertTriangle className="w-12 h-12 text-yellow-400" />,
          upgradeText: 'Add more integrations with a premium plan',
          resetMessage: ''
        };
      default:
        return {
          title: 'Limit Reached',
          description: 'You\'ve reached a usage limit on your current plan.',
          icon: <AlertTriangle className="w-12 h-12 text-yellow-400" />,
          upgradeText: 'Upgrade to a premium plan',
          resetMessage: ''
        };
    }
  };

  const { title, description, icon, upgradeText, resetMessage } = getLimitInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            {icon}
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <p className="text-slate-300 mb-6">{description}</p>
        
        {resetMessage && (
          <div className="bg-slate-700 rounded-lg p-3 mb-6">
            <p className="text-slate-300 text-sm">{resetMessage}</p>
          </div>
        )}
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={onUpgrade}
            className="w-full py-3 bg-gradient-to-r from-[#186799] to-purple-600 hover:from-[#1a5a7a] hover:to-purple-700 text-white rounded-lg font-semibold transition-colors duration-200"
          >
            {upgradeText}
          </button>
          
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200"
          >
            Continue with Limitations
          </button>
        </div>
      </div>
    </div>
  );
}