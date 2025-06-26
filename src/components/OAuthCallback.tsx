import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { oauthService, OAuthConfig } from '../services/oauthService';
import { useAuth } from '../hooks/useAuth';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing OAuth callback...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Get parameters from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const provider = window.location.pathname.split('/').pop();

      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      if (!code || !state || !provider) {
        throw new Error('Missing required OAuth parameters');
      }

      // Verify state
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        throw new Error('Invalid state parameter');
      }

      if (!user || stateData.userId !== user.id) {
        throw new Error('Invalid user session');
      }

      // Get stored config
      const configJson = sessionStorage.getItem(`oauth_config_${provider}`);
      if (!configJson) {
        throw new Error('OAuth configuration not found');
      }

      const config: OAuthConfig = JSON.parse(configJson);

      // Exchange code for token
      setMessage('Exchanging authorization code for access token...');
      const token = await oauthService.exchangeCodeForToken(config, code);

      // Store token
      setMessage('Storing access token...');
      const storedToken = await oauthService.storeToken(user.id, provider, token);

      // Clean up
      sessionStorage.removeItem(`oauth_config_${provider}`);

      setStatus('success');
      setMessage(`Successfully connected to ${provider}!`);

      // Redirect back to settings after a delay
      setTimeout(() => {
        navigate('/settings', { 
          state: { 
            oauthSuccess: true, 
            provider,
            tokenId: storedToken.id 
          } 
        });
      }, 2000);

    } catch (error) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'OAuth connection failed');

      // Redirect back to settings after a delay
      setTimeout(() => {
        navigate('/settings', { 
          state: { 
            oauthError: true, 
            error: error instanceof Error ? error.message : 'OAuth connection failed' 
          } 
        });
      }, 3000);
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          {getStatusIcon()}
        </div>
        
        <h1 className="text-xl font-semibold text-gray-900 mb-4">
          OAuth Connection
        </h1>
        
        <p className={`text-sm ${getStatusColor()} mb-6`}>
          {message}
        </p>

        {status === 'processing' && (
          <div className="text-xs text-gray-500">
            Please wait while we complete the connection...
          </div>
        )}

        {status === 'success' && (
          <div className="text-xs text-gray-500">
            Redirecting you back to settings...
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500">
              Redirecting you back to settings...
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors duration-200"
            >
              Return to Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}