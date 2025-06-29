import React from 'react';
import { Check, ArrowRight, Zap, Shield, Star, MessageCircle } from 'lucide-react';

interface PricingPageProps {
  onSelectPlan: (plan: string) => void;
  onStayFree: () => void;
}

export default function PricingPage({ onSelectPlan, onStayFree }: PricingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white overflow-hidden">
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
        
        .animated-gradient-bg {
          background: linear-gradient(-45deg, #2c2984, #332d97, #3033a8, #4244e7, #4645eb, #6143fa, #8343fb, #a54aef, #a94ae4, #c750ce, #4578ed, #5d5fed, #6b3fec, #6d3aee, #713b);
          background-size: 400% 400%;
          animation: gradientShift 8s ease-in-out infinite;
        }
      `}</style>

      {/* Navigation */}
      <nav className="relative z-50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 animated-gradient-bg rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Gather
            </span>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="text-center pt-10 pb-16 px-4">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Choose Your <span className="animated-gradient-text">Perfect Plan</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-3xl mx-auto">
          Select the plan that best fits your needs and start building your AI dream team today.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Free Plan */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden transition-all duration-300 hover:border-slate-600 hover:translate-y-[-4px]">
            <div className="p-8">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
                  <p className="text-slate-400 mb-4">Perfect for getting started</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-700/50">
                  <Star className="w-5 h-5 text-slate-400" />
                </div>
              </div>
              
              <div className="mt-6 mb-6">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-slate-400 ml-2">/month</span>
              </div>
              
              <button 
                onClick={() => onSelectPlan('free')}
                className="w-full py-3 px-4 rounded-lg border border-slate-600 text-white hover:bg-slate-700 transition-colors duration-200 mb-6"
              >
                Get Started Free
              </button>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">3 AI agents</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">5 integrations</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">100MB document storage</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">10 minutes of voice calls/month</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Basic support</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Pro Plan */}
          <div className="bg-gradient-to-b from-[#186799]/20 to-slate-800/50 backdrop-blur-sm rounded-2xl border border-[#186799] overflow-hidden transform scale-105 shadow-xl shadow-[#186799]/10 transition-all duration-300 hover:shadow-[#186799]/20">
            <div className="bg-[#186799] text-white text-center py-2 text-sm font-medium">
              MOST POPULAR
            </div>
            <div className="p-8">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                  <p className="text-slate-300 mb-4">For professionals and teams</p>
                </div>
                <div className="p-2 rounded-lg bg-[#186799]/30">
                  <Zap className="w-5 h-5 text-[#186799]" />
                </div>
              </div>
              
              <div className="mt-6 mb-6">
                <span className="text-4xl font-bold text-white">$29</span>
                <span className="text-slate-300 ml-2">/month</span>
              </div>
              
              <button 
                onClick={() => onSelectPlan('pro')}
                className="w-full py-3 px-4 rounded-lg bg-[#186799] text-white hover:bg-[#1a5a7a] transition-colors duration-200 mb-6 flex items-center justify-center space-x-2"
              >
                <span>Choose Pro</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300"><strong>Unlimited</strong> AI agents</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300"><strong>Unlimited</strong> integrations</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">5GB document storage</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">5 hours of voice calls/month</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Priority support</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Advanced analytics</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Team collaboration</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Enterprise Plan */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden transition-all duration-300 hover:border-slate-600 hover:translate-y-[-4px]">
            <div className="p-8">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
                  <p className="text-slate-400 mb-4">For large organizations</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-900/30">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
              </div>
              
              <div className="mt-6 mb-6">
                <span className="text-4xl font-bold text-white">$99</span>
                <span className="text-slate-400 ml-2">/month</span>
              </div>
              
              <button 
                onClick={() => onSelectPlan('enterprise')}
                className="w-full py-3 px-4 rounded-lg border border-purple-700 bg-purple-900/20 text-white hover:bg-purple-900/40 transition-colors duration-200 mb-6"
              >
                Contact Sales
              </button>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Everything in Pro, plus:</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Unlimited document storage</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Unlimited voice calls</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Custom AI model training</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Dedicated account manager</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">SSO & advanced security</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Custom integrations</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Free Plan Link */}
        <div className="text-center mt-10">
          <button 
            onClick={onStayFree}
            className="text-slate-400 hover:text-slate-300 text-sm transition-colors duration-200"
          >
            I'll stay with the free plan for now
          </button>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
        
        <div className="space-y-6">
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">Can I upgrade or downgrade my plan later?</h3>
            <p className="text-slate-300">Yes, you can change your plan at any time. When upgrading, you'll be charged the prorated amount for the remainder of your billing cycle. When downgrading, the new rate will apply at the start of your next billing cycle.</p>
          </div>
          
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">What happens if I reach my usage limits?</h3>
            <p className="text-slate-300">You'll receive a notification when you're approaching your limits. Once reached, you can continue using existing features but won't be able to create new agents or upload additional documents until the next billing cycle or until you upgrade your plan.</p>
          </div>
          
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">Is there a free trial for paid plans?</h3>
            <p className="text-slate-300">Yes, all paid plans come with a 14-day free trial. You can cancel anytime during the trial period and won't be charged.</p>
          </div>
          
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">Do you offer refunds?</h3>
            <p className="text-slate-300">We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied with our service, contact our support team within 30 days of your purchase for a full refund.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            © 2024 Gather AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}