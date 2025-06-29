import React from 'react';
import { Clock, AlertTriangle, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCallTime } from '../utils/formatCallTime';
import { CallTimeLimit } from '../types/voice';

interface CallLimitReachedProps {
  callTimeLimit: CallTimeLimit;
  onUpgrade: () => void;
  className?: string;
}

export default function CallLimitReached({ callTimeLimit, onUpgrade, className = '' }: CallLimitReachedProps) {
  const navigate = useNavigate();

  return (
    <div className={`h-full bg-glass-bg flex flex-col items-center justify-center p-6 ${className}`}>
      <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-red-700 p-8 text-center">
        <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-4">
          Call Time Limit Reached
        </h1>
        
        <p className="text-slate-300 mb-6">
          You've used all of your available call time for today. Upgrade your plan to get more call time and continue your conversations.
        </p>
        
        <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">Daily Limit:</span>
            <span className="text-white font-medium">{formatCallTime(callTimeLimit.limit)}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">Used:</span>
            <span className="text-red-400 font-medium">{formatCallTime(callTimeLimit.used)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Remaining:</span>
            <span className="text-yellow-400 font-medium">{formatCallTime(callTimeLimit.remaining)}</span>
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-600">
            <div className="flex items-center space-x-2 text-slate-300 text-sm">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Resets at midnight in your local timezone</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={onUpgrade}
            className="w-full py-3 px-6 bg-gradient-to-r from-[#186799] to-purple-600 hover:from-[#1a5a7a] hover:to-purple-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center space-x-2 group"
          >
            <Zap className="w-5 h-5" />
            <span>Upgrade Your Plan</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition-colors duration-200"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}