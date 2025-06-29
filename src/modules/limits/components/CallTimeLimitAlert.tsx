import React from 'react';
import { AlertCircle, Zap } from 'lucide-react';
import { formatTimeUntilReset } from '../../../core/types/limits';

interface CallTimeLimitAlertProps {
  isLimitReached: boolean;
  resetDate: Date;
  onUpgrade: () => void;
}

export function CallTimeLimitAlert({ isLimitReached, resetDate, onUpgrade }: CallTimeLimitAlertProps) {
  if (!isLimitReached) return null;

  const formattedTime = formatTimeUntilReset(resetDate);

  return (
    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-white text-center mb-2">Call Time Limit Reached</h2>
        
        <p className="text-slate-300 text-center mb-6">
          You've used all your available call time for now. Your limit will reset in {formattedTime}.
        </p>
        
        <button
          onClick={onUpgrade}
          className="w-full py-3 bg-gradient-to-r from-[#186799] to-purple-600 hover:from-[#1a5a7a] hover:to-purple-700 text-white rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <Zap className="w-5 h-5" />
          <span>Upgrade for More Call Time</span>
        </button>
      </div>
    </div>
  );
}