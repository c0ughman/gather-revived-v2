-- Update Firecrawl integration templates to remove API key requirements
-- Since we're now using environment variables for the API key

-- Update the source integration template
UPDATE integration_templates 
SET 
    requires_api_key = false,
    setup_fields = '[
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
    ]'
WHERE id = 'firecrawl-web-scraping';

-- Update the action integration template
UPDATE integration_templates 
SET 
    requires_api_key = false,
    setup_fields = '[
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
    ]'
WHERE id = 'firecrawl-tool'; 