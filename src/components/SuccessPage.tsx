import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, MessageCircle } from 'lucide-react';
import { stripeService } from '../services/stripe';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const planParam = searchParams.get('plan');
    setPlan(planParam);

    // Get subscription details if no plan parameter
    const getSubscription = async () => {
      try {
        const subscription = await stripeService.getUserSubscription();
        if (subscription?.price_id) {
          // Map price ID to plan name
          let planName = 'premium'; // Default
          switch (subscription.price_id) {
            case 'price_1RfLCZCHpOkAgMGGUtW046jz':
              planName = 'standard';
              break;
            case 'price_1RfLEACHpOkAgMGGl3yIkLiX':
              planName = 'premium';
              break;
            case 'price_1RfLFJCHpOkAgMGGtGJlOf2I':
              planName = 'pro';
              break;
          }
          setPlan(planName);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      }
    };

    if (!planParam) {
      getSubscription();
    }

    // Countdown to redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [searchParams, navigate]);

  const handleContinue = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex flex-col">
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

      {/* Success Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">
            Payment Successful!
          </h1>
          
          <p className="text-xl text-slate-300 mb-6">
            {plan 
              ? `Thank you for subscribing to our ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan!` 
              : 'Thank you for your subscription!'}
          </p>
          
          <p className="text-slate-400 mb-8">
            Your account has been successfully upgraded. You now have access to all the features included in your plan.
          </p>
          
          <button
            onClick={handleContinue}
            className="w-full py-3 px-6 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full transition-colors duration-200 flex items-center justify-center space-x-2 group"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
          
          <p className="text-sm text-slate-500 mt-4">
            Redirecting in {countdown} seconds...
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            © 2024 Gather AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}