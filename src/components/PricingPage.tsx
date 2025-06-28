import React, { useState } from 'react';
import { ArrowRight, Check, Crown, Rocket, Zap } from 'lucide-react';

interface PricingPageProps {
  onSkipToPro: () => void;
}

export default function PricingPage({ onSkipToPro }: PricingPageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const pricingPlans = [
    {
      id: 'standard',
      name: 'Standard',
      price: billingCycle === 'monthly' ? 20 : 200,
      description: 'Perfect for individuals and small teams',
      color: 'from-blue-600 to-blue-700',
      icon: Zap,
      features: [
        '30 minutes call time per day',
        'Up to 7 AI agents',
        'Premium integrations',
        '5GB storage',
        '4M chat tokens per month'
      ]
    },
    {
      id: 'premium',
      name: 'Premium',
      price: billingCycle === 'monthly' ? 80 : 800,
      description: 'For power users and growing teams',
      color: 'from-purple-600 to-purple-700',
      icon: Crown,
      popular: true,
      features: [
        '100 minutes call time per day',
        'Up to 50 AI agents',
        'Premium integrations',
        '50GB storage',
        '15M chat tokens per month'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: billingCycle === 'monthly' ? 250 : 2500,
      description: 'For enterprises and unlimited usage',
      color: 'from-emerald-600 to-emerald-700',
      icon: Rocket,
      features: [
        'Unlimited call time',
        'Unlimited AI agents',
        'Custom integrations',
        'Unlimited storage',
        'Unlimited chat tokens'
      ]
    }
  ];

  const handleSelectPlan = (planId: string) => {
    // In a real implementation, this would redirect to Stripe
    console.log(`Selected plan: ${planId}`);
    
    // For now, just simulate a successful payment
    setTimeout(() => {
      onSkipToPro();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
      {/* Custom CSS for animated gradient */}
      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animated-gradient-text {
          background: linear-gradient(-45deg, #2c2984, #332d97, #3033a8, #4244e7, #4645eb, #6143fa, #8343fb, #a54aef, #a94ae4, #c750ce, #4578ed, #5d5fed, #6b3fec, #6d3aee, #713b);
          background-size: 400% 400%;
          animation: gradientShift 8s ease-in-out infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .animated-gradient-button {
          background: linear-gradient(-45deg, #2c2984, #332d97, #3033a8, #4244e7, #4645eb, #6143fa, #8343fb, #a54aef, #a94ae4, #c750ce, #4578ed, #5d5fed, #6b3fec, #6d3aee, #713b);
          background-size: 400% 400%;
          animation: gradientShift 8s ease-in-out infinite;
          transition: all 0.3s ease;
        }
        
        .animated-gradient-button:hover {
          animation: gradientShift 2s ease-in-out infinite;
          box-shadow: 0 0 30px rgba(97, 67, 250, 0.6), 0 0 60px rgba(199, 80, 206, 0.4);
        }
      `}</style>

      <div className="relative z-10 py-20">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="animated-gradient-text">Choose Your Plan</span>
            </h1>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-8">
              Unlock the full potential of AI collaboration. Start with any plan and upgrade anytime.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full p-1 border border-white/20">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Yearly
                <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {pricingPlans.map((plan) => {
              const IconComponent = plan.icon;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white/5 backdrop-blur-sm rounded-2xl border transition-all duration-300 hover:scale-105 ${
                    plan.popular
                      ? 'border-[#6143fa] shadow-2xl shadow-[#6143fa]/20'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="animated-gradient-button px-4 py-2 rounded-full text-sm font-semibold text-white">
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="p-8">
                    {/* Plan Header */}
                    <div className="text-center mb-8">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                      <p className="text-slate-400 text-sm">{plan.description}</p>
                    </div>

                    {/* Pricing */}
                    <div className="text-center mb-8">
                      <div className="flex items-baseline justify-center">
                        <span className="text-4xl font-bold text-white">${plan.price}</span>
                        <span className="text-slate-400 ml-2">
                          /{billingCycle === 'monthly' ? 'month' : 'year'}
                        </span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <div className="text-green-400 text-sm mt-2">
                          Save 20% vs monthly
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-4 mb-8">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-green-400" />
                          </div>
                          <span className="text-slate-300 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`w-full py-3 px-6 rounded-full font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${
                        plan.popular
                          ? 'animated-gradient-button text-white hover:scale-105'
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40'
                      }`}
                    >
                      <span>Get Started</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Not Interested Link */}
          <div className="text-center">
            <button
              onClick={onSkipToPro}
              className="text-slate-500 hover:text-slate-400 text-sm transition-colors duration-200 underline"
            >
              Not interested, continue with free version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}