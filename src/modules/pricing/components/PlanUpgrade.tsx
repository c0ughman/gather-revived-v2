import React from 'react';
import { ArrowRight, Crown, Zap } from 'lucide-react';
import { usePricing } from '../hooks/usePricing';
import { useUsage } from '../hooks/useUsage';
import { getPlanById, pricingPlans } from '../data/plans';

interface PlanUpgradeProps {
  reason?: string;
  suggestedPlan?: string;
  onClose?: () => void;
  className?: string;
}

export default function PlanUpgrade({ 
  reason, 
  suggestedPlan = 'premium', 
  onClose, 
  className = '' 
}: PlanUpgradeProps) {
  const { selectPlan, loading } = usePricing();
  const { usage } = useUsage();

  const currentPlan = usage ? getPlanById(usage.currentPlan) : null;
  const recommendedPlan = getPlanById(suggestedPlan);

  const handleUpgrade = async (planId: string) => {
    const result = await selectPlan(planId);
    if (result.success && onClose) {
      onClose();
    }
  };

  return (
    <div className={`bg-glass-panel glass-effect rounded-xl border border-slate-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Upgrade Your Plan</h3>
            <p className="text-slate-400 text-sm">Unlock more features and higher limits</p>
          </div>
        </div>
      </div>

      {/* Reason */}
      {reason && (
        <div className="p-6 border-b border-slate-700">
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">{reason}</p>
          </div>
        </div>
      )}

      {/* Current vs Recommended */}
      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Current Plan */}
          {currentPlan && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
              <div className="text-center mb-4">
                <h4 className="text-white font-semibold mb-2">Current Plan</h4>
                <div className="text-2xl font-bold text-slate-400">{currentPlan.name}</div>
                <div className="text-slate-500 text-sm">${currentPlan.price}/month</div>
              </div>
              <div className="space-y-2">
                {currentPlan.features.slice(0, 3).map((feature, index) => (
                  <div key={index} className="text-slate-400 text-sm">
                    • {feature}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Plan */}
          {recommendedPlan && (
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 rounded-lg p-4 border border-purple-600">
              <div className="text-center mb-4">
                <h4 className="text-white font-semibold mb-2">Recommended</h4>
                <div className="text-2xl font-bold text-white">{recommendedPlan.name}</div>
                <div className="text-purple-300 text-sm">${recommendedPlan.price}/month</div>
              </div>
              <div className="space-y-2 mb-4">
                {recommendedPlan.features.slice(0, 3).map((feature, index) => (
                  <div key={index} className="text-purple-200 text-sm">
                    • {feature}
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleUpgrade(recommendedPlan.id)}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{loading ? 'Processing...' : 'Upgrade Now'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        {/* All Plans */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <h4 className="text-white font-semibold mb-4">All Available Plans</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`p-4 rounded-lg border transition-all duration-200 hover:border-slate-500 ${
                  plan.popular
                    ? 'border-purple-600 bg-purple-900/20'
                    : 'border-slate-600 bg-slate-800'
                }`}
              >
                <div className="text-center mb-3">
                  <div className="text-lg font-bold text-white">{plan.name}</div>
                  <div className="text-sm text-slate-400">${plan.price}/month</div>
                </div>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                    plan.popular
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {loading ? 'Processing...' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Close Button */}
      {onClose && (
        <div className="p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors duration-200"
          >
            Maybe Later
          </button>
        </div>
      )}
    </div>
  );
}