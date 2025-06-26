export interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'source' | 'action';
  icon: string;
  color: string;
  requiresApiKey: boolean;
  requiresOAuth?: boolean;
  oauthProvider?: string;
  fields: IntegrationField[];
  examples: string[];
  tags: string[];
}

export interface IntegrationField {
  id: string;
  name: string;
  type: 'text' | 'url' | 'select' | 'number' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export interface IntegrationConfig {
  integrationId: string;
  enabled: boolean;
  settings: Record<string, any>;
  trigger: 'periodic' | 'chat-start' | 'both' | 'manual';
  intervalMinutes?: number;
  description: string;
  // OAuth specific fields
  oauthTokenId?: string;
  oauthConnected?: boolean;
}

export interface IntegrationInstance {
  id: string;
  integrationId: string;
  name: string;
  config: IntegrationConfig;
  lastFetched?: Date;
  lastData?: any;
  status: 'active' | 'inactive' | 'error' | 'oauth_required';
  errorMessage?: string;
}