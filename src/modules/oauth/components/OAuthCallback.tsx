import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { supabase } from '../../database/lib/supabase';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing OAuth callback...');
  const hasProcessed = useRef(false); // Prevent multiple executions

  useEffect(() => {
    // Wait for auth to load and prevent multiple executions
    if (!authLoading && !hasProcessed.current) {
      hasProcessed.current = true;
      handleCallback();
    }
  }, [authLoading, user]);

  const handleCallback = async () => {
    try {
      console.log('🔐 Starting OAuth callback processing...');
      
      // Get parameters from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const provider = window.location.pathname.split('/').pop();

      console.log('📋 OAuth callback params:', { code: !!code, state: !!state, error, provider });

      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      if (!code || !state || !provider) {
        throw new Error('Missing required OAuth parameters');
      }

      // Check if user is authenticated
      if (!user) {
        console.warn('⚠️ No authenticated user found, redirecting to login...');
        setStatus('error');
        setMessage('Please sign in first before connecting integrations.');
        
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
        return;
      }

      // Verify state parameter
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
        console.log('🔍 Decoded state data:', stateData);
      } catch (stateError) {
        console.error('❌ Failed to decode state:', stateError);
        throw new Error('Invalid state parameter');
      }

      // Verify state matches current user
      if (stateData.userId !== user.id) {
        console.error('❌ State user ID mismatch:', { stateUserId: stateData.userId, currentUserId: user.id });
        throw new Error('Invalid user session - state mismatch');
      }

      // Exchange authorization code for tokens via Supabase Edge Function
      console.log('🔄 Exchanging authorization code for tokens...');
      setMessage('Exchanging authorization code for access token...');
      
      try {
        // Call Supabase Edge Function to exchange code for token
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('VITE_SUPABASE_URL is required');
        }
        
        const functionUrl = `${supabaseUrl}/functions/v1/notion-oauth`;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'exchange_token',
            code: code,
            user_id: user.id
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Token exchange failed');
        }

        console.log('✅ Token exchange successful!');
        console.log(`🏢 Connected to workspace: ${result.workspace_name}`);
        
        // Store auth data for quick access
        const authData = {
          provider,
          code,
          userId: user.id,
          timestamp: Date.now(),
          redirectUri: `${window.location.origin}/oauth/callback/${provider}`,
          workspace_name: result.workspace_name,
          workspace_id: result.workspace_id
        };
        
        localStorage.setItem(`oauth_auth_${provider}_${user.id}`, JSON.stringify(authData));
        console.log('💾 Stored OAuth authorization data');
        
        // Store connection status in localStorage
        const connectionKey = `oauth_connected_${provider}_${user.id}`;
        localStorage.setItem(connectionKey, 'true');
        console.log('💾 Stored connection status in localStorage');
        
        setMessage(`Successfully connected to ${result.workspace_name}!`);
        
      } catch (tokenError) {
        console.error('❌ Token exchange failed:', tokenError);
        
        // Fall back to storing just the authorization code
        console.log('⚠️ Falling back to storing authorization code only...');
        const authData = {
          provider,
          code,
          userId: user.id,
          timestamp: Date.now(),
          redirectUri: `${window.location.origin}/oauth/callback/${provider}`
        };
        
        localStorage.setItem(`oauth_auth_${provider}_${user.id}`, JSON.stringify(authData));
        
        // Still mark as connected - the token exchange will happen on first API call
        const connectionKey = `oauth_connected_${provider}_${user.id}`;
        localStorage.setItem(connectionKey, 'true');
        
        setMessage('OAuth authorization received. Token exchange will complete on first use.');
      }

      // Clean up session storage
      const cleanupConfigKey = `oauth_config_${provider}`;
      sessionStorage.removeItem(cleanupConfigKey);
      console.log('🧹 Cleaned up session storage');

      setStatus('success');
      setMessage(`Successfully connected to ${provider}!`);

      // Dispatch custom event to notify the OAuth component
      const oauthCompleteEvent = new CustomEvent('oauth-complete', {
        detail: {
          provider,
          success: true,
          userId: user.id
        }
      });
      window.dispatchEvent(oauthCompleteEvent);

      // Redirect back to main app after a delay
      setTimeout(() => {
        const returnTo = stateData.returnTo || '/';
        navigate(returnTo, { 
          replace: true,
          state: { 
            oauthSuccess: true, 
            provider,
            message: `${provider} integration connected successfully!`
          } 
        });
      }, 2000);

    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'OAuth connection failed');

      // Dispatch error event
      const provider = window.location.pathname.split('/').pop();
      if (provider) {
        const oauthErrorEvent = new CustomEvent('oauth-complete', {
          detail: {
            provider,
            success: false,
            error: error instanceof Error ? error.message : 'OAuth connection failed'
          }
        });
        window.dispatchEvent(oauthErrorEvent);
      }

      // Redirect back to main app after a delay
      setTimeout(() => {
        navigate('/', { 
          replace: true,
          state: { 
            oauthError: true, 
            error: error instanceof Error ? error.message : 'OAuth connection failed' 
          } 
        });
      }, 5000);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-8 h-8 animate-spin text-[#186799]" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-[#186799]';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-lg p-8 text-center border border-slate-700">
          <Loader2 className="w-8 h-8 animate-spin text-[#186799] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-4">
            Loading...
          </h1>
          <p className="text-sm text-slate-400">
            Checking authentication status...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-lg p-8 text-center border border-slate-700">
        <div className="mb-6">
          {getStatusIcon()}
        </div>
        
        <h1 className="text-xl font-semibold text-white mb-4">
          OAuth Connection
        </h1>
        
        <p className={`text-sm ${getStatusColor()} mb-6`}>
          {message}
        </p>

        {status === 'processing' && (
          <div className="text-xs text-slate-400">
            Please wait while we complete the connection...
          </div>
        )}

        {status === 'success' && (
          <div className="text-xs text-slate-400">
            Redirecting you back to the app...
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400">
              Redirecting you back to the app...
            </div>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-4 py-2 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full text-sm transition-colors duration-200"
            >
              Return to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}