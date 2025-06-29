import React from 'react';
import { AlertCircle } from 'lucide-react';

interface LimitProgressBarProps {
  current: number;
  max: number;
  label: string;
  unit?: string;
  className?: string;
}

export function LimitProgressBar({ 
  current, 
  max, 
  label, 
  unit = '', 
  className = '' 
}: LimitProgressBarProps) {
  const percentage = Math.min(Math.round((current / max) * 100), 100);
  
  // Determine color based on usage
  const getBarColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-[#186799]';
  };
  
  const getTextColor = () => {
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 75) return 'text-yellow-400';
    return 'text-[#186799]';
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className={`text-xs font-medium ${getTextColor()}`}>
          {current.toLocaleString()} / {max.toLocaleString()} {unit}
          {percentage >= 90 && <AlertCircle className="inline-block w-3 h-3 ml-1" />}
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full ${getBarColor()}`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}