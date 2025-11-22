import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { validateTokenLimit, formatTokenCount } from '../utils/tokenUtils';

interface TokenCounterProps {
  text: string;
  maxTokens: number;
  label?: string;
  className?: string;
  showBar?: boolean;
}

export default function TokenCounter({ 
  text, 
  maxTokens, 
  label = "tokens",
  className = "",
  showBar = true 
}: TokenCounterProps) {
  const validation = validateTokenLimit(text, maxTokens);
  const percentage = (validation.currentTokens / validation.maxTokens) * 100;
  
  // Determine color and icon based on usage
  let colorClass = "text-green-400";
  let bgColorClass = "bg-green-400";
  let Icon = CheckCircle2;
  
  if (percentage >= 100) {
    colorClass = "text-red-400";
    bgColorClass = "bg-red-400";
    Icon = XCircle;
  } else if (percentage >= 80) {
    colorClass = "text-yellow-400";
    bgColorClass = "bg-yellow-400";
    Icon = AlertTriangle;
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Token count display */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <Icon className={`w-4 h-4 ${colorClass}`} />
          <span className="text-slate-300">
            {formatTokenCount(validation.currentTokens)} / {formatTokenCount(validation.maxTokens)} {label}
          </span>
        </div>
        
        {!validation.isValid && (
          <span className="text-red-400 font-medium">
            Exceeds limit by {formatTokenCount(validation.currentTokens - validation.maxTokens)}
          </span>
        )}
        
        {validation.isValid && validation.remainingTokens <= validation.maxTokens * 0.2 && (
          <span className="text-yellow-400">
            {formatTokenCount(validation.remainingTokens)} remaining
          </span>
        )}
      </div>
      
      {/* Progress bar */}
      {showBar && (
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${bgColorClass}`}
            style={{ 
              width: `${Math.min(percentage, 100)}%`,
              opacity: percentage >= 100 ? 1 : 0.7
            }}
          />
        </div>
      )}
      
      {/* Warning message */}
      {!validation.isValid && (
        <div className="flex items-start space-x-2 p-3 border-status-error">
          <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="text-red-300 text-sm">
            <p className="font-medium">Token limit exceeded</p>
            <p>
              This content is too long and will need to be shortened before saving. 
              Consider removing some text or breaking it into smaller sections.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}