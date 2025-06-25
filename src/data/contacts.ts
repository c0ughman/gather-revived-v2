import { AIContact } from '../types';

export const defaultContacts: AIContact[] = [
  {
    id: '1',
    name: 'Agentic Andy',
    initials: 'AA',
    color: '#8b5cf6',
    description: 'An intelligent agent that can make API calls and fetch real-time data when you ask. Just tell me what information you need!',
    status: 'online',
    lastSeen: 'now',
    voice: 'Charon',
    avatar: '/media/profile-generic.png',
    integrations: [
      {
        id: 'api-tool-1',
        integrationId: 'api-request-tool',
        name: 'API Request Tool - Agentic Andy',
        config: {
          integrationId: 'api-request-tool',
          enabled: true,
          settings: {
            baseUrl: '',
            defaultHeaders: '{"Content-Type": "application/json"}',
            allowedDomains: 'api.github.com\napi.openweathermap.org\napi.coingecko.com\njsonplaceholder.typicode.com\nhttpbin.org'
          },
          trigger: 'chat-start',
          intervalMinutes: 30,
          description: 'Tool for making API requests when users ask for external data'
        },
        status: 'active'
      }
    ]
  },
  {
    id: '2',
    name: 'News Navigator',
    initials: 'NN',
    color: '#dc2626',
    description: 'Your personal news assistant. I stay updated with the latest headlines and can discuss current events from around the world.',
    status: 'online',
    lastSeen: '2 min ago',
    voice: 'Orus',
    integrations: [
      {
        id: 'news-1',
        integrationId: 'google-news',
        name: 'Google News - News Navigator',
        config: {
          integrationId: 'google-news',
          enabled: true,
          settings: {
            topic: 'technology',
            country: 'US',
            language: 'en'
          },
          trigger: 'both',
          intervalMinutes: 15,
          description: 'Fetches latest technology news every 15 minutes'
        },
        status: 'active'
      }
    ]
  },
  {
    id: '3',
    name: 'Market Maven',
    initials: 'MM',
    color: '#10b981',
    description: 'Financial markets expert with real-time access to cryptocurrency and stock data. Ask me about prices, trends, and market analysis.',
    status: 'online',
    lastSeen: '1 min ago',
    voice: 'Leda',
    avatar: '/media/profile-green.png',
    integrations: [
      {
        id: 'finance-1',
        integrationId: 'financial-markets',
        name: 'Financial Markets - Market Maven',
        config: {
          integrationId: 'financial-markets',
          enabled: true,
          settings: {
            dataType: 'crypto',
            symbols: 'bitcoin,ethereum,cardano,solana,chainlink',
            currency: 'usd'
          },
          trigger: 'both',
          intervalMinutes: 10,
          description: 'Tracks top cryptocurrency prices every 10 minutes'
        },
        status: 'active'
      }
    ]
  },
  {
    id: '4',
    name: 'Content Curator',
    initials: 'CC',
    color: '#f97316',
    description: 'I monitor RSS feeds and blogs to bring you the latest content from your favorite sources. Perfect for staying updated with specific publications.',
    status: 'busy',
    lastSeen: '5 min ago',
    voice: 'Fenrir',
    avatar: '/media/profile-blonde.png',
    integrations: [
      {
        id: 'rss-1',
        integrationId: 'rss-feeds',
        name: 'RSS Feeds - Content Curator',
        config: {
          integrationId: 'rss-feeds',
          enabled: true,
          settings: {
            feedUrl: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
            maxItems: '15'
          },
          trigger: 'both',
          intervalMinutes: 20,
          description: 'Monitors BBC Technology RSS feed for latest articles'
        },
        status: 'active'
      }
    ]
  },
  {
    id: '5',
    name: 'Domain Detective',
    initials: 'DD',
    color: '#059669',
    description: 'Your domain availability expert! I can check if domains are available and suggest creative variations for your business, project, or idea. Just tell me what you\'re looking for!',
    status: 'online',
    lastSeen: 'now',
    voice: 'Aoede',
    avatar: '/media/profile-pdfpete.png',
    integrations: [
      {
        id: 'domain-1',
        integrationId: 'domain-checker-tool',
        name: 'Domain Checker - Domain Detective',
        config: {
          integrationId: 'domain-checker-tool',
          enabled: true,
          settings: {
            variations: '{domain}.com\n{domain}.net\n{domain}.org\n{domain}.io\ntry{domain}.com\nget{domain}.com\n{domain}app.com\n{domain}hub.com\n{domain}pro.com\nmy{domain}.com',
            maxConcurrent: '5'
          },
          trigger: 'chat-start',
          intervalMinutes: 60,
          description: 'Check domain availability with multiple variations'
        },
        status: 'active'
      }
    ]
  },
  {
    id: '6',
    name: 'Workflow Wizard',
    initials: 'WW',
    color: '#dc2626',
    description: 'Your automation assistant! I can trigger various workflows and integrations through natural language commands. Just tell me what you want to activate, start, or execute!',
    status: 'online',
    lastSeen: 'now',
    voice: 'Zephyr',
    avatar: '/media/profile-greg.png',
    integrations: [
      {
        id: 'webhook-1',
        integrationId: 'webhook-trigger',
        name: 'Marketing Automation - Workflow Wizard',
        config: {
          integrationId: 'webhook-trigger',
          enabled: true,
          settings: {
            webhookUrl: 'https://hooks.zapier.com/hooks/catch/123456/marketing',
            description: 'Activate marketing workflow for new leads and customer engagement campaigns',
            payload: '{\n  "action": "marketing_activation",\n  "trigger": "ai_assistant",\n  "timestamp": "{{timestamp}}",\n  "user_request": "{{user_message}}",\n  "contact": "{{contact_name}}",\n  "workflow_type": "marketing",\n  "priority": "high"\n}',
            headers: '{\n  "Content-Type": "application/json",\n  "X-Source": "AI-Assistant",\n  "Authorization": "Bearer demo-token"\n}',
            confirmationMessage: 'Marketing workflow has been activated successfully! Your campaign is now running.',
            triggerKeywords: 'marketing, campaign, email, promotion, leads'
          },
          trigger: 'manual',
          intervalMinutes: 0,
          description: 'Trigger marketing automation workflows'
        },
        status: 'active'
      },
      {
        id: 'webhook-2',
        integrationId: 'webhook-trigger',
        name: 'Customer Onboarding - Workflow Wizard',
        config: {
          integrationId: 'webhook-trigger',
          enabled: true,
          settings: {
            webhookUrl: 'https://hooks.zapier.com/hooks/catch/123456/onboarding',
            description: 'Start customer onboarding sequence for new user registration and welcome process',
            payload: '{\n  "action": "onboarding_start",\n  "trigger": "ai_assistant",\n  "timestamp": "{{timestamp}}",\n  "user_request": "{{user_message}}",\n  "contact": "{{contact_name}}",\n  "workflow_type": "onboarding",\n  "send_welcome_email": true,\n  "setup_account": true\n}',
            headers: '{\n  "Content-Type": "application/json",\n  "X-Source": "AI-Assistant"\n}',
            confirmationMessage: 'Customer onboarding sequence has been initiated! Welcome emails and account setup are in progress.',
            triggerKeywords: 'onboarding, welcome, new customer, registration, setup'
          },
          trigger: 'manual',
          intervalMinutes: 0,
          description: 'Trigger customer onboarding workflows'
        },
        status: 'active'
      },
      {
        id: 'webhook-3',
        integrationId: 'webhook-trigger',
        name: 'Sales Notification - Workflow Wizard',
        config: {
          integrationId: 'webhook-trigger',
          enabled: true,
          settings: {
            webhookUrl: 'https://hooks.zapier.com/hooks/catch/123456/sales',
            description: 'Send urgent notifications to sales team about hot leads and opportunities',
            payload: '{\n  "action": "sales_notification",\n  "trigger": "ai_assistant",\n  "timestamp": "{{timestamp}}",\n  "user_request": "{{user_message}}",\n  "contact": "{{contact_name}}",\n  "priority": "urgent",\n  "notification_type": "slack_and_email"\n}',
            headers: '{\n  "Content-Type": "application/json",\n  "X-Source": "AI-Assistant"\n}',
            confirmationMessage: 'Sales team has been notified! They will receive the alert via Slack and email.',
            triggerKeywords: 'sales, notify, alert, team, urgent, lead'
          },
          trigger: 'manual',
          intervalMinutes: 0,
          description: 'Send notifications to sales team'
        },
        status: 'active'
      }
    ]
  },
  {
    id: '7',
    name: 'Spreadsheet Specialist',
    initials: 'SS',
    color: '#34a853',
    description: 'Your Google Sheets expert! I can read, write, search, and manage your spreadsheet data with natural language commands. Just tell me what you need - view data, add rows, search for information, or update cells!',
    status: 'online',
    lastSeen: 'now',
    voice: 'Fenrir',
    integrations: [
      {
        id: 'sheets-1',
        integrationId: 'google-sheets',
        name: 'Customer Database - Spreadsheet Specialist',
        config: {
          integrationId: 'google-sheets',
          enabled: true,
          settings: {
            sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
            sheetName: 'Customer Database',
            description: 'Customer contact information database with names, emails, phone numbers, order history, and notes. Contains customer data for CRM and support.',
            defaultSheet: 'Sheet1',
            accessLevel: 'read-write',
            autoSync: 'never'
          },
          trigger: 'manual',
          intervalMinutes: 0,
          description: 'Customer database with full read/write access'
        },
        status: 'active'
      },
      {
        id: 'sheets-2',
        integrationId: 'google-sheets',
        name: 'Sales Tracking - Spreadsheet Specialist',
        config: {
          integrationId: 'google-sheets',
          enabled: true,
          settings: {
            sheetUrl: 'https://docs.google.com/spreadsheets/d/1mHIWnDvW9cALRMq9OdNfRejjKNUAdZs-8ywcT5UJWds/edit',
            sheetName: 'Sales Tracking',
            description: 'Sales pipeline and revenue tracking sheet with deals, amounts, stages, and dates. Used for sales reporting and forecasting.',
            defaultSheet: 'Sales Pipeline',
            accessLevel: 'read-only',
            autoSync: 'on-chat'
          },
          trigger: 'chat-start',
          intervalMinutes: 0,
          description: 'Sales pipeline data (read-only access)'
        },
        status: 'active'
      },
      {
        id: 'sheets-3',
        integrationId: 'google-sheets',
        name: 'Inventory Management - Spreadsheet Specialist',
        config: {
          integrationId: 'google-sheets',
          enabled: true,
          settings: {
            sheetUrl: 'https://docs.google.com/spreadsheets/d/1fE4vP9rTcZyH3qBz6LQ8vNjK2xM9PnW4cY7sD8aR5uT/edit',
            sheetName: 'Inventory Management',
            description: 'Product inventory tracking with item names, SKUs, quantities, locations, and reorder levels. Used for stock management and ordering.',
            defaultSheet: 'Inventory',
            accessLevel: 'read-write',
            autoSync: 'periodic'
          },
          trigger: 'both',
          intervalMinutes: 5,
          description: 'Product inventory with real-time sync'
        },
        status: 'active'
      }
    ]
  }
];