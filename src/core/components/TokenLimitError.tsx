import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface TokenLimitErrorProps {
  error: {
    tokens?: number;
    maxTokens?: number;
    error?: string;
    currentCount?: number;
    maxCount?: number;
    currentTokens?: number;
    newTokens?: number;
    totalTokens?: number;
  };
  onDismiss?: () => void;
  type?: 'error' | 'warning' | 'info';
  className?: string;
}

export default function TokenLimitError({
  error,
  onDismiss,
  type = 'error',
  className = ''
}: TokenLimitErrorProps) {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-900/20';
      case 'info':
        return 'border-blue-500/30 bg-blue-900/20';
      default:
        return 'border-red-500/30 bg-red-900/20';
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${getBorderColor()} ${className}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white mb-1">
          Token Limit Exceeded
        </div>
        
        <div className="text-sm text-slate-300 mb-2">
          {error.error}
        </div>
        
        {/* Token details */}
        {error.tokens && error.maxTokens && (
          <div className="text-xs text-slate-400 space-y-1">
            <div>Current: {formatNumber(error.tokens)} tokens</div>
            <div>Limit: {formatNumber(error.maxTokens)} tokens</div>
            <div>Over by: {formatNumber(error.tokens - error.maxTokens)} tokens</div>
          </div>
        )}
        
        {/* Document count details */}
        {error.currentCount !== undefined && error.maxCount && (
          <div className="text-xs text-slate-400 space-y-1">
            <div>Current documents: {error.currentCount}</div>
            <div>Maximum allowed: {error.maxCount}</div>
          </div>
        )}
        
        {/* Cumulative token details */}
        {error.currentTokens !== undefined && error.newTokens !== undefined && error.totalTokens !== undefined && (
          <div className="text-xs text-slate-400 space-y-1">
            <div>Current: {formatNumber(error.currentTokens)} tokens</div>
            <div>New: {formatNumber(error.newTokens)} tokens</div>
            <div>Total would be: {formatNumber(error.totalTokens)} tokens</div>
          </div>
        )}
      </div>
      
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 hover:bg-slate-600 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      )}
    </div>
  );
}

// Helper component for inline validation errors (for form inputs)
interface InlineTokenErrorProps {
  validation: {
    valid: boolean;
    tokens?: number;
    maxTokens?: number;
    remainingTokens?: number;
  };
  className?: string;
}

export function InlineTokenError({ validation, className = '' }: InlineTokenErrorProps) {
  if (validation.valid) return null;
  
  return (
    <div className={`flex items-center gap-2 text-xs text-red-400 mt-1 ${className}`}>
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      <span>
        Exceeds {validation.maxTokens?.toLocaleString()} token limit by{' '}
        {validation.tokens && validation.maxTokens 
          ? (validation.tokens - validation.maxTokens).toLocaleString()
          : 'unknown'} tokens
      </span>
    </div>
  );
}

// Helper component for token usage indicators
interface TokenUsageIndicatorProps {
  currentTokens: number;
  maxTokens: number;
  label?: string;
  className?: string;
}

export function TokenUsageIndicator({
  currentTokens,
  maxTokens,
  label = 'Token Usage',
  className = ''
}: TokenUsageIndicatorProps) {
  const percentage = Math.min(100, (currentTokens / maxTokens) * 100);
  const isOverLimit = currentTokens > maxTokens;
  const isNearLimit = percentage > 90 && !isOverLimit;
  
  const getBarColor = () => {
    if (isOverLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  const getTextColor = () => {
    if (isOverLimit) return 'text-red-400';
    if (isNearLimit) return 'text-yellow-400';
    return 'text-slate-400';
  };
  
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className={getTextColor()}>
          {currentTokens.toLocaleString()} / {maxTokens.toLocaleString()}
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-200 ${getBarColor()}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      {isOverLimit && (
        <div className="text-xs text-red-400 mt-1">
          Over limit by {(currentTokens - maxTokens).toLocaleString()} tokens
        </div>
      )}
    </div>
  );
}