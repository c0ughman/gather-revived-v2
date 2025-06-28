import React, { useState } from 'react';
import { Check, ArrowRight, Star, Zap, Crown, Rocket } from 'lucide-react';

interface PricingPageProps {
  onSelectPlan: (planId: string) => void;
  onSkipToPro: () => void;
}

export default function PricingPage({ onSelectPlan, onSkipToPro }: PricingPageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      icon: Zap,
      description: 'Perfect for individuals getting started',
      monthlyPrice: 19,
      yearlyPrice: 190,
      features: [
        '3 AI Assistants',
        '10,000 messages/month',
        'Basic integrations',
        'Email support',
        'Standard voice models'
      ],
      popular: false,
      color: 'from-blue-600 to-blue-700'
    },
    {
      id: 'pro',
      name: 'Pro',
      icon: Crown,
      description: 'For professionals who need more power',
      monthlyPrice: 49,
      yearlyPrice: 490,
      features: [
        '10 AI Assistants',
        '50,000 messages/month',
        'All integrations',
        'Priority support',
        'Premium voice models',
        'Custom personalities',
        'Advanced analytics'
      ],
      popular: true,
      color: 'from-purple-600 to-purple-700'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      icon: Rocket,
      description: 'For teams and organizations',
      monthlyPrice: 149,
      yearlyPrice: 1490,
      features: [
        'Unlimited AI Assistants',
        'Unlimited messages',
        'Custom integrations',
        'Dedicated support',
        'White-label options',
        'SSO & advanced security',
        'Custom deployment',
        'API access'
      ],
      popular: false,
      color: 'from-emerald-600 to-emerald-700'
    }
  ];

  const getPrice = (plan: typeof plans[0]) => {
    return billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  };

  const getSavings = (plan: typeof plans[0]) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const yearlyCost = plan.yearlyPrice;
    return Math.round(((monthlyCost - yearlyCost) / monthlyCost) * 100);
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
        
        .animated-gradient-text {
          background: linear-gradient(-45deg, #2c2984, #332d97, #3033a8, #4244e7, #4645eb, #6143fa, #8343fb, #a54aef, #a94ae4, #c750ce, #4578ed, #5d5fed, #6b3fec, #6d3aee, #713b);
          background-size: 400% 400%;
          animation: gradientShift 8s ease-in-out infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#6143fa]/20 to-[#c750ce]/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-[#c750ce]/20 to-[#4578ed]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

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
            {plans.map((plan) => {
              const IconComponent = plan.icon;
              const price = getPrice(plan);
              const savings = getSavings(plan);

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
                        <Star className="w-4 h-4 inline mr-1" />
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
                        <span className="text-4xl font-bold text-white">${price}</span>
                        <span className="text-slate-400 ml-2">
                          /{billingCycle === 'monthly' ? 'month' : 'year'}
                        </span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <div className="text-green-400 text-sm mt-2">
                          Save {savings}% vs monthly
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
                      onClick={() => onSelectPlan(plan.id)}
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

          {/* FAQ Section */}
          <div className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-white mb-12">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Can I change plans later?
                </h3>
                <p className="text-slate-400">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing differences.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-3">
                  What happens if I exceed my message limit?
                </h3>
                <p className="text-slate-400">
                  We'll notify you when you're approaching your limit. You can upgrade your plan or purchase additional message credits as needed.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Is there a free trial?
                </h3>
                <p className="text-slate-400">
                  Yes! All paid plans come with a 14-day free trial. No credit card required to start.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}