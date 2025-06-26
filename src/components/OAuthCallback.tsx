import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { oauthService, OAuthConfig } from '../services/oauthService';
import { useAuth } from '../hooks/useAuth';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing OAuth callback...');

  useEffect(() => {
    // Wait for auth to load before processing callback
    if (!authLoading) {
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

      // Get stored config from sessionStorage
      const configKey = `oauth_config_${provider}`;
      const configJson = sessionStorage.getItem(configKey);
      
      if (!configJson) {
        console.error('❌ No OAuth config found in session storage for key:', configKey);
        throw new Error('OAuth configuration not found. Please try the integration setup again.');
      }

      let config: OAuthConfig;
      try {
        config = JSON.parse(configJson);
        console.log('✅ OAuth config loaded for provider:', provider);
      } catch (configError) {
        console.error('❌ Failed to parse OAuth config:', configError);
        throw new Error('Invalid OAuth configuration');
      }

      // Exchange code for token
      setMessage('Exchanging authorization code for access token...');
      console.log('🔄 Exchanging code for token...');
      
      const token = await oauthService.exchangeCodeForToken(config, code);
      console.log('✅ Token exchange successful');

      // Store token in database
      setMessage('Storing access token...');
      console.log('💾 Storing token in database...');
      
      const storedToken = await oauthService.storeToken(user.id, provider, token);
      console.log('✅ Token stored successfully with ID:', storedToken.id);

      // Clean up session storage
      sessionStorage.removeItem(configKey);
      console.log('🧹 Cleaned up session storage');

      setStatus('success');
      setMessage(`Successfully connected to ${provider}!`);

      // Redirect back to main app after a delay
      setTimeout(() => {
        navigate('/', { 
          replace: true,
          state: { 
            oauthSuccess: true, 
            provider,
            tokenId: storedToken.id 
          } 
        });
      }, 2000);

    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'OAuth connection failed');

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
        return <Loader2 className="w-8 h-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600';
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors duration-200"
            >
              Return to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}