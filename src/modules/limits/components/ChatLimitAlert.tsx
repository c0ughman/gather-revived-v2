import React from 'react';
import { AlertCircle, Zap } from 'lucide-react';
import { formatTimeUntilReset } from '../../../core/types/limits';

interface ChatLimitAlertProps {
  isLimitReached: boolean;
  resetDate: Date;
  onUpgrade: () => void;
}

export function ChatLimitAlert({ isLimitReached, resetDate, onUpgrade }: ChatLimitAlertProps) {
  if (!isLimitReached) return null;

  const formattedTime = formatTimeUntilReset(resetDate);

  return (
    <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg mb-4">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-red-300 font-medium mb-1">Daily Message Limit Reached</h3>
          <p className="text-red-200 text-sm mb-3">
            You've reached your daily message limit. Your limit will reset in {formattedTime}.
          </p>
          <button
            onClick={onUpgrade}
            className="flex items-center space-x-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 text-sm"
          >
            <Zap className="w-4 h-4" />
            <span>Upgrade for More Messages</span>
          </button>
        </div>
      </div>
    </div>
  );
}