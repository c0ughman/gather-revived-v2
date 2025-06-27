export interface OAuthConfig {
  provider: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface OAuthState {
  provider: string;
  state: string;
  redirectUri: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
} 