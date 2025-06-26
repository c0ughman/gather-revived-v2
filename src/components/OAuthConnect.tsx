import React, { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { oauthService, OAuthConfig } from '../services/oauthService';
import { getOAuthConfig } from '../data/oauthConfigs';
import { useAuth } from '../hooks/useAuth';

interface OAuthConnectProps {
  provider: string;
  onSuccess: (tokenId: string) => void;
  onError: (error: string) => void;
  className?: string;
}

export default function OAuthConnect({ 
  provider, 
  onSuccess, 
  onError, 
  className = '' 
}: OAuthConnectProps) {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already connected
  useEffect(() => {
    if (user) {
      checkConnection();
    }
  }, [user, provider]);

  const checkConnection = async () => {
    if (!user) return;
    
    try {
      const token = await oauthService.getToken(user.id, provider);
      if (token) {
        setIsConnected(true);
        onSuccess(token.id);
      }
    } catch (error) {
      console.error('Error checking OAuth connection:', error);
    }
  };

  const handleConnect = async () => {
    if (!user) {
      onError('User not authenticated');
      return;
    }

    // Get client credentials from environment variables
    const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_NOTION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      onError('Notion OAuth credentials not configured. Please add VITE_NOTION_CLIENT_ID and VITE_NOTION_CLIENT_SECRET to your environment variables.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('🔗 Starting OAuth connection for provider:', provider);
      
      // Generate dynamic redirect URI based on current origin
      const redirectUri = `${window.location.origin}/oauth/callback/${provider}`;
      console.log('🔗 Using redirect URI:', redirectUri);
      
      // Get OAuth config with environment credentials
      const config: OAuthConfig = getOAuthConfig(provider, clientId, clientSecret, redirectUri);
      
      // Generate auth URL with state
      const state = btoa(JSON.stringify({ 
        userId: user.id, 
        provider,
        timestamp: Date.now() 
      }));
      
      console.log('🔗 Generated state for OAuth:', { userId: user.id, provider });
      
      const authUrl = oauthService.generateAuthUrl(config, state);
      
      // Store config in session for callback
      const configKey = `oauth_config_${provider}`;
      sessionStorage.setItem(configKey, JSON.stringify(config));
      console.log('💾 Stored OAuth config in session storage with key:', configKey);
      
      // Redirect to OAuth provider
      console.log('🚀 Redirecting to OAuth provider:', authUrl);
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('❌ OAuth connection error:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect');
      onError(error instanceof Error ? error.message : 'Failed to connect');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      await oauthService.revokeToken(user.id, provider);
      setIsConnected(false);
      setError(null);
    } catch (error) {
      console.error('Error disconnecting OAuth:', error);
      setError('Failed to disconnect');
    }
  };

  const getProviderDisplayName = (provider: string): string => {
    const names: Record<string, string> = {
      notion: 'Notion',
      google: 'Google',
      slack: 'Slack',
      github: 'GitHub',
      discord: 'Discord',
      microsoft: 'Microsoft'
    };
    return names[provider] || provider;
  };

  const getProviderColor = (provider: string): string => {
    const colors: Record<string, string> = {
      notion: '#000000',
      google: '#4285f4',
      slack: '#4a154b',
      github: '#333333',
      discord: '#5865f2',
      microsoft: '#0078d4'
    };
    return colors[provider] || '#6b7280';
  };

  if (isConnected) {
    return (
      <div className={`flex items-center justify-between p-4 bg-green-900 bg-opacity-20 border border-green-700 rounded-lg ${className}`}>
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-300">
              Connected to {getProviderDisplayName(provider)}
            </p>
            <p className="text-xs text-green-400">
              Integration is ready to use
            </p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-3 py-1 text-xs text-green-300 hover:text-green-200 border border-green-600 hover:border-green-500 rounded transition-colors duration-200"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className={`p-4 border border-slate-600 rounded-lg bg-slate-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: getProviderColor(provider) }}
          >
            {getProviderDisplayName(provider)[0]}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">
              Connect to {getProviderDisplayName(provider)}
            </h3>
            <p className="text-xs text-slate-400">
              Authorize access to your {getProviderDisplayName(provider)} account
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-center space-x-2 p-2 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 text-sm"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <ExternalLink className="w-4 h-4" />
            <span>Connect {getProviderDisplayName(provider)}</span>
          </>
        )}
      </button>

      <p className="mt-2 text-xs text-slate-400">
        You'll be redirected to {getProviderDisplayName(provider)} to authorize this integration.
      </p>
    </div>
  );
}