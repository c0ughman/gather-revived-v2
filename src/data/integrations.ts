import { Integration } from '../types/integrations';

export const sourceIntegrations: Integration[] = [
  {
    id: 'http-requests',
    name: 'HTTP API Requests',
    description: 'Make HTTP requests to any API endpoint',
    category: 'source',
    icon: 'Globe',
    color: '#3b82f6',
    requiresApiKey: false,
    fields: [
      {
        id: 'url',
        name: 'API URL',
        type: 'url',
        required: true,
        placeholder: 'https://api.example.com/data',
        description: 'The URL endpoint to make the request to'
      },
      {
        id: 'method',
        name: 'HTTP Method',
        type: 'select',
        required: true,
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' }
        ],
        defaultValue: 'GET',
        description: 'HTTP method to use for the request'
      },
      {
        id: 'headers',
        name: 'Headers (JSON)',
        type: 'textarea',
        required: false,
        placeholder: '{"Content-Type": "application/json", "Authorization": "Bearer token"}',
        description: 'HTTP headers as JSON object',
        defaultValue: '{}'
      },
      {
        id: 'body',
        name: 'Request Body',
        type: 'textarea',
        required: false,
        placeholder: '{"key": "value"}',
        description: 'Request body for POST/PUT requests'
      }
    ],
    examples: [
      'Fetch weather data from OpenWeatherMap',
      'Get user information from GitHub API',
      'Post data to a webhook',
      'Retrieve cryptocurrency prices'
    ],
    tags: ['api', 'http', 'rest', 'web', 'data']
  },
  {
    id: 'google-news',
    name: 'Google News',
    description: 'Fetch latest news articles from Google News',
    category: 'source',
    icon: 'Newspaper',
    color: '#dc2626',
    requiresApiKey: false,
    fields: [
      {
        id: 'topic',
        name: 'Topic',
        type: 'text',
        required: true,
        placeholder: 'technology',
        description: 'News topic to search for',
        defaultValue: 'technology'
      },
      {
        id: 'country',
        name: 'Country',
        type: 'select',
        required: true,
        options: [
          { value: 'US', label: 'United States' },
          { value: 'GB', label: 'United Kingdom' },
          { value: 'CA', label: 'Canada' },
          { value: 'AU', label: 'Australia' },
          { value: 'DE', label: 'Germany' },
          { value: 'FR', label: 'France' },
          { value: 'JP', label: 'Japan' }
        ],
        defaultValue: 'US',
        description: 'Country for localized news'
      },
      {
        id: 'language',
        name: 'Language',
        type: 'select',
        required: true,
        options: [
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Spanish' },
          { value: 'fr', label: 'French' },
          { value: 'de', label: 'German' },
          { value: 'ja', label: 'Japanese' }
        ],
        defaultValue: 'en',
        description: 'Language for news articles'
      }
    ],
    examples: [
      'Latest technology news from the US',
      'Breaking news in multiple languages',
      'Country-specific news updates',
      'Topic-based news aggregation'
    ],
    tags: ['news', 'google', 'articles', 'current events', 'media']
  },
  {
    id: 'rss-feeds',
    name: 'RSS Feed Reader',
    description: 'Parse and read RSS/Atom feeds from any website',
    category: 'source',
    icon: 'Rss',
    color: '#f97316',
    requiresApiKey: false,
    fields: [
      {
        id: 'feedUrl',
        name: 'RSS Feed URL',
        type: 'url',
        required: true,
        placeholder: 'https://feeds.bbci.co.uk/news/rss.xml',
        description: 'URL of the RSS or Atom feed'
      },
      {
        id: 'maxItems',
        name: 'Max Items',
        type: 'number',
        required: false,
        placeholder: '10',
        description: 'Maximum number of items to fetch',
        defaultValue: '10'
      }
    ],
    examples: [
      'BBC News RSS feed',
      'Tech blog updates',
      'Podcast episode feeds',
      'Company blog notifications'
    ],
    tags: ['rss', 'feeds', 'xml', 'syndication', 'blogs']
  },
  {
    id: 'financial-markets',
    name: 'Financial Markets Data',
    description: 'Get real-time cryptocurrency and stock market data',
    category: 'source',
    icon: 'TrendingUp',
    color: '#10b981',
    requiresApiKey: false,
    fields: [
      {
        id: 'dataType',
        name: 'Data Type',
        type: 'select',
        required: true,
        options: [
          { value: 'crypto', label: 'Cryptocurrency' },
          { value: 'stocks', label: 'Stock Market' },
          { value: 'forex', label: 'Foreign Exchange' }
        ],
        defaultValue: 'crypto',
        description: 'Type of financial data to fetch'
      },
      {
        id: 'symbols',
        name: 'Symbols',
        type: 'text',
        required: true,
        placeholder: 'bitcoin,ethereum,cardano',
        description: 'Comma-separated list of symbols to track',
        defaultValue: 'bitcoin,ethereum,cardano'
      },
      {
        id: 'currency',
        name: 'Currency',
        type: 'select',
        required: true,
        options: [
          { value: 'usd', label: 'USD' },
          { value: 'eur', label: 'EUR' },
          { value: 'gbp', label: 'GBP' },
          { value: 'jpy', label: 'JPY' }
        ],
        defaultValue: 'usd',
        description: 'Base currency for prices'
      }
    ],
    examples: [
      'Bitcoin and Ethereum prices in USD',
      'Top 10 cryptocurrency market data',
      'Stock prices for major companies',
      'Foreign exchange rates'
    ],
    tags: ['finance', 'crypto', 'stocks', 'trading', 'markets', 'prices']
  }
];

// Action integrations for tool use
export const actionIntegrations: Integration[] = [
  {
    id: 'api-request-tool',
    name: 'API Request Tool',
    description: 'Make HTTP API requests when requested by the user',
    category: 'action',
    icon: 'Zap',
    color: '#8b5cf6',
    requiresApiKey: false,
    fields: [
      {
        id: 'baseUrl',
        name: 'Base URL (Optional)',
        type: 'url',
        required: false,
        placeholder: 'https://api.example.com',
        description: 'Default base URL for API requests'
      },
      {
        id: 'defaultHeaders',
        name: 'Default Headers (JSON)',
        type: 'textarea',
        required: false,
        placeholder: '{"Authorization": "Bearer token", "Content-Type": "application/json"}',
        description: 'Default headers to include with requests',
        defaultValue: '{"Content-Type": "application/json"}'
      },
      {
        id: 'allowedDomains',
        name: 'Allowed Domains',
        type: 'textarea',
        required: false,
        placeholder: 'api.example.com\napi.github.com\napi.openweathermap.org',
        description: 'Whitelist of allowed domains (one per line). Leave empty to allow all.'
      }
    ],
    examples: [
      'Make API calls when user asks for data',
      'Fetch information from external services',
      'Post data to webhooks on command',
      'Integrate with third-party APIs dynamically'
    ],
    tags: ['tool', 'api', 'function', 'action', 'dynamic', 'request']
  },
  {
    id: 'domain-checker-tool',
    name: 'Domain Availability Checker',
    description: 'Check domain availability using RDAP with customizable variations',
    category: 'action',
    icon: 'Globe',
    color: '#059669',
    requiresApiKey: false,
    fields: [
      {
        id: 'variations',
        name: 'Domain Variations',
        type: 'textarea',
        required: false,
        placeholder: '{domain}.com\n{domain}.net\n{domain}.org\ntry{domain}.com\n{domain}app.com\nget{domain}.com',
        description: 'Domain variations to check. Use {domain} as placeholder for the base domain name.',
        defaultValue: '{domain}.com\n{domain}.net\n{domain}.org\ntry{domain}.com\n{domain}app.com'
      },
      {
        id: 'maxConcurrent',
        name: 'Max Concurrent Checks',
        type: 'number',
        required: false,
        placeholder: '5',
        description: 'Maximum number of domains to check simultaneously',
        defaultValue: '5'
      }
    ],
    examples: [
      'Check if mycompany.com is available',
      'Find available domain variations for a startup name',
      'Bulk check domain availability with custom patterns',
      'Discover alternative domains for branding'
    ],
    tags: ['domain', 'availability', 'rdap', 'registration', 'dns', 'tool']
  },
  {
    id: 'zapier-webhook',
    name: 'Zapier Webhook',
    description: 'Connect to Zapier webhooks to trigger Zaps and automate workflows across 5000+ apps',
    category: 'action',
    icon: 'Zap',
    color: '#ff4a00',
    requiresApiKey: false,
    fields: [
      {
        id: 'webhookUrl',
        name: 'Zapier Webhook URL',
        type: 'url',
        required: true,
        placeholder: 'https://hooks.zapier.com/hooks/catch/123456/abcdef',
        description: 'The webhook URL from your Zapier trigger'
      },
      {
        id: 'zapName',
        name: 'Zap Name',
        type: 'text',
        required: true,
        placeholder: 'My Automation Zap',
        description: 'A friendly name to identify this Zap'
      },
      {
        id: 'description',
        name: 'What does this Zap do?',
        type: 'textarea',
        required: true,
        placeholder: 'Send Slack notifications when new leads are generated\nAdd customers to email marketing campaigns\nCreate tasks in project management tools',
        description: 'Describe what this Zap does in natural language. The AI will use this to understand when to trigger it.'
      },
      {
        id: 'payload',
        name: 'Data to Send (JSON)',
        type: 'textarea',
        required: false,
        placeholder: '{\n  "trigger_source": "ai_assistant",\n  "timestamp": "{{timestamp}}",\n  "user_message": "{{user_message}}",\n  "contact_name": "{{contact_name}}"\n}',
        description: 'JSON data to send to Zapier. Use {{timestamp}}, {{user_message}}, {{contact_name}} as dynamic variables.',
        defaultValue: '{\n  "trigger_source": "ai_assistant",\n  "timestamp": "{{timestamp}}",\n  "user_message": "{{user_message}}"\n}'
      },
      {
        id: 'confirmationMessage',
        name: 'Success Message',
        type: 'text',
        required: false,
        placeholder: 'Zap triggered successfully! Your automation is now running.',
        description: 'Message to show when the Zap is triggered successfully',
        defaultValue: 'Zap triggered successfully!'
      },
      {
        id: 'triggerKeywords',
        name: 'Trigger Keywords (Optional)',
        type: 'text',
        required: false,
        placeholder: 'activate, trigger, start, launch, execute',
        description: 'Comma-separated keywords that can trigger this Zap (optional - AI will use description)',
        defaultValue: ''
      }
    ],
    examples: [
      'Send Slack notifications when triggered by AI',
      'Add new leads to CRM systems automatically',
      'Create calendar events from voice commands',
      'Update spreadsheets with AI-generated data',
      'Trigger email campaigns based on conversations',
      'Post to social media when specific events occur'
    ],
    tags: ['zapier', 'automation', 'webhook', 'integration', 'workflow', 'zap']
  },
  {
    id: 'n8n-webhook',
    name: 'n8n Workflow',
    description: 'Connect to n8n workflows to automate complex processes. Trigger workflows and fetch data from your n8n instance.',
    category: 'action',
    icon: 'Workflow',
    color: '#ea4b71',
    requiresApiKey: false,
    fields: [
      {
        id: 'webhookUrl',
        name: 'n8n Webhook URL',
        type: 'url',
        required: true,
        placeholder: 'https://your-n8n.com/webhook/your-workflow-id',
        description: 'The webhook URL from your n8n workflow'
      },
      {
        id: 'workflowName',
        name: 'Workflow Name',
        type: 'text',
        required: true,
        placeholder: 'My Automation Workflow',
        description: 'A friendly name to identify this n8n workflow'
      },
      {
        id: 'description',
        name: 'What does this workflow do?',
        type: 'textarea',
        required: true,
        placeholder: 'Process customer data and sync with multiple systems\nGenerate reports and send via email\nMonitor APIs and send alerts when issues occur',
        description: 'Describe what this n8n workflow does in natural language. The AI will use this to understand when to trigger it.'
      },
      {
        id: 'payload',
        name: 'Data to Send (JSON)',
        type: 'textarea',
        required: false,
        placeholder: '{\n  "source": "ai_assistant",\n  "timestamp": "{{timestamp}}",\n  "user_input": "{{user_message}}",\n  "contact": "{{contact_name}}",\n  "workflow_trigger": "voice_command"\n}',
        description: 'JSON data to send to n8n. Use {{timestamp}}, {{user_message}}, {{contact_name}} as dynamic variables.',
        defaultValue: '{\n  "source": "ai_assistant",\n  "timestamp": "{{timestamp}}",\n  "user_input": "{{user_message}}"\n}'
      },
      {
        id: 'confirmationMessage',
        name: 'Success Message',
        type: 'text',
        required: false,
        placeholder: 'n8n workflow started successfully! Your automation is now processing.',
        description: 'Message to show when the workflow is triggered successfully',
        defaultValue: 'n8n workflow triggered successfully!'
      },
      {
        id: 'triggerKeywords',
        name: 'Trigger Keywords (Optional)',
        type: 'text',
        required: false,
        placeholder: 'process, analyze, generate, sync, monitor',
        description: 'Comma-separated keywords that can trigger this workflow (optional - AI will use description)',
        defaultValue: ''
      }
    ],
    examples: [
      'Process and analyze customer data automatically',
      'Generate comprehensive reports from multiple data sources',
      'Sync data between different business systems',
      'Monitor APIs and send alerts for issues',
      'Transform and clean data for analysis',
      'Automate complex multi-step business processes'
    ],
    tags: ['n8n', 'workflow', 'automation', 'webhook', 'integration', 'processing']
  },
  {
    id: 'webhook-trigger',
    name: 'Custom Webhook',
    description: 'Trigger custom webhooks with natural language commands and customizable payloads',
    category: 'action',
    icon: 'Send',
    color: '#dc2626',
    requiresApiKey: false,
    fields: [
      {
        id: 'webhookUrl',
        name: 'Webhook URL',
        type: 'url',
        required: true,
        placeholder: 'https://your-service.com/webhook/endpoint',
        description: 'The webhook URL to send POST requests to'
      },
      {
        id: 'description',
        name: 'Natural Language Description',
        type: 'textarea',
        required: true,
        placeholder: 'Activate marketing workflow for new leads\nTrigger customer onboarding sequence\nSend notification to sales team',
        description: 'Describe what this webhook does in natural language. The AI will use this to understand when to trigger it.',
        defaultValue: ''
      },
      {
        id: 'payload',
        name: 'Payload Template (JSON)',
        type: 'textarea',
        required: false,
        placeholder: '{\n  "action": "marketing_workflow",\n  "trigger": "manual",\n  "timestamp": "{{timestamp}}",\n  "user_input": "{{user_message}}",\n  "custom_data": {\n    "source": "ai_assistant"\n  }\n}',
        description: 'JSON payload template. Use {{timestamp}}, {{user_message}}, {{contact_name}} as dynamic variables.',
        defaultValue: '{\n  "action": "webhook_triggered",\n  "timestamp": "{{timestamp}}",\n  "user_input": "{{user_message}}",\n  "source": "ai_assistant"\n}'
      },
      {
        id: 'headers',
        name: 'Custom Headers (JSON)',
        type: 'textarea',
        required: false,
        placeholder: '{\n  "Authorization": "Bearer your-token",\n  "X-Custom-Header": "value"\n}',
        description: 'Additional HTTP headers to send with the webhook request',
        defaultValue: '{\n  "Content-Type": "application/json"\n}'
      },
      {
        id: 'confirmationMessage',
        name: 'Confirmation Message',
        type: 'text',
        required: false,
        placeholder: 'Marketing workflow has been activated successfully!',
        description: 'Message to show when webhook is triggered successfully',
        defaultValue: 'Webhook triggered successfully!'
      },
      {
        id: 'triggerKeywords',
        name: 'Trigger Keywords',
        type: 'text',
        required: false,
        placeholder: 'activate, trigger, start, launch, execute',
        description: 'Comma-separated keywords that can trigger this webhook (optional - AI will use description)',
        defaultValue: ''
      }
    ],
    examples: [
      'Activate marketing automation workflows',
      'Trigger customer onboarding sequences',
      'Send notifications to external systems',
      'Start data synchronization processes',
      'Launch email campaigns or notifications',
      'Trigger custom business logic and processes'
    ],
    tags: ['webhook', 'automation', 'trigger', 'custom', 'integration', 'workflow', 'action']
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Connect and manage Google Sheets with full CRUD operations using natural language commands',
    category: 'action',
    icon: 'FileSpreadsheet',
    color: '#34a853',
    requiresApiKey: false,
    fields: [
      {
        id: 'sheetUrl',
        name: 'Google Sheet URL',
        type: 'url',
        required: true,
        placeholder: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
        description: 'Paste the full Google Sheets URL here. The sheet ID will be automatically extracted.'
      },
      {
        id: 'sheetName',
        name: 'Integration Name',
        type: 'text',
        required: true,
        placeholder: 'Customer Database',
        description: 'Give this integration a descriptive name to identify it'
      },
      {
        id: 'description',
        name: 'What\'s in this spreadsheet?',
        type: 'textarea',
        required: true,
        placeholder: 'Customer contact information with names, emails, phone numbers, order history, and notes. Used for CRM and customer support.',
        description: 'Describe what data is in your spreadsheet so the AI knows how to help you with it'
      },
      {
        id: 'defaultSheet',
        name: 'Default Sheet/Tab Name',
        type: 'text',
        required: false,
        placeholder: 'Sheet1',
        description: 'Name of the specific tab/sheet to use by default (leave empty to use first sheet)',
        defaultValue: 'Sheet1'
      },
      {
        id: 'accessLevel',
        name: 'Access Level',
        type: 'select',
        required: true,
        options: [
          { value: 'read-only', label: 'Read Only - AI can only view data' },
          { value: 'read-write', label: 'Read & Write - AI can view, add, and edit data' }
        ],
        defaultValue: 'read-only',
        description: 'Choose whether the AI can modify your spreadsheet or just read from it'
      },
      {
        id: 'autoSync',
        name: 'Auto-sync Data',
        type: 'select',
        required: false,
        options: [
          { value: 'never', label: 'Never - Manual requests only' },
          { value: 'on-chat', label: 'On Chat Start - Sync when conversation begins' },
          { value: 'periodic', label: 'Periodic - Sync every 5 minutes' }
        ],
        defaultValue: 'never',
        description: 'When should the AI automatically refresh data from your spreadsheet?'
      }
    ],
    examples: [
      'Show me all customer data from my spreadsheet',
      'Add a new customer: John Doe, john@email.com, 555-1234',
      'Search for customers containing "Smith"',
      'Update cell B5 to "Completed"',
      'How many rows of data do I have?',
      'Show me the first 10 rows',
      'Add a new row with: Product A, $29.99, In Stock',
      'Find all entries where status is "Pending"',
      'What columns are in my spreadsheet?',
      'Export data from rows 5-15'
    ],
    tags: ['spreadsheet', 'data', 'google', 'sheets', 'database', 'crm', 'crud', 'automation']
  }
];

// Combined integrations
export const allIntegrations: Integration[] = [...sourceIntegrations, ...actionIntegrations];

export function getIntegrationById(id: string): Integration | undefined {
  return allIntegrations.find(integration => integration.id === id);
}

export function getIntegrationsByCategory(category: 'source' | 'action'): Integration[] {
  return allIntegrations.filter(integration => integration.category === category);
}