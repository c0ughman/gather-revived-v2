import React, { useEffect, useState } from 'react';
import { CheckCircle, X, Sparkles } from 'lucide-react';

interface SuccessNoticeProps {
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

export default function SuccessNotice({ 
  message, 
  onClose, 
  autoClose = true, 
  duration = 5000 
}: SuccessNoticeProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setIsVisible(true);

    // Auto close
    if (autoClose) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div className={`fixed top-6 right-6 z-50 transition-all duration-300 transform ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl border border-green-400/20 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{message}</p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="flex-shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Animated sparkles */}
        <div className="absolute -top-1 -right-1">
          <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
        </div>
      </div>
    </div>
  );
}