/*
  # Populate Global Catalog Tables
  
  This migration populates the agent_templates and integration_templates tables
  with the existing data from your application.
*/

-- =============================================
-- POPULATE AGENT TEMPLATES
-- =============================================

INSERT INTO agent_templates (id, name, description, category, default_color, default_voice, personality_traits, capabilities, suggested_integrations, tags, is_featured) VALUES
('agentic-andy', 'Agentic Andy', 'An intelligent agent that can make API calls and fetch real-time data when you ask. Just tell me what information you need!', 'utility', '#8b5cf6', 'Charon', 
 '["intelligent", "proactive", "data-focused"]'::jsonb,
 '["API requests", "real-time data", "web scraping", "data analysis"]'::jsonb,
 '["api-request-tool"]'::jsonb,
 '["api", "data", "utility", "automation"]'::jsonb, true),

('news-navigator', 'News Navigator', 'Your personal news assistant. I stay updated with the latest headlines and can discuss current events from around the world.', 'news', '#dc2626', 'Orus',
 '["informed", "analytical", "current"]'::jsonb,
 '["news analysis", "current events", "trend tracking"]'::jsonb,
 '["google-news"]'::jsonb,
 '["news", "current events", "analysis"]'::jsonb, true),

('market-maven', 'Market Maven', 'Financial markets expert with real-time access to cryptocurrency and stock data. Ask me about prices, trends, and market analysis.', 'finance', '#10b981', 'Leda',
 '["analytical", "precise", "market-savvy"]'::jsonb,
 '["financial analysis", "market data", "crypto tracking", "investment insights"]'::jsonb,
 '["financial-markets"]'::jsonb,
 '["finance", "crypto", "stocks", "trading"]'::jsonb, true),

('content-curator', 'Content Curator', 'I monitor RSS feeds and blogs to bring you the latest content from your favorite sources. Perfect for staying updated with specific publications.', 'content', '#f97316', 'Fenrir',
 '["organized", "thorough", "content-focused"]'::jsonb,
 '["content aggregation", "RSS monitoring", "blog tracking"]'::jsonb,
 '["rss-feeds"]'::jsonb,
 '["content", "rss", "blogs", "curation"]'::jsonb, true),

('domain-detective', 'Domain Detective', 'Your domain availability expert! I can check if domains are available and suggest creative variations for your business, project, or idea.', 'utility', '#059669', 'Aoede',
 '["investigative", "creative", "helpful"]'::jsonb,
 '["domain checking", "availability analysis", "name suggestions"]'::jsonb,
 '["domain-checker-tool"]'::jsonb,
 '["domains", "web", "business", "branding"]'::jsonb, true),

('workflow-wizard', 'Workflow Wizard', 'Your automation assistant! I can trigger various workflows and integrations through natural language commands. Just tell me what you want to activate!', 'automation', '#dc2626', 'Zephyr',
 '["efficient", "automated", "responsive"]'::jsonb,
 '["workflow automation", "webhook triggers", "process management"]'::jsonb,
 '["webhook-trigger"]'::jsonb,
 '["automation", "workflows", "productivity"]'::jsonb, true),

('spreadsheet-specialist', 'Spreadsheet Specialist', 'Your Google Sheets expert! I can read, write, search, and manage your spreadsheet data with natural language commands.', 'productivity', '#34a853', 'Fenrir',
 '["organized", "data-driven", "precise"]'::jsonb,
 '["spreadsheet management", "data analysis", "Google Sheets integration"]'::jsonb,
 '["google-sheets"]'::jsonb,
 '["spreadsheets", "data", "productivity", "google"]'::jsonb, true);

-- =============================================
-- POPULATE INTEGRATION TEMPLATES
-- =============================================

INSERT INTO integration_templates (id, name, description, category, icon, color, requires_api_key, setup_fields, examples, tags, difficulty_level, is_featured) VALUES

-- Source Integrations
('http-requests', 'HTTP API Requests', 'Make HTTP requests to any API endpoint', 'source', 'Globe', '#3b82f6', false,
 '[
   {"id": "url", "name": "API URL", "type": "url", "required": true, "placeholder": "https://api.example.com/data", "description": "The URL endpoint to make the request to"},
   {"id": "method", "name": "HTTP Method", "type": "select", "required": true, "options": [{"value": "GET", "label": "GET"}, {"value": "POST", "label": "POST"}, {"value": "PUT", "label": "PUT"}, {"value": "DELETE", "label": "DELETE"}], "defaultValue": "GET", "description": "HTTP method to use for the request"},
   {"id": "headers", "name": "Headers (JSON)", "type": "textarea", "required": false, "placeholder": "{\"Content-Type\": \"application/json\", \"Authorization\": \"Bearer token\"}", "description": "HTTP headers as JSON object", "defaultValue": "{}"},
   {"id": "body", "name": "Request Body", "type": "textarea", "required": false, "placeholder": "{\"key\": \"value\"}", "description": "Request body for POST/PUT requests"}
 ]'::jsonb,
 '["Fetch weather data from OpenWeatherMap", "Get user information from GitHub API", "Post data to a webhook", "Retrieve cryptocurrency prices"]'::jsonb,
 '["api", "http", "rest", "web", "data"]'::jsonb, 'intermediate', true),

('google-news', 'Google News', 'Fetch latest news articles from Google News', 'source', 'Newspaper', '#dc2626', false,
 '[
   {"id": "topic", "name": "Topic", "type": "text", "required": true, "placeholder": "technology", "description": "News topic to search for", "defaultValue": "technology"},
   {"id": "country", "name": "Country", "type": "select", "required": true, "options": [{"value": "US", "label": "United States"}, {"value": "GB", "label": "United Kingdom"}, {"value": "CA", "label": "Canada"}, {"value": "AU", "label": "Australia"}, {"value": "DE", "label": "Germany"}, {"value": "FR", "label": "France"}, {"value": "JP", "label": "Japan"}], "defaultValue": "US", "description": "Country for localized news"},
   {"id": "language", "name": "Language", "type": "select", "required": true, "options": [{"value": "en", "label": "English"}, {"value": "es", "label": "Spanish"}, {"value": "fr", "label": "French"}, {"value": "de", "label": "German"}, {"value": "ja", "label": "Japanese"}], "defaultValue": "en", "description": "Language for news articles"}
 ]'::jsonb,
 '["Latest technology news from the US", "Breaking news in multiple languages", "Country-specific news updates", "Topic-based news aggregation"]'::jsonb,
 '["news", "google", "articles", "current events", "media"]'::jsonb, 'beginner', true),

('rss-feeds', 'RSS Feed Reader', 'Parse and read RSS/Atom feeds from any website', 'source', 'Rss', '#f97316', false,
 '[
   {"id": "feedUrl", "name": "RSS Feed URL", "type": "url", "required": true, "placeholder": "https://feeds.bbci.co.uk/news/rss.xml", "description": "URL of the RSS or Atom feed"},
   {"id": "maxItems", "name": "Max Items", "type": "number", "required": false, "placeholder": "10", "description": "Maximum number of items to fetch", "defaultValue": "10"}
 ]'::jsonb,
 '["BBC News RSS feed", "Tech blog updates", "Podcast episode feeds", "Company blog notifications"]'::jsonb,
 '["rss", "feeds", "xml", "syndication", "blogs"]'::jsonb, 'beginner', true),

('financial-markets', 'Financial Markets Data', 'Get real-time cryptocurrency and stock market data', 'source', 'TrendingUp', '#10b981', false,
 '[
   {"id": "dataType", "name": "Data Type", "type": "select", "required": true, "options": [{"value": "crypto", "label": "Cryptocurrency"}, {"value": "stocks", "label": "Stock Market"}, {"value": "forex", "label": "Foreign Exchange"}], "defaultValue": "crypto", "description": "Type of financial data to fetch"},
   {"id": "symbols", "name": "Symbols", "type": "text", "required": true, "placeholder": "bitcoin,ethereum,cardano", "description": "Comma-separated list of symbols to track", "defaultValue": "bitcoin,ethereum,cardano"},
   {"id": "currency", "name": "Currency", "type": "select", "required": true, "options": [{"value": "usd", "label": "USD"}, {"value": "eur", "label": "EUR"}, {"value": "gbp", "label": "GBP"}, {"value": "jpy", "label": "JPY"}], "defaultValue": "usd", "description": "Base currency for prices"}
 ]'::jsonb,
 '["Bitcoin and Ethereum prices in USD", "Top 10 cryptocurrency market data", "Stock prices for major companies", "Foreign exchange rates"]'::jsonb,
 '["finance", "crypto", "stocks", "trading", "markets", "prices"]'::jsonb, 'intermediate', true),

-- Action Integrations
('api-request-tool', 'API Request Tool', 'Make HTTP API requests when requested by the user', 'action', 'Zap', '#8b5cf6', false,
 '[
   {"id": "baseUrl", "name": "Base URL (Optional)", "type": "url", "required": false, "placeholder": "https://api.example.com", "description": "Default base URL for API requests"},
   {"id": "defaultHeaders", "name": "Default Headers (JSON)", "type": "textarea", "required": false, "placeholder": "{\"Authorization\": \"Bearer token\", \"Content-Type\": \"application/json\"}", "description": "Default headers to include with requests", "defaultValue": "{\"Content-Type\": \"application/json\"}"},
   {"id": "allowedDomains", "name": "Allowed Domains", "type": "textarea", "required": false, "placeholder": "api.example.com\napi.github.com\napi.openweathermap.org", "description": "Whitelist of allowed domains (one per line). Leave empty to allow all."}
 ]'::jsonb,
 '["Make API calls when user asks for data", "Fetch information from external services", "Post data to webhooks on command", "Integrate with third-party APIs dynamically"]'::jsonb,
 '["tool", "api", "function", "action", "dynamic", "request"]'::jsonb, 'advanced', true),

('domain-checker-tool', 'Domain Availability Checker', 'Check domain availability using RDAP with customizable variations', 'action', 'Globe', '#059669', false,
 '[
   {"id": "variations", "name": "Domain Variations", "type": "textarea", "required": false, "placeholder": "{domain}.com\n{domain}.net\n{domain}.org\ntry{domain}.com\n{domain}app.com\nget{domain}.com", "description": "Domain variations to check. Use {domain} as placeholder for the base domain name.", "defaultValue": "{domain}.com\n{domain}.net\n{domain}.org\ntry{domain}.com\n{domain}app.com"},
   {"id": "maxConcurrent", "name": "Max Concurrent Checks", "type": "number", "required": false, "placeholder": "5", "description": "Maximum number of domains to check simultaneously", "defaultValue": "5"}
 ]'::jsonb,
 '["Check if mycompany.com is available", "Find available domain variations for a startup name", "Bulk check domain availability with custom patterns", "Discover alternative domains for branding"]'::jsonb,
 '["domain", "availability", "rdap", "registration", "dns", "tool"]'::jsonb, 'intermediate', true),

('webhook-trigger', 'Webhook Trigger', 'Trigger custom webhooks with natural language commands and customizable payloads', 'action', 'Send', '#dc2626', false,
 '[
   {"id": "webhookUrl", "name": "Webhook URL", "type": "url", "required": true, "placeholder": "https://hooks.zapier.com/hooks/catch/...", "description": "The webhook URL to send POST requests to"},
   {"id": "description", "name": "Natural Language Description", "type": "textarea", "required": true, "placeholder": "Activate marketing workflow for new leads\nTrigger customer onboarding sequence\nSend notification to sales team", "description": "Describe what this webhook does in natural language. The AI will use this to understand when to trigger it.", "defaultValue": ""},
   {"id": "payload", "name": "Payload Template (JSON)", "type": "textarea", "required": false, "placeholder": "{\n  \"action\": \"marketing_workflow\",\n  \"trigger\": \"manual\",\n  \"timestamp\": \"{{timestamp}}\",\n  \"user_input\": \"{{user_message}}\",\n  \"custom_data\": {\n    \"source\": \"ai_assistant\"\n  }\n}", "description": "JSON payload template. Use {{timestamp}}, {{user_message}}, {{contact_name}} as dynamic variables.", "defaultValue": "{\n  \"action\": \"webhook_triggered\",\n  \"timestamp\": \"{{timestamp}}\",\n  \"user_input\": \"{{user_message}}\",\n  \"source\": \"ai_assistant\"\n}"},
   {"id": "headers", "name": "Custom Headers (JSON)", "type": "textarea", "required": false, "placeholder": "{\n  \"Authorization\": \"Bearer your-token\",\n  \"X-Custom-Header\": \"value\"\n}", "description": "Additional HTTP headers to send with the webhook request", "defaultValue": "{\n  \"Content-Type\": \"application/json\"\n}"},
   {"id": "confirmationMessage", "name": "Confirmation Message", "type": "text", "required": false, "placeholder": "Marketing workflow has been activated successfully!", "description": "Message to show when webhook is triggered successfully", "defaultValue": "Webhook triggered successfully!"},
   {"id": "triggerKeywords", "name": "Trigger Keywords", "type": "text", "required": false, "placeholder": "activate, trigger, start, launch, execute", "description": "Comma-separated keywords that can trigger this webhook (optional - AI will use description)", "defaultValue": ""}
 ]'::jsonb,
 '["Activate marketing automation workflows", "Trigger customer onboarding sequences", "Send notifications to external systems", "Start data synchronization processes", "Launch email campaigns or notifications", "Trigger Zapier automations with natural language"]'::jsonb,
 '["webhook", "automation", "trigger", "zapier", "integration", "workflow", "action"]'::jsonb, 'advanced', true),

('google-sheets', 'Google Sheets', 'Connect and manage Google Sheets with full CRUD operations using natural language commands', 'action', 'FileSpreadsheet', '#34a853', true,
 '[
   {"id": "sheetUrl", "name": "Google Sheet URL", "type": "url", "required": true, "placeholder": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit", "description": "Paste the full Google Sheets URL here. The sheet ID will be automatically extracted."},
   {"id": "sheetName", "name": "Integration Name", "type": "text", "required": true, "placeholder": "Customer Database", "description": "Give this integration a descriptive name to identify it"},
   {"id": "description", "name": "What is in this spreadsheet?", "type": "textarea", "required": true, "placeholder": "Customer contact information with names, emails, phone numbers, order history, and notes. Used for CRM and customer support.", "description": "Describe what data is in your spreadsheet so the AI knows how to help you with it"},
   {"id": "defaultSheet", "name": "Default Sheet/Tab Name", "type": "text", "required": false, "placeholder": "Sheet1", "description": "Name of the specific tab/sheet to use by default (leave empty to use first sheet)", "defaultValue": "Sheet1"},
   {"id": "accessLevel", "name": "Access Level", "type": "select", "required": true, "options": [{"value": "read-only", "label": "Read Only - AI can only view data"}, {"value": "read-write", "label": "Read & Write - AI can view, add, and edit data"}], "defaultValue": "read-only", "description": "Choose whether the AI can modify your spreadsheet or just read from it"},
   {"id": "autoSync", "name": "Auto-sync Data", "type": "select", "required": false, "options": [{"value": "never", "label": "Never - Manual requests only"}, {"value": "on-chat", "label": "On Chat Start - Sync when conversation begins"}, {"value": "periodic", "label": "Periodic - Sync every 5 minutes"}], "defaultValue": "never", "description": "When should the AI automatically refresh data from your spreadsheet?"}
 ]'::jsonb,
 '["Show me all customer data from my spreadsheet", "Add a new customer: John Doe, john@email.com, 555-1234", "Search for customers containing Smith", "Update cell B5 to Completed", "How many rows of data do I have?", "Show me the first 10 rows", "Add a new row with: Product A, $29.99, In Stock", "Find all entries where status is Pending", "What columns are in my spreadsheet?", "Export data from rows 5-15"]'::jsonb,
 '["spreadsheet", "data", "google", "sheets", "database", "crm", "crud", "automation"]'::jsonb, 'advanced', true);

-- Update timestamps for template tables
UPDATE agent_templates SET updated_at = now();
UPDATE integration_templates SET updated_at = now();