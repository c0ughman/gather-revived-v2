/*
  # Populate Integration Templates

  1. New Data
    - Populate `integration_templates` table with all integration definitions from the application
    - Includes both source and action integrations with complete metadata
    - Maps all integration IDs, names, descriptions, categories, and configuration schemas

  2. Data Structure
    - Source integrations: HTTP requests, Google News, RSS feeds, Financial markets, Notion OAuth source
    - Action integrations: API request tool, Domain checker, Zapier webhook, n8n webhook, Custom webhook, Google Sheets, Notion OAuth action
    - Each integration includes proper categorization, difficulty levels, and feature flags

  3. Configuration
    - All integrations marked as active by default
    - Proper difficulty levels assigned (beginner/intermediate/advanced)
    - OAuth requirements and API key requirements properly set
    - Setup fields and configuration schemas included for each integration
*/

-- Clear existing data to avoid conflicts
DELETE FROM integration_templates;

-- Insert source integrations
INSERT INTO integration_templates (
  id, name, description, category, icon, color, requires_api_key, requires_oauth,
  config_schema, setup_fields, examples, tags, difficulty_level, is_featured, is_active, provider, version
) VALUES 
(
  'http-requests',
  'HTTP API Requests',
  'Make HTTP requests to any API endpoint',
  'source',
  'Globe',
  '#3b82f6',
  false,
  false,
  '{"url": {"type": "string", "required": true}, "method": {"type": "string", "required": true}, "headers": {"type": "object"}, "body": {"type": "string"}}',
  '[
    {"id": "url", "name": "API URL", "type": "url", "required": true, "placeholder": "https://api.example.com/data", "description": "The URL endpoint to make the request to"},
    {"id": "method", "name": "HTTP Method", "type": "select", "required": true, "options": [{"value": "GET", "label": "GET"}, {"value": "POST", "label": "POST"}, {"value": "PUT", "label": "PUT"}, {"value": "DELETE", "label": "DELETE"}], "defaultValue": "GET", "description": "HTTP method to use for the request"},
    {"id": "headers", "name": "Headers (JSON)", "type": "textarea", "required": false, "placeholder": "{\"Content-Type\": \"application/json\", \"Authorization\": \"Bearer token\"}", "description": "HTTP headers as JSON object", "defaultValue": "{}"},
    {"id": "body", "name": "Request Body", "type": "textarea", "required": false, "placeholder": "{\"key\": \"value\"}", "description": "Request body for POST/PUT requests"}
  ]',
  '["Fetch weather data from OpenWeatherMap", "Get user information from GitHub API", "Post data to a webhook", "Retrieve cryptocurrency prices"]',
  '["api", "http", "rest", "web", "data"]',
  'beginner',
  true,
  true,
  null,
  '1.0.0'
),
(
  'google-news',
  'Google News',
  'Fetch latest news articles from Google News',
  'source',
  'Newspaper',
  '#dc2626',
  false,
  false,
  '{"topic": {"type": "string", "required": true}, "country": {"type": "string", "required": true}, "language": {"type": "string", "required": true}}',
  '[
    {"id": "topic", "name": "Topic", "type": "text", "required": true, "placeholder": "technology", "description": "News topic to search for", "defaultValue": "technology"},
    {"id": "country", "name": "Country", "type": "select", "required": true, "options": [{"value": "US", "label": "United States"}, {"value": "GB", "label": "United Kingdom"}, {"value": "CA", "label": "Canada"}, {"value": "AU", "label": "Australia"}, {"value": "DE", "label": "Germany"}, {"value": "FR", "label": "France"}, {"value": "JP", "label": "Japan"}], "defaultValue": "US", "description": "Country for localized news"},
    {"id": "language", "name": "Language", "type": "select", "required": true, "options": [{"value": "en", "label": "English"}, {"value": "es", "label": "Spanish"}, {"value": "fr", "label": "French"}, {"value": "de", "label": "German"}, {"value": "ja", "label": "Japanese"}], "defaultValue": "en", "description": "Language for news articles"}
  ]',
  '["Latest technology news from the US", "Breaking news in multiple languages", "Country-specific news updates", "Topic-based news aggregation"]',
  '["news", "google", "articles", "current events", "media"]',
  'beginner',
  true,
  true,
  null,
  '1.0.0'
),
(
  'rss-feeds',
  'RSS Feed Reader',
  'Parse and read RSS/Atom feeds from any website',
  'source',
  'Rss',
  '#f97316',
  false,
  false,
  '{"feedUrl": {"type": "string", "required": true}, "maxItems": {"type": "number"}}',
  '[
    {"id": "feedUrl", "name": "RSS Feed URL", "type": "url", "required": true, "placeholder": "https://feeds.bbci.co.uk/news/rss.xml", "description": "URL of the RSS or Atom feed"},
    {"id": "maxItems", "name": "Max Items", "type": "number", "required": false, "placeholder": "10", "description": "Maximum number of items to fetch", "defaultValue": "10"}
  ]',
  '["BBC News RSS feed", "Tech blog updates", "Podcast episode feeds", "Company blog notifications"]',
  '["rss", "feeds", "xml", "syndication", "blogs"]',
  'beginner',
  false,
  true,
  null,
  '1.0.0'
),
(
  'financial-markets',
  'Financial Markets Data',
  'Get real-time cryptocurrency and stock market data',
  'source',
  'TrendingUp',
  '#10b981',
  false,
  false,
  '{"dataType": {"type": "string", "required": true}, "symbols": {"type": "string", "required": true}, "currency": {"type": "string", "required": true}}',
  '[
    {"id": "dataType", "name": "Data Type", "type": "select", "required": true, "options": [{"value": "crypto", "label": "Cryptocurrency"}, {"value": "stocks", "label": "Stock Market"}, {"value": "forex", "label": "Foreign Exchange"}], "defaultValue": "crypto", "description": "Type of financial data to fetch"},
    {"id": "symbols", "name": "Symbols", "type": "text", "required": true, "placeholder": "bitcoin,ethereum,cardano", "description": "Comma-separated list of symbols to track", "defaultValue": "bitcoin,ethereum,cardano"},
    {"id": "currency", "name": "Currency", "type": "select", "required": true, "options": [{"value": "usd", "label": "USD"}, {"value": "eur", "label": "EUR"}, {"value": "gbp", "label": "GBP"}, {"value": "jpy", "label": "JPY"}], "defaultValue": "usd", "description": "Base currency for prices"}
  ]',
  '["Bitcoin and Ethereum prices in USD", "Top 10 cryptocurrency market data", "Stock prices for major companies", "Foreign exchange rates"]',
  '["finance", "crypto", "stocks", "trading", "markets", "prices"]',
  'intermediate',
  true,
  true,
  null,
  '1.0.0'
),
(
  'notion-oauth-source',
  'Notion (OAuth)',
  'Connect to your Notion workspace to read pages, databases, and content automatically',
  'source',
  'FileText',
  '#000000',
  false,
  true,
  '{"dataType": {"type": "string", "required": true}, "includeContent": {"type": "string"}}',
  '[
    {"id": "dataType", "name": "Data to Fetch", "type": "select", "required": true, "options": [{"value": "pages", "label": "Pages"}, {"value": "databases", "label": "Databases"}, {"value": "both", "label": "Pages and Databases"}], "defaultValue": "both", "description": "What type of Notion content to fetch"},
    {"id": "includeContent", "name": "Include Page Content", "type": "select", "required": false, "options": [{"value": "true", "label": "Yes - Include full content"}, {"value": "false", "label": "No - Metadata only"}], "defaultValue": "true", "description": "Whether to fetch full page content or just metadata"}
  ]',
  '["Sync your Notion pages for AI reference", "Monitor database changes automatically", "Access your knowledge base content", "Track project updates from Notion"]',
  '["notion", "oauth", "pages", "databases", "knowledge", "sync"]',
  'intermediate',
  true,
  true,
  'notion',
  '1.0.0'
);

-- Insert action integrations
INSERT INTO integration_templates (
  id, name, description, category, icon, color, requires_api_key, requires_oauth,
  config_schema, setup_fields, examples, tags, difficulty_level, is_featured, is_active, provider, version
) VALUES 
(
  'api-request-tool',
  'API Request Tool',
  'Make HTTP API requests when requested by the user',
  'action',
  'Zap',
  '#8b5cf6',
  false,
  false,
  '{"baseUrl": {"type": "string"}, "defaultHeaders": {"type": "object"}, "allowedDomains": {"type": "array"}}',
  '[
    {"id": "baseUrl", "name": "Base URL (Optional)", "type": "url", "required": false, "placeholder": "https://api.example.com", "description": "Default base URL for API requests"},
    {"id": "defaultHeaders", "name": "Default Headers (JSON)", "type": "textarea", "required": false, "placeholder": "{\"Authorization\": \"Bearer token\", \"Content-Type\": \"application/json\"}", "description": "Default headers to include with requests", "defaultValue": "{\"Content-Type\": \"application/json\"}"},
    {"id": "allowedDomains", "name": "Allowed Domains", "type": "textarea", "required": false, "placeholder": "api.example.com\\napi.github.com\\napi.openweathermap.org", "description": "Whitelist of allowed domains (one per line). Leave empty to allow all."}
  ]',
  '["Make API calls when user asks for data", "Fetch information from external services", "Post data to webhooks on command", "Integrate with third-party APIs dynamically"]',
  '["tool", "api", "function", "action", "dynamic", "request"]',
  'advanced',
  true,
  true,
  null,
  '1.0.0'
),
(
  'domain-checker-tool',
  'Domain Availability Checker',
  'Check domain availability using RDAP with customizable variations',
  'action',
  'Globe',
  '#059669',
  false,
  false,
  '{"variations": {"type": "array"}, "maxConcurrent": {"type": "number"}}',
  '[
    {"id": "variations", "name": "Domain Variations", "type": "textarea", "required": false, "placeholder": "{domain}.com\\n{domain}.net\\n{domain}.org\\ntry{domain}.com\\n{domain}app.com\\nget{domain}.com", "description": "Domain variations to check. Use {domain} as placeholder for the base domain name.", "defaultValue": "{domain}.com\\n{domain}.net\\n{domain}.org\\ntry{domain}.com\\n{domain}app.com"},
    {"id": "maxConcurrent", "name": "Max Concurrent Checks", "type": "number", "required": false, "placeholder": "5", "description": "Maximum number of domains to check simultaneously", "defaultValue": "5"}
  ]',
  '["Check if mycompany.com is available", "Find available domain variations for a startup name", "Bulk check domain availability with custom patterns", "Discover alternative domains for branding"]',
  '["domain", "availability", "rdap", "registration", "dns", "tool"]',
  'intermediate',
  false,
  true,
  null,
  '1.0.0'
),
(
  'zapier-webhook',
  'Zapier Webhook',
  'Connect to Zapier webhooks to trigger Zaps and automate workflows across 5000+ apps',
  'action',
  'Zap',
  '#ff4a00',
  false,
  false,
  '{"webhookUrl": {"type": "string", "required": true}, "zapName": {"type": "string", "required": true}, "description": {"type": "string", "required": true}, "payload": {"type": "object"}, "confirmationMessage": {"type": "string"}, "triggerKeywords": {"type": "array"}}',
  '[
    {"id": "webhookUrl", "name": "Zapier Webhook URL", "type": "url", "required": true, "placeholder": "https://hooks.zapier.com/hooks/catch/123456/abcdef", "description": "The webhook URL from your Zapier trigger"},
    {"id": "zapName", "name": "Zap Name", "type": "text", "required": true, "placeholder": "My Automation Zap", "description": "A friendly name to identify this Zap"},
    {"id": "description", "name": "What does this Zap do?", "type": "textarea", "required": true, "placeholder": "Send Slack notifications when new leads are generated\\nAdd customers to email marketing campaigns\\nCreate tasks in project management tools", "description": "Describe what this Zap does in natural language. The AI will use this to understand when to trigger it."},
    {"id": "payload", "name": "Data to Send (Optional)", "type": "textarea", "required": false, "placeholder": "{\\n  \"trigger_source\": \"ai_assistant\",\\n  \"timestamp\": \"{{timestamp}}\",\\n  \"user_message\": \"{{user_message}}\",\\n  \"contact_name\": \"{{contact_name}}\"\\n}", "description": "Leave it blank for the Agent to create the data structure itself (could lead to errors). JSON data to send to Zapier. Use {{timestamp}}, {{user_message}}, {{contact_name}} as dynamic variables."},
    {"id": "confirmationMessage", "name": "Success Message", "type": "text", "required": false, "placeholder": "Zap triggered successfully! Your automation is now running.", "description": "Message to show when the Zap is triggered successfully", "defaultValue": "Zap triggered successfully!"},
    {"id": "triggerKeywords", "name": "Trigger Keywords (Optional)", "type": "text", "required": false, "placeholder": "activate, trigger, start, launch, execute", "description": "Comma-separated keywords that can trigger this Zap (optional - AI will use description)", "defaultValue": ""}
  ]',
  '["Send Slack notifications when triggered by AI", "Add new leads to CRM systems automatically", "Create calendar events from voice commands", "Update spreadsheets with AI-generated data", "Trigger email campaigns based on conversations", "Post to social media when specific events occur"]',
  '["zapier", "automation", "webhook", "integration", "workflow", "zap"]',
  'beginner',
  true,
  true,
  'zapier',
  '1.0.0'
),
(
  'n8n-webhook',
  'n8n Workflow',
  'Connect to n8n workflows to automate complex processes. Trigger workflows and fetch data from your n8n instance.',
  'action',
  'Workflow',
  '#ea4b71',
  false,
  false,
  '{"webhookUrl": {"type": "string", "required": true}, "workflowName": {"type": "string", "required": true}, "description": {"type": "string", "required": true}, "payload": {"type": "object"}, "confirmationMessage": {"type": "string"}, "triggerKeywords": {"type": "array"}}',
  '[
    {"id": "webhookUrl", "name": "n8n Webhook URL", "type": "url", "required": true, "placeholder": "https://your-n8n.com/webhook/your-workflow-id", "description": "The webhook URL from your n8n workflow"},
    {"id": "workflowName", "name": "Workflow Name", "type": "text", "required": true, "placeholder": "My Automation Workflow", "description": "A friendly name to identify this n8n workflow"},
    {"id": "description", "name": "What does this workflow do?", "type": "textarea", "required": true, "placeholder": "Process customer data and sync with multiple systems\\nGenerate reports and send via email\\nMonitor APIs and send alerts when issues occur", "description": "Describe what this n8n workflow does in natural language. The AI will use this to understand when to trigger it."},
    {"id": "payload", "name": "Data to Send (Optional)", "type": "textarea", "required": false, "placeholder": "{\\n  \"source\": \"ai_assistant\",\\n  \"timestamp\": \"{{timestamp}}\",\\n  \"user_input\": \"{{user_message}}\",\\n  \"contact\": \"{{contact_name}}\",\\n  \"workflow_trigger\": \"voice_command\"\\n}", "description": "Leave it blank for the Agent to create the data structure itself (could lead to errors). JSON data to send to n8n. Use {{timestamp}}, {{user_message}}, {{contact_name}} as dynamic variables."},
    {"id": "confirmationMessage", "name": "Success Message", "type": "text", "required": false, "placeholder": "n8n workflow started successfully! Your automation is now processing.", "description": "Message to show when the workflow is triggered successfully", "defaultValue": "n8n workflow triggered successfully!"},
    {"id": "triggerKeywords", "name": "Trigger Keywords (Optional)", "type": "text", "required": false, "placeholder": "process, analyze, generate, sync, monitor", "description": "Comma-separated keywords that can trigger this workflow (optional - AI will use description)", "defaultValue": ""}
  ]',
  '["Process and analyze customer data automatically", "Generate comprehensive reports from multiple data sources", "Sync data between different business systems", "Monitor APIs and send alerts for issues", "Transform and clean data for analysis", "Automate complex multi-step business processes"]',
  '["n8n", "workflow", "automation", "webhook", "integration", "processing"]',
  'intermediate',
  true,
  true,
  'n8n',
  '1.0.0'
),
(
  'webhook-trigger',
  'Custom Webhook',
  'Trigger custom webhooks with natural language commands and customizable payloads',
  'action',
  'Send',
  '#dc2626',
  false,
  false,
  '{"webhookUrl": {"type": "string", "required": true}, "description": {"type": "string", "required": true}, "payload": {"type": "object"}, "headers": {"type": "object"}, "confirmationMessage": {"type": "string"}, "triggerKeywords": {"type": "array"}}',
  '[
    {"id": "webhookUrl", "name": "Webhook URL", "type": "url", "required": true, "placeholder": "https://your-service.com/webhook/endpoint", "description": "The webhook URL to send POST requests to"},
    {"id": "description", "name": "Natural Language Description", "type": "textarea", "required": true, "placeholder": "Activate marketing workflow for new leads\\nTrigger customer onboarding sequence\\nSend notification to sales team", "description": "Describe what this webhook does in natural language. The AI will use this to understand when to trigger it.", "defaultValue": ""},
    {"id": "payload", "name": "Payload Template (JSON)", "type": "textarea", "required": false, "placeholder": "{\\n  \"action\": \"marketing_workflow\",\\n  \"trigger\": \"manual\",\\n  \"timestamp\": \"{{timestamp}}\",\\n  \"user_input\": \"{{user_message}}\",\\n  \"custom_data\": {\\n    \"source\": \"ai_assistant\"\\n  }\\n}", "description": "JSON payload template. Use {{timestamp}}, {{user_message}}, {{contact_name}} as dynamic variables.", "defaultValue": "{\\n  \"action\": \"webhook_triggered\",\\n  \"timestamp\": \"{{timestamp}}\",\\n  \"user_input\": \"{{user_message}}\",\\n  \"source\": \"ai_assistant\"\\n}"},
    {"id": "headers", "name": "Custom Headers (JSON)", "type": "textarea", "required": false, "placeholder": "{\\n  \"Authorization\": \"Bearer your-token\",\\n  \"X-Custom-Header\": \"value\"\\n}", "description": "Additional HTTP headers to send with the webhook request", "defaultValue": "{\\n  \"Content-Type\": \"application/json\"\\n}"},
    {"id": "confirmationMessage", "name": "Confirmation Message", "type": "text", "required": false, "placeholder": "Marketing workflow has been activated successfully!", "description": "Message to show when webhook is triggered successfully", "defaultValue": "Webhook triggered successfully!"},
    {"id": "triggerKeywords", "name": "Trigger Keywords", "type": "text", "required": false, "placeholder": "activate, trigger, start, launch, execute", "description": "Comma-separated keywords that can trigger this webhook (optional - AI will use description)", "defaultValue": ""}
  ]',
  '["Activate marketing automation workflows", "Trigger customer onboarding sequences", "Send notifications to external systems", "Start data synchronization processes", "Launch email campaigns or notifications", "Trigger custom business logic and processes"]',
  '["webhook", "automation", "trigger", "custom", "integration", "workflow", "action"]',
  'intermediate',
  false,
  true,
  null,
  '1.0.0'
),
(
  'google-sheets',
  'Google Sheets',
  'Connect and manage Google Sheets with full CRUD operations using natural language commands',
  'action',
  'FileSpreadsheet',
  '#34a853',
  false,
  false,
  '{"sheetUrl": {"type": "string", "required": true}, "sheetName": {"type": "string", "required": true}, "description": {"type": "string", "required": true}, "defaultSheet": {"type": "string"}, "accessLevel": {"type": "string", "required": true}, "autoSync": {"type": "string"}}',
  '[
    {"id": "sheetUrl", "name": "Google Sheet URL", "type": "url", "required": true, "placeholder": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit", "description": "Paste the full Google Sheets URL here. The sheet ID will be automatically extracted."},
    {"id": "sheetName", "name": "Integration Name", "type": "text", "required": true, "placeholder": "Customer Database", "description": "Give this integration a descriptive name to identify it"},
    {"id": "description", "name": "What is in this spreadsheet?", "type": "textarea", "required": true, "placeholder": "Customer contact information with names, emails, phone numbers, order history, and notes. Used for CRM and customer support.", "description": "Describe what data is in your spreadsheet so the AI knows how to help you with it"},
    {"id": "defaultSheet", "name": "Default Sheet/Tab Name", "type": "text", "required": false, "placeholder": "Sheet1", "description": "Name of the specific tab/sheet to use by default (leave empty to use first sheet)", "defaultValue": "Sheet1"},
    {"id": "accessLevel", "name": "Access Level", "type": "select", "required": true, "options": [{"value": "read-only", "label": "Read Only - AI can only view data"}, {"value": "read-write", "label": "Read & Write - AI can view, add, and edit data"}], "defaultValue": "read-only", "description": "Choose whether the AI can modify your spreadsheet or just read from it"},
    {"id": "autoSync", "name": "Auto-sync Data", "type": "select", "required": false, "options": [{"value": "never", "label": "Never - Manual requests only"}, {"value": "on-chat", "label": "On Chat Start - Sync when conversation begins"}, {"value": "periodic", "label": "Periodic - Sync every 5 minutes"}], "defaultValue": "never", "description": "When should the AI automatically refresh data from your spreadsheet?"}
  ]',
  '["Show me all customer data from my spreadsheet", "Add a new customer: John Doe, john@email.com, 555-1234", "Search for customers containing Smith", "Update cell B5 to Completed", "How many rows of data do I have?", "Show me the first 10 rows", "Add a new row with: Product A, $29.99, In Stock", "Find all entries where status is Pending", "What columns are in my spreadsheet?", "Export data from rows 5-15"]',
  '["spreadsheet", "data", "google", "sheets", "database", "crm", "crud", "automation"]',
  'beginner',
  true,
  true,
  'google',
  '1.0.0'
),
(
  'notion-oauth-action',
  'Notion Actions (OAuth)',
  'Create pages, update databases, and manage your Notion workspace with natural language commands',
  'action',
  'FileText',
  '#000000',
  false,
  true,
  '{"allowedActions": {"type": "string", "required": true}}',
  '[
    {"id": "allowedActions", "name": "Allowed Actions", "type": "select", "required": true, "options": [{"value": "read", "label": "Read Only - View pages and databases"}, {"value": "write", "label": "Write - Create and update content"}, {"value": "full", "label": "Full Access - Read, write, and manage"}], "defaultValue": "write", "description": "What actions the AI can perform in your Notion workspace"}
  ]',
  '["Create a new page in my project database", "Update the status of a task to completed", "Add a new entry to my reading list", "Search for pages containing specific keywords", "Create a meeting notes page with agenda", "Update database properties and values"]',
  '["notion", "oauth", "create", "update", "pages", "databases", "action"]',
  'intermediate',
  true,
  true,
  'notion',
  '1.0.0'
);