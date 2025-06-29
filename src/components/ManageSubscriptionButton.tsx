import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { stripeService } from '../services/stripe';
import { useSubscription } from '../hooks/useSubscription';

interface ManageSubscriptionButtonProps {
  className?: string;
}

export default function ManageSubscriptionButton({ className = '' }: ManageSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { isActive } = useSubscription();

  const handleManageSubscription = async () => {
    try {
      setIsLoading(true);
      const portalUrl = await stripeService.createPortalSession();
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('Failed to open customer portal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isActive) {
    return null;
  }

  return (
    <button
      onClick={handleManageSubscription}
      disabled={isLoading}
      className={`flex items-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200 text-sm ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <CreditCard className="w-4 h-4" />
      )}
      <span>Manage Subscription</span>
    </button>
  );
}