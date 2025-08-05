# Firecrawl Integration Guide

This guide explains how to use the Firecrawl web scraping integration across all levels of the platform.

## Overview

The Firecrawl integration allows you to scrape and extract content from websites using Firecrawl's powerful web scraping API. It's available in two forms:

1. **Source Integration** (`firecrawl-web-scraping`) - For scheduled scraping of specific websites
2. **Action Integration** (`firecrawl-tool`) - For dynamic scraping when requested by users

## Features

- **Multiple Content Types**: Extract text, markdown, HTML, or screenshots
- **Image Support**: Include image URLs and alt text
- **Crawl Depth Control**: Scrape single pages or crawl multiple levels deep
- **Domain Whitelisting**: Restrict scraping to specific domains for security
- **Voice Integration**: Use voice commands to scrape websites
- **Chat Integration**: Request website scraping through natural language

## Setup

### 1. Get a Firecrawl API Key

1. Visit [https://firecrawl.dev](https://firecrawl.dev)
2. Sign up for an account
3. Get your API key from the dashboard
4. The API key format is: `fc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Configure the Integration

#### Source Integration Setup

1. Go to your agent's integrations
2. Add the "Firecrawl Web Scraping" integration
3. Enter your API key
4. Add URLs to scrape (one per line)
5. Choose extraction type (text, markdown, HTML, or screenshot)
6. Configure other options as needed

#### Action Integration Setup

1. Go to your agent's integrations
2. Add the "Firecrawl Web Scraping Tool" integration
3. Enter your API key
4. Set default extraction type
5. Configure allowed domains (optional)

## Usage Examples

### Voice Commands

You can use voice commands to scrape websites:

- "Scrape the content from https://example.com"
- "Extract all blog posts from my competitor's website"
- "Get the pricing page from https://competitor.com/pricing"
- "Scrape the documentation from https://docs.example.com"

### Chat Commands

In the chat interface, you can request website scraping:

- "Can you scrape https://example.com and tell me what's on it?"
- "Extract the product information from this e-commerce site"
- "Get the latest news from this website"
- "Scrape the FAQ page for customer support information"

### Natural Language Examples

The AI understands various ways to request web scraping:

- "Scrape this website"
- "Extract content from this page"
- "Get information from this site"
- "Crawl this website"
- "Extract data from this webpage"

## Configuration Options

### Source Integration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| API Key | Text | Yes | Your Firecrawl API key |
| URLs to Scrape | Textarea | Yes | One URL per line |
| Extract Type | Select | Yes | text, markdown, HTML, or screenshot |
| Include Images | Select | No | Include image URLs and alt text |
| Max Pages | Number | No | Maximum pages to scrape (1-100) |
| Crawl Depth | Select | No | How deep to crawl (0-3 levels) |

### Action Integration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| API Key | Text | Yes | Your Firecrawl API key |
| Default Extract Type | Select | Yes | Default content extraction type |
| Include Images by Default | Select | No | Whether to include images by default |
| Max Pages (Default) | Number | No | Default maximum pages to scrape |
| Allowed Domains | Textarea | No | Whitelist of allowed domains |

## Security Features

### Domain Whitelisting

For the action integration, you can specify allowed domains to prevent scraping of unauthorized websites:

```
example.com
blog.example.com
api.example.com
```

### API Key Security

- API keys are encrypted in the database
- Keys are never logged or exposed in error messages
- Each integration instance has its own configuration

## Integration Levels

### 1. Database Level

The Firecrawl integration is stored in the database with:
- Integration templates in `integration_templates` table
- User configurations in `agent_integrations` table
- Encrypted API keys and settings

### 2. Service Level

- **FirecrawlService**: Handles API communication and data processing
- **IntegrationsService**: Orchestrates integration execution
- **Supabase Edge Function**: Proxies API calls to avoid CORS issues

### 3. UI Level

- **Integrations Library**: Browse and configure Firecrawl integrations
- **Settings Screen**: Manage integration configurations
- **Chat Interface**: Request dynamic scraping
- **Voice Interface**: Use voice commands for scraping

### 4. Voice Level

- **GeminiLiveService**: Handles voice commands for web scraping
- **Natural Language Processing**: Understands various scraping requests
- **Voice Response Formatting**: Converts scraping results to speech

## API Endpoints

### Supabase Edge Function

The Firecrawl integration uses a Supabase Edge Function to proxy API calls:

```
POST /functions/v1/firecrawl-proxy
```

Request body:
```json
{
  "apiKey": "fc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "urls": ["https://example.com"],
  "extractType": "text",
  "includeImages": false,
  "maxPages": 10,
  "crawlDepth": 1,
  "allowedDomains": []
}
```

## Error Handling

The integration includes comprehensive error handling:

- **API Key Validation**: Ensures valid API key is provided
- **URL Validation**: Validates URLs before scraping
- **Domain Whitelisting**: Checks against allowed domains
- **Rate Limiting**: Respects Firecrawl API limits
- **Error Logging**: Detailed error messages for debugging

## Best Practices

### 1. URL Management

- Use specific URLs rather than wildcards when possible
- Test URLs before adding to scheduled scraping
- Monitor scraping results for errors

### 2. Content Extraction

- Use "text" extraction for most use cases
- Use "markdown" for structured content
- Use "screenshot" for visual content analysis
- Use "HTML" for detailed markup analysis

### 3. Performance

- Start with small crawl depths (0-1)
- Limit max pages to reasonable numbers (5-20)
- Use domain whitelisting for security
- Monitor API usage and costs

### 4. Security

- Always use domain whitelisting for action integrations
- Keep API keys secure
- Monitor scraping logs for unusual activity
- Respect robots.txt and website terms of service

## Troubleshooting

### Common Issues

1. **API Key Invalid**
   - Verify your Firecrawl API key
   - Check that the key is active in your Firecrawl dashboard

2. **URL Not Accessible**
   - Verify the URL is correct and accessible
   - Check if the website blocks scraping
   - Try a different URL to test

3. **No Content Extracted**
   - The page might be empty or have no text content
   - Try a different extraction type
   - Check if the page requires JavaScript

4. **Rate Limiting**
   - Reduce the number of pages being scraped
   - Wait before making additional requests
   - Check your Firecrawl usage limits

### Debug Information

The integration provides detailed logging:

- Request/response details in browser console
- Error messages with specific failure reasons
- API response status codes
- Scraping metadata (pages, size, time)

## Migration

To add the Firecrawl integration to your database, run:

```bash
supabase db push
```

This will apply the migration that adds the Firecrawl integration templates to the database.

## Support

For issues with the Firecrawl integration:

1. Check the browser console for error messages
2. Verify your Firecrawl API key is valid
3. Test with a simple URL first
4. Check the Firecrawl documentation for API details

## Future Enhancements

Planned improvements for the Firecrawl integration:

- **Scheduled Scraping**: Automatically scrape websites on a schedule
- **Content Analysis**: AI-powered analysis of scraped content
- **Data Export**: Export scraped data to various formats
- **Advanced Filtering**: Filter content based on keywords or patterns
- **Multi-language Support**: Scrape content in different languages 