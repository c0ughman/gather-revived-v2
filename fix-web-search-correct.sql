-- Insert web-search template with the correct schema structure
-- Run this in your Supabase SQL Editor

INSERT INTO integration_templates (
  id,
  name,
  description,
  category,
  icon,
  color,
  requires_api_key,
  requires_oauth,
  config_schema,
  setup_fields,
  examples,
  documentation_url,
  tags,
  difficulty_level,
  is_featured,
  is_active,
  is_beta,
  provider,
  version,
  created_at,
  updated_at
) VALUES (
  'web-search',
  'Web Search (Tavily)',
  'Search the web using Tavily AI-powered search engine',
  'source',
  'Search',
  '#10b981',
  false,
  false,
  '{
    "searchDepth": {
      "type": "string",
      "required": true
    },
    "maxResults": {
      "type": "number"
    },
    "includeAnswer": {
      "type": "string"
    },
    "includeDomains": {
      "type": "string"
    },
    "excludeDomains": {
      "type": "string"
    }
  }'::jsonb,
  '[
    {
      "id": "searchDepth",
      "name": "Search Depth",
      "type": "select",
      "required": true,
      "options": [
        {"value": "basic", "label": "Basic (1 credit)"},
        {"value": "advanced", "label": "Advanced (2 credits)"}
      ],
      "defaultValue": "basic",
      "description": "Search depth determines quality and cost"
    },
    {
      "id": "maxResults",
      "name": "Max Results", 
      "type": "number",
      "required": false,
      "placeholder": "5",
      "description": "Maximum number of search results (1-20)",
      "defaultValue": "5"
    },
    {
      "id": "includeAnswer",
      "name": "Include AI Answer",
      "type": "select",
      "required": false,
      "options": [
        {"value": "false", "label": "No"},
        {"value": "basic", "label": "Basic Answer"},
        {"value": "advanced", "label": "Advanced Answer"}
      ],
      "defaultValue": "basic",
      "description": "Include an AI-generated answer to the query"
    },
    {
      "id": "includeDomains",
      "name": "Include Domains",
      "type": "text",
      "required": false,
      "placeholder": "example.com, trusted-site.org",
      "description": "Comma-separated list of domains to include (optional)"
    },
    {
      "id": "excludeDomains",
      "name": "Exclude Domains",
      "type": "text",
      "required": false,
      "placeholder": "spam-site.com, unreliable.net",
      "description": "Comma-separated list of domains to exclude (optional)"
    }
  ]'::jsonb,
  '[
    "Search for latest technology news",
    "Find information about specific topics",
    "Research current events and trends", 
    "Look up factual information",
    "Get recent updates on any subject"
  ]'::jsonb,
  'https://docs.tavily.com',
  '[
    "search",
    "web", 
    "tavily",
    "ai",
    "information",
    "research"
  ]'::jsonb,
  'beginner',
  true,
  true,
  false,
  'tavily',
  '1.0.0',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  requires_api_key = EXCLUDED.requires_api_key,
  requires_oauth = EXCLUDED.requires_oauth,
  config_schema = EXCLUDED.config_schema,
  setup_fields = EXCLUDED.setup_fields,
  examples = EXCLUDED.examples,
  documentation_url = EXCLUDED.documentation_url,
  tags = EXCLUDED.tags,
  difficulty_level = EXCLUDED.difficulty_level,
  is_featured = EXCLUDED.is_featured,
  is_active = EXCLUDED.is_active,
  is_beta = EXCLUDED.is_beta,
  provider = EXCLUDED.provider,
  version = EXCLUDED.version,
  updated_at = NOW();

-- Verify the insertion
SELECT * FROM integration_templates WHERE id = 'web-search'; 