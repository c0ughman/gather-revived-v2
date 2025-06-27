import { supabase } from '../../database/lib/supabase';

export interface OAuthConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string;
  extraAuthParams?: Record<string, string>;
  tokenResponseMapping?: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: string;
  };
  userInfoUrl?: string;
  authMethod: 'basic' | 'body'; // How to send client credentials
  headers?: Record<string, string>;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
  botId?: string; // For services like Notion
  workspaceId?: string;
  workspaceName?: string;
  userInfo?: any;
}

export interface StoredOAuthToken extends OAuthToken {
  id: string;
  userId: string;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

class OAuthService {
  /**
   * Get the correct redirect URI for the current environment
   */
  private getRedirectUri(provider: string): string {
    // In WebContainer, use the current origin
    const currentOrigin = window.location.origin;
    return `${currentOrigin}/oauth/callback/${provider}`;
  }

  /**
   * Generate the authorization URL for OAuth flow
   */
  generateAuthUrl(config: OAuthConfig, state?: string): string {
    // Use dynamic redirect URI
    const redirectUri = this.getRedirectUri(config.provider);
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scope,
      ...(state && { state }),
      ...config.extraAuthParams
    });

    const authUrl = `${config.authUrl}?${params.toString()}`;
    console.log('🔗 Generated OAuth URL:', authUrl);
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(config: OAuthConfig, code: string): Promise<OAuthToken> {
    try {
      console.log(`🔐 Exchanging OAuth code for ${config.provider} token`);

      // Use dynamic redirect URI
      const redirectUri = this.getRedirectUri(config.provider);

      const body: Record<string, string> = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      };

      // Add client credentials based on auth method
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.headers
      };

      if (config.authMethod === 'basic') {
        // HTTP Basic Auth (Notion, GitHub, etc.)
        const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
        headers['Authorization'] = `Basic ${credentials}`;
      } else {
        // Include in body (Google, Slack, etc.)
        body.client_id = config.clientId;
        body.client_secret = config.clientSecret;
      }

      console.log('📤 Making token exchange request to:', config.tokenUrl);

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Token exchange failed:', response.status, response.statusText, errorText);
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const tokenData = await response.json();
      console.log(`✅ Successfully obtained ${config.provider} token`);

      // Map response fields based on provider configuration
      const mapping = config.tokenResponseMapping || {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 'expires_in'
      };

      const token: OAuthToken = {
        accessToken: tokenData[mapping.accessToken],
        refreshToken: tokenData[mapping.refreshToken],
        tokenType: tokenData.token_type || 'Bearer',
        scope: tokenData.scope
      };

      // Calculate expiration if provided
      if (mapping.expiresIn && tokenData[mapping.expiresIn]) {
        const expiresInSeconds = parseInt(tokenData[mapping.expiresIn]);
        token.expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      }

      // Store provider-specific data
      if (config.provider === 'notion') {
        token.botId = tokenData.bot_id;
        token.workspaceId = tokenData.workspace_id;
        token.workspaceName = tokenData.workspace_name;
      }

      // Fetch user info if URL provided
      if (config.userInfoUrl && token.accessToken) {
        try {
          const userInfo = await this.fetchUserInfo(config, token.accessToken);
          token.userInfo = userInfo;
        } catch (error) {
          console.warn(`Failed to fetch user info for ${config.provider}:`, error);
        }
      }

      return token;
    } catch (error) {
      console.error(`❌ OAuth token exchange failed for ${config.provider}:`, error);
      throw error;
    }
  }

  /**
   * Fetch user information using access token
   */
  async fetchUserInfo(config: OAuthConfig, accessToken: string): Promise<any> {
    if (!config.userInfoUrl) return null;

    const response = await fetch(config.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        ...config.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Store OAuth token in database
   */
  async storeToken(userId: string, provider: string, token: OAuthToken): Promise<StoredOAuthToken> {
    console.log('🔍 Debug - Storing OAuth token:', { userId, provider });
    console.log('🔍 Debug - Supabase client exists:', !!supabase);
    
    const tokenData = {
      user_id: userId,
      provider,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expires_at: token.expiresAt?.toISOString(),
      scope: token.scope,
      token_type: token.tokenType,
      bot_id: token.botId,
      workspace_id: token.workspaceId,
      workspace_name: token.workspaceName,
      user_info: token.userInfo
    };

    console.log('🔍 Debug - Token data to store:', tokenData);

    const { data, error } = await supabase
      .from('oauth_tokens')
      .upsert(tokenData, { 
        onConflict: 'user_id,provider',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    console.log('🔍 Debug - Supabase response:', { data, error });

    if (error) {
      console.error('❌ Supabase error details:', error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      provider: data.provider,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      scope: data.scope,
      tokenType: data.token_type,
      botId: data.bot_id,
      workspaceId: data.workspace_id,
      workspaceName: data.workspace_name,
      userInfo: data.user_info,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Get stored OAuth token for user and provider
   */
  async getToken(userId: string, provider: string): Promise<StoredOAuthToken | null> {
    const { data, error } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      provider: data.provider,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      scope: data.scope,
      tokenType: data.token_type,
      botId: data.bot_id,
      workspaceId: data.workspace_id,
      workspaceName: data.workspace_name,
      userInfo: data.user_info,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Refresh an expired token
   */
  async refreshToken(config: OAuthConfig, refreshToken: string): Promise<OAuthToken> {
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const body: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    };

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...config.headers
    };

    if (config.authMethod === 'basic') {
      const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
      headers['Authorization'] = `Basic ${credentials}`;
    } else {
      body.client_id = config.clientId;
      body.client_secret = config.clientSecret;
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const tokenData = await response.json();

    const mapping = config.tokenResponseMapping || {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expiresIn: 'expires_in'
    };

    const token: OAuthToken = {
      accessToken: tokenData[mapping.accessToken],
      refreshToken: tokenData[mapping.refreshToken] || refreshToken, // Keep old refresh token if new one not provided
      tokenType: tokenData.token_type || 'Bearer',
      scope: tokenData.scope
    };

    if (mapping.expiresIn && tokenData[mapping.expiresIn]) {
      const expiresInSeconds = parseInt(tokenData[mapping.expiresIn]);
      token.expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    }

    return token;
  }

  /**
   * Check if token is expired and refresh if needed
   */
  async ensureValidToken(config: OAuthConfig, storedToken: StoredOAuthToken): Promise<StoredOAuthToken> {
    // Check if token is expired (with 5 minute buffer)
    if (storedToken.expiresAt && storedToken.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
      if (!storedToken.refreshToken) {
        throw new Error('Token expired and no refresh token available');
      }

      console.log(`🔄 Refreshing expired ${config.provider} token`);
      const newToken = await this.refreshToken(config, storedToken.refreshToken);
      
      // Update stored token
      return await this.storeToken(storedToken.userId, config.provider, newToken);
    }

    return storedToken;
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest(
    config: OAuthConfig,
    storedToken: StoredOAuthToken,
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Ensure token is valid
    const validToken = await this.ensureValidToken(config, storedToken);

    const headers = {
      'Authorization': `${validToken.tokenType || 'Bearer'} ${validToken.accessToken}`,
      'Accept': 'application/json',
      ...config.headers,
      ...options.headers
    };

    return fetch(url, {
      ...options,
      headers
    });
  }

  /**
   * Revoke OAuth token
   */
  async revokeToken(userId: string, provider: string): Promise<void> {
    const { error } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) throw error;
  }
}

export const oauthService = new OAuthService();