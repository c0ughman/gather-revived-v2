import { OAuthConfig } from '../services/oauthService';

// OAuth configurations for different providers
export const oauthConfigs: Record<string, Omit<OAuthConfig, 'clientId' | 'clientSecret' | 'redirectUri'>> = {
  notion: {
    provider: 'notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scope: '', // Notion doesn't use traditional scopes
    authMethod: 'basic',
    extraAuthParams: {
      owner: 'user',
      response_type: 'code'
    },
    tokenResponseMapping: {
      accessToken: 'access_token',
      // Notion doesn't provide refresh tokens
    },
    headers: {
      'Notion-Version': '2022-06-28'
    }
  },

  google: {
    provider: 'google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid profile email',
    authMethod: 'body',
    extraAuthParams: {
      access_type: 'offline',
      prompt: 'consent'
    },
    tokenResponseMapping: {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expiresIn: 'expires_in'
    },
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo'
  },

  slack: {
    provider: 'slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scope: 'chat:write,channels:read,users:read',
    authMethod: 'body',
    tokenResponseMapping: {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expiresIn: 'expires_in'
    },
    userInfoUrl: 'https://slack.com/api/users.identity'
  },

  github: {
    provider: 'github',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'repo,user',
    authMethod: 'body',
    tokenResponseMapping: {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expiresIn: 'expires_in'
    },
    userInfoUrl: 'https://api.github.com/user',
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  },

  discord: {
    provider: 'discord',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scope: 'identify guilds',
    authMethod: 'body',
    tokenResponseMapping: {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expiresIn: 'expires_in'
    },
    userInfoUrl: 'https://discord.com/api/users/@me'
  },

  microsoft: {
    provider: 'microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid profile email User.Read',
    authMethod: 'body',
    tokenResponseMapping: {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expiresIn: 'expires_in'
    },
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me'
  }
};

/**
 * Get OAuth config for a provider with client credentials
 */
export function getOAuthConfig(
  provider: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): OAuthConfig {
  const baseConfig = oauthConfigs[provider];
  if (!baseConfig) {
    throw new Error(`OAuth configuration not found for provider: ${provider}`);
  }

  return {
    ...baseConfig,
    clientId,
    clientSecret,
    redirectUri
  };
}

/**
 * Get available OAuth providers
 */
export function getAvailableProviders(): string[] {
  return Object.keys(oauthConfigs);
}