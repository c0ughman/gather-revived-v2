import { IntegrationTemplate } from '../types/integrations';

export const integrationTemplates: IntegrationTemplate[] = [
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Send and receive data via HTTP webhooks. Perfect for connecting with any service that supports webhooks.',
    category: 'action',
    icon: 'Webhook',
    color: '#10b981',
    requires_api_key: false,
    requires_oauth: false,
    config_schema: {
      type: 'object',
      properties: {
        webhook_url: {
          type: 'string',
          title: 'Webhook URL',
          description: 'The URL to send webhook requests to'
        },
        method: {
          type: 'string',
          title: 'HTTP Method',
          enum: ['GET', 'POST', 'PUT', 'PATCH'],
          default: 'POST'
        },
        headers: {
          type: 'object',
          title: 'Custom Headers',
          description: 'Additional headers to send with requests'
        },
        trigger_type: {
          type: 'string',
          title: 'Trigger Type',
          enum: ['manual', 'periodic', 'chat-start', 'both'],
          default: 'manual'
        },
        interval_minutes: {
          type: 'number',
          title: 'Interval (minutes)',
          description: 'How often to fetch data (for periodic triggers)',
          minimum: 1,
          maximum: 1440
        }
      },
      required: ['webhook_url']
    },
    setup_fields: [
      {
        key: 'webhook_url',
        label: 'Webhook URL',
        type: 'url',
        required: true,
        placeholder: 'https://your-service.com/webhook'
      },
      {
        key: 'method',
        label: 'HTTP Method',
        type: 'select',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' }
        ],
        default: 'POST'
      },
      {
        key: 'trigger_type',
        label: 'When to trigger',
        type: 'select',
        options: [
          { value: 'manual', label: 'Manual (AI can call when needed)' },
          { value: 'periodic', label: 'Periodic (fetch data regularly)' },
          { value: 'chat-start', label: 'Chat start (fetch when conversation begins)' },
          { value: 'both', label: 'Both periodic and chat start' }
        ],
        default: 'manual'
      },
      {
        key: 'interval_minutes',
        label: 'Fetch interval (minutes)',
        type: 'number',
        placeholder: '60',
        condition: { field: 'trigger_type', values: ['periodic', 'both'] }
      }
    ],
    examples: [
      {
        title: 'Send notification',
        description: 'Send a notification to an external service',
        config: {
          webhook_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
          method: 'POST'
        }
      }
    ],
    tags: ['webhook', 'http', 'api', 'notifications'],
    difficulty_level: 'beginner',
    is_featured: true,
    documentation_url: 'https://example.com/webhook-docs'
  },
  {
    id: 'n8n',
    name: 'n8n Workflow',
    description: 'Connect to n8n workflows to automate complex processes. Trigger workflows and fetch data from your n8n instance.',
    category: 'action',
    icon: 'Workflow',
    color: '#ea4b71',
    requires_api_key: false,
    requires_oauth: false,
    config_schema: {
      type: 'object',
      properties: {
        webhook_url: {
          type: 'string',
          title: 'n8n Webhook URL',
          description: 'The webhook URL from your n8n workflow'
        },
        method: {
          type: 'string',
          title: 'HTTP Method',
          enum: ['GET', 'POST', 'PUT', 'PATCH'],
          default: 'POST'
        },
        headers: {
          type: 'object',
          title: 'Custom Headers',
          description: 'Additional headers to send with requests (e.g., authentication)'
        },
        trigger_type: {
          type: 'string',
          title: 'Trigger Type',
          enum: ['manual', 'periodic', 'chat-start', 'both'],
          default: 'manual'
        },
        interval_minutes: {
          type: 'number',
          title: 'Interval (minutes)',
          description: 'How often to fetch data (for periodic triggers)',
          minimum: 1,
          maximum: 1440
        },
        workflow_name: {
          type: 'string',
          title: 'Workflow Name',
          description: 'Name of the n8n workflow for reference'
        }
      },
      required: ['webhook_url']
    },
    setup_fields: [
      {
        key: 'webhook_url',
        label: 'n8n Webhook URL',
        type: 'url',
        required: true,
        placeholder: 'https://your-n8n.com/webhook/your-workflow-id'
      },
      {
        key: 'workflow_name',
        label: 'Workflow Name',
        type: 'text',
        placeholder: 'My Automation Workflow',
        description: 'A friendly name to identify this workflow'
      },
      {
        key: 'method',
        label: 'HTTP Method',
        type: 'select',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' }
        ],
        default: 'POST'
      },
      {
        key: 'trigger_type',
        label: 'When to trigger',
        type: 'select',
        options: [
          { value: 'manual', label: 'Manual (AI can call when needed)' },
          { value: 'periodic', label: 'Periodic (fetch data regularly)' },
          { value: 'chat-start', label: 'Chat start (fetch when conversation begins)' },
          { value: 'both', label: 'Both periodic and chat start' }
        ],
        default: 'manual'
      },
      {
        key: 'interval_minutes',
        label: 'Fetch interval (minutes)',
        type: 'number',
        placeholder: '60',
        condition: { field: 'trigger_type', values: ['periodic', 'both'] }
      }
    ],
    examples: [
      {
        title: 'Data Processing Workflow',
        description: 'Trigger an n8n workflow to process and analyze data',
        config: {
          webhook_url: 'https://n8n.example.com/webhook/data-processor',
          method: 'POST',
          workflow_name: 'Data Analysis Pipeline'
        }
      },
      {
        title: 'CRM Integration',
        description: 'Sync customer data with your CRM through n8n',
        config: {
          webhook_url: 'https://n8n.example.com/webhook/crm-sync',
          method: 'POST',
          workflow_name: 'CRM Customer Sync'
        }
      }
    ],
    tags: ['n8n', 'workflow', 'automation', 'integration'],
    difficulty_level: 'intermediate',
    is_featured: true,
    documentation_url: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/'
  },
  {
    id: 'zapier',
    name: 'Zapier Webhook',
    description: 'Connect to Zapier webhooks to trigger Zaps and automate workflows across 5000+ apps.',
    category: 'action',
    icon: 'Zap',
    color: '#ff4a00',
    requires_api_key: false,
    requires_oauth: false,
    config_schema: {
      type: 'object',
      properties: {
        webhook_url: {
          type: 'string',
          title: 'Zapier Webhook URL',
          description: 'The webhook URL from your Zapier trigger'
        },
        method: {
          type: 'string',
          title: 'HTTP Method',
          enum: ['GET', 'POST', 'PUT', 'PATCH'],
          default: 'POST'
        },
        headers: {
          type: 'object',
          title: 'Custom Headers',
          description: 'Additional headers to send with requests'
        },
        trigger_type: {
          type: 'string',
          title: 'Trigger Type',
          enum: ['manual', 'periodic', 'chat-start', 'both'],
          default: 'manual'
        },
        interval_minutes: {
          type: 'number',
          title: 'Interval (minutes)',
          description: 'How often to fetch data (for periodic triggers)',
          minimum: 1,
          maximum: 1440
        },
        zap_name: {
          type: 'string',
          title: 'Zap Name',
          description: 'Name of the Zapier Zap for reference'
        }
      },
      required: ['webhook_url']
    },
    setup_fields: [
      {
        key: 'webhook_url',
        label: 'Zapier Webhook URL',
        type: 'url',
        required: true,
        placeholder: 'https://hooks.zapier.com/hooks/catch/your-hook-id'
      },
      {
        key: 'zap_name',
        label: 'Zap Name',
        type: 'text',
        placeholder: 'My Automation Zap',
        description: 'A friendly name to identify this Zap'
      },
      {
        key: 'method',
        label: 'HTTP Method',
        type: 'select',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' }
        ],
        default: 'POST'
      },
      {
        key: 'trigger_type',
        label: 'When to trigger',
        type: 'select',
        options: [
          { value: 'manual', label: 'Manual (AI can call when needed)' },
          { value: 'periodic', label: 'Periodic (fetch data regularly)' },
          { value: 'chat-start', label: 'Chat start (fetch when conversation begins)' },
          { value: 'both', label: 'Both periodic and chat start' }
        ],
        default: 'manual'
      },
      {
        key: 'interval_minutes',
        label: 'Fetch interval (minutes)',
        type: 'number',
        placeholder: '60',
        condition: { field: 'trigger_type', values: ['periodic', 'both'] }
      }
    ],
    examples: [
      {
        title: 'Slack Notification',
        description: 'Send messages to Slack when triggered by AI',
        config: {
          webhook_url: 'https://hooks.zapier.com/hooks/catch/123456/abcdef',
          method: 'POST',
          zap_name: 'AI to Slack Notifications'
        }
      },
      {
        title: 'Google Sheets Update',
        description: 'Add data to Google Sheets through Zapier',
        config: {
          webhook_url: 'https://hooks.zapier.com/hooks/catch/789012/ghijkl',
          method: 'POST',
          zap_name: 'AI Data to Sheets'
        }
      },
      {
        title: 'Email Automation',
        description: 'Trigger email campaigns based on AI interactions',
        config: {
          webhook_url: 'https://hooks.zapier.com/hooks/catch/345678/mnopqr',
          method: 'POST',
          zap_name: 'AI Email Triggers'
        }
      }
    ],
    tags: ['zapier', 'automation', 'webhook', 'integration'],
    difficulty_level: 'beginner',
    is_featured: true,
    documentation_url: 'https://zapier.com/help/create/code-webhooks/trigger-zaps-from-webhooks'
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Read from and write to Google Sheets. Perfect for data analysis, reporting, and content management.',
    category: 'source',
    icon: 'Sheet',
    color: '#0f9d58',
    requires_api_key: true,
    requires_oauth: false,
    config_schema: {
      type: 'object',
      properties: {
        spreadsheet_id: {
          type: 'string',
          title: 'Spreadsheet ID',
          description: 'The ID of your Google Sheets document'
        },
        sheet_name: {
          type: 'string',
          title: 'Sheet Name',
          description: 'Name of the specific sheet/tab to access',
          default: 'Sheet1'
        },
        range: {
          type: 'string',
          title: 'Cell Range',
          description: 'Range of cells to read (e.g., A1:D10)',
          default: 'A1:Z1000'
        },
        api_key: {
          type: 'string',
          title: 'Google API Key',
          description: 'Your Google Sheets API key'
        }
      },
      required: ['spreadsheet_id', 'api_key']
    },
    setup_fields: [
      {
        key: 'spreadsheet_id',
        label: 'Spreadsheet ID',
        type: 'text',
        required: true,
        placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        description: 'Found in the Google Sheets URL'
      },
      {
        key: 'sheet_name',
        label: 'Sheet Name',
        type: 'text',
        placeholder: 'Sheet1',
        description: 'The name of the tab in your spreadsheet'
      },
      {
        key: 'range',
        label: 'Cell Range',
        type: 'text',
        placeholder: 'A1:D10',
        description: 'Range of cells to read (e.g., A1:D10 or A:A for entire column)'
      },
      {
        key: 'api_key',
        label: 'Google API Key',
        type: 'password',
        required: true,
        description: 'Create one in Google Cloud Console'
      }
    ],
    examples: [
      {
        title: 'Customer Database',
        description: 'Access customer information from a Google Sheet',
        config: {
          spreadsheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          sheet_name: 'Customers',
          range: 'A1:E100'
        }
      }
    ],
    tags: ['google', 'sheets', 'spreadsheet', 'data'],
    difficulty_level: 'intermediate',
    is_featured: true,
    documentation_url: 'https://developers.google.com/sheets/api'
  },
  {
    id: 'api-request',
    name: 'API Request',
    description: 'Make HTTP requests to any REST API. Fetch data from external services or trigger actions.',
    category: 'source',
    icon: 'Globe',
    color: '#6366f1',
    requires_api_key: false,
    requires_oauth: false,
    config_schema: {
      type: 'object',
      properties: {
        base_url: {
          type: 'string',
          title: 'Base URL',
          description: 'The base URL for the API'
        },
        endpoints: {
          type: 'array',
          title: 'Endpoints',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              path: { type: 'string' },
              method: { type: 'string' }
            }
          }
        },
        headers: {
          type: 'object',
          title: 'Default Headers',
          description: 'Headers to include with all requests'
        },
        auth_type: {
          type: 'string',
          title: 'Authentication Type',
          enum: ['none', 'bearer', 'api_key', 'basic'],
          default: 'none'
        }
      },
      required: ['base_url']
    },
    setup_fields: [
      {
        key: 'base_url',
        label: 'API Base URL',
        type: 'url',
        required: true,
        placeholder: 'https://api.example.com'
      },
      {
        key: 'auth_type',
        label: 'Authentication Type',
        type: 'select',
        options: [
          { value: 'none', label: 'None' },
          { value: 'bearer', label: 'Bearer Token' },
          { value: 'api_key', label: 'API Key' },
          { value: 'basic', label: 'Basic Auth' }
        ],
        default: 'none'
      }
    ],
    examples: [
      {
        title: 'Weather API',
        description: 'Fetch weather data from a public API',
        config: {
          base_url: 'https://api.openweathermap.org/data/2.5',
          auth_type: 'api_key'
        }
      }
    ],
    tags: ['api', 'http', 'rest', 'external'],
    difficulty_level: 'intermediate',
    is_featured: false
  }
];