-- Add Firecrawl integration templates to the database

-- Firecrawl Web Scraping (Source Integration)
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
    tags,
    difficulty_level,
    is_featured,
    is_active,
    provider,
    version
) VALUES (
    'firecrawl-web-scraping',
    'Firecrawl Web Scraping',
    'Scrape and extract content from websites using Firecrawl''s powerful web scraping API',
    'source',
    'Globe',
    '#f59e0b',
    true,
    false,
    '{}',
    '[
        {
            "id": "apiKey",
            "name": "Firecrawl API Key",
            "type": "text",
            "required": true,
            "placeholder": "fc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "description": "Your Firecrawl API key from https://firecrawl.dev"
        },
        {
            "id": "urls",
            "name": "URLs to Scrape",
            "type": "textarea",
            "required": true,
            "placeholder": "https://example.com\nhttps://example.com/about\nhttps://example.com/contact",
            "description": "One URL per line. You can also use wildcards like https://example.com/*"
        },
        {
            "id": "extractType",
            "name": "Extract Type",
            "type": "select",
            "required": true,
            "options": [
                {"value": "text", "label": "Text Content"},
                {"value": "markdown", "label": "Markdown"},
                {"value": "html", "label": "HTML"},
                {"value": "screenshot", "label": "Screenshot"}
            ],
            "defaultValue": "text",
            "description": "What type of content to extract from the pages"
        },
        {
            "id": "includeImages",
            "name": "Include Images",
            "type": "select",
            "required": false,
            "options": [
                {"value": "true", "label": "Yes - Include image URLs and alt text"},
                {"value": "false", "label": "No - Text only"}
            ],
            "defaultValue": "false",
            "description": "Whether to include image information in the extracted content"
        },
        {
            "id": "maxPages",
            "name": "Max Pages",
            "type": "number",
            "required": false,
            "placeholder": "10",
            "description": "Maximum number of pages to scrape (1-100)",
            "defaultValue": "10"
        },
        {
            "id": "crawlDepth",
            "name": "Crawl Depth",
            "type": "select",
            "required": false,
            "options": [
                {"value": "0", "label": "Single Page"},
                {"value": "1", "label": "1 Level Deep"},
                {"value": "2", "label": "2 Levels Deep"},
                {"value": "3", "label": "3 Levels Deep"}
            ],
            "defaultValue": "1",
            "description": "How deep to crawl from the initial URLs"
        }
    ]',
    '[
        "Scrape documentation from a website",
        "Extract product information from e-commerce sites",
        "Gather news articles from multiple sources",
        "Collect blog posts and articles",
        "Extract pricing information from competitor sites",
        "Scrape FAQ pages for knowledge base building"
    ]',
    '["web-scraping", "firecrawl", "content-extraction", "crawling", "data-collection", "automation"]',
    'intermediate',
    true,
    true,
    'Firecrawl',
    '1.0.0'
);

-- Firecrawl Web Scraping Tool (Action Integration)
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
    tags,
    difficulty_level,
    is_featured,
    is_active,
    provider,
    version
) VALUES (
    'firecrawl-tool',
    'Firecrawl Web Scraping Tool',
    'Dynamically scrape websites and extract content when requested by the user',
    'action',
    'Globe',
    '#f59e0b',
    true,
    false,
    '{}',
    '[
        {
            "id": "apiKey",
            "name": "Firecrawl API Key",
            "type": "text",
            "required": true,
            "placeholder": "fc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "description": "Your Firecrawl API key from https://firecrawl.dev"
        },
        {
            "id": "defaultExtractType",
            "name": "Default Extract Type",
            "type": "select",
            "required": true,
            "options": [
                {"value": "text", "label": "Text Content"},
                {"value": "markdown", "label": "Markdown"},
                {"value": "html", "label": "HTML"},
                {"value": "screenshot", "label": "Screenshot"}
            ],
            "defaultValue": "text",
            "description": "Default content extraction type for dynamic scraping"
        },
        {
            "id": "includeImages",
            "name": "Include Images by Default",
            "type": "select",
            "required": false,
            "options": [
                {"value": "true", "label": "Yes - Include image URLs and alt text"},
                {"value": "false", "label": "No - Text only"}
            ],
            "defaultValue": "false",
            "description": "Whether to include image information by default"
        },
        {
            "id": "maxPages",
            "name": "Max Pages (Default)",
            "type": "number",
            "required": false,
            "placeholder": "5",
            "description": "Default maximum number of pages to scrape",
            "defaultValue": "5"
        },
        {
            "id": "allowedDomains",
            "name": "Allowed Domains",
            "type": "textarea",
            "required": false,
            "placeholder": "example.com\nblog.example.com\napi.example.com",
            "description": "Whitelist of allowed domains (one per line). Leave empty to allow all.",
            "defaultValue": ""
        }
    ]',
    '[
        "Scrape the content from https://example.com",
        "Extract all blog posts from a website",
        "Get the pricing page from a competitor site",
        "Scrape documentation from a tech website",
        "Extract product information from an e-commerce site",
        "Get the latest news from a news website",
        "Scrape FAQ pages for customer support",
        "Extract contact information from business websites"
    ]',
    '["web-scraping", "firecrawl", "tool", "dynamic", "content-extraction", "automation", "action"]',
    'intermediate',
    true,
    true,
    'Firecrawl',
    '1.0.0'
); 