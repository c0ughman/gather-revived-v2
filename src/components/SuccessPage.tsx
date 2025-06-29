import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, MessageCircle, Loader2 } from 'lucide-react';
import { getProductByPriceId } from '../stripe-config';
import { stripeClient } from '../modules/payments/stripe-client';
import { supabase } from '../modules/database/lib/supabase';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const planParam = searchParams.get('plan');
    setPlan(planParam);

    // Get subscription details and save to user profile
    const getAndSaveSubscription = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching and saving subscription details');
        
        // Wait a moment to ensure webhook has processed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('Error getting user:', userError);
          setError('Unable to verify user. Please try refreshing the page.');
          setIsLoading(false);
          setSubscriptionChecked(true);
          return;
        }
        
        console.log(`Getting subscription for user: ${user.id}`);
        
        // Get subscription from Supabase view
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('stripe_user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (subscriptionError) {
          console.error('Error fetching subscription:', subscriptionError);
          setError('Unable to verify subscription. Your account may still be updated shortly.');
          setIsLoading(false);
          setSubscriptionChecked(true);
          return;
        }
        
        if (subscriptionData) {
          console.log('Found subscription:', subscriptionData);
          
          // Save to user profile
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('preferences')
            .eq('id', user.id)
            .single();
          
          const preferences = profile?.preferences || {};
          preferences.subscription = subscriptionData;
          preferences.plan = planParam || 'unknown';
          
          const { error: updateError } = await supabase
            .from('user_profiles')
            .upsert({
              id: user.id,
              preferences: preferences,
              updated_at: new Date().toISOString()
            });
          
          if (updateError) {
            console.error('Error saving subscription to profile:', updateError);
          } else {
            console.log('Subscription saved to user profile');
          }
          
          // Set plan from subscription data
          if (subscriptionData.price_id) {
            const product = getProductByPriceId(subscriptionData.price_id);
            if (product) {
              setPlan(product.name.toLowerCase());
              console.log(`Setting plan to: ${product.name}`);
            }
          }
        } else {
          console.log('No subscription found, using plan from URL:', planParam);
        }
        
        setIsLoading(false);
        setSubscriptionChecked(true);
      } catch (error) {
        console.error('Error processing subscription:', error);
        setError('An error occurred while processing your subscription.');
        setIsLoading(false);
        setSubscriptionChecked(true);
      }
    };

    // Start the subscription check process
    getAndSaveSubscription();

    // Countdown to redirect - only start after subscription is checked
    const timer = setInterval(() => {
      if (subscriptionChecked) {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [searchParams, navigate, subscriptionChecked]);

  // Clear localStorage on successful payment
  useEffect(() => {
    // Clear any previous subscription data to ensure fresh state
    localStorage.removeItem('subscription_data');
    localStorage.removeItem('subscription_status');
    localStorage.removeItem('stripe_subscription');
  }, []);

  const handleContinue = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex flex-col">
      {/* Custom CSS for animated gradient */}
      <style jsx="true">{`
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
            {isLoading ? (
              <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
            ) : (
              <CheckCircle className="w-10 h-10 text-green-500" />
            )}
          </div>
          
          <h1 className="text-3xl font-bold mb-4">
            Payment Successful!
          </h1>
          
          <p className="text-xl text-slate-300 mb-6">
            {isLoading ? (
              <span className="flex items-center justify-center space-x-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing your subscription...</span>
              </span>
            ) : plan ? (
              `Thank you for subscribing to our ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan!`
            ) : (
              'Thank you for your subscription!'
            )}
          </p>
          
          <p className="text-slate-400 mb-8">
            Your account has been successfully upgraded. You now have access to all the features included in your plan.
          </p>
          
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg mb-6">
              <p className="text-red-300 text-sm">{error}</p>
              <p className="text-red-400 text-xs mt-1">Don't worry, your payment was successful. You may need to refresh the app to see your subscription.</p>
            </div>
          )}
          
          <button
            onClick={handleContinue}
            className="w-full py-3 px-6 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full transition-colors duration-200 flex items-center justify-center space-x-2 group"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
          
          <p className="text-sm text-slate-500 mt-4">
            {subscriptionChecked ? `Redirecting in ${countdown} seconds...` : 'Verifying subscription...'}
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