# Web Search Integration Guide (Tavily)

## Overview

The Web Search integration powered by Tavily provides AI-optimized web search capabilities directly within your app. Unlike traditional search APIs, Tavily is specifically designed for AI agents and provides filtered, relevant results optimized for RAG (Retrieval-Augmented Generation) applications.

## Features

- 🔍 **AI-Powered Search**: Optimized for LLMs with intelligent content filtering
- 🚀 **Real-time Results**: Get up-to-date information from the web
- 💡 **Smart Answers**: Optional AI-generated answers to search queries
- 🎯 **Domain Control**: Include or exclude specific domains
- ⚡ **Fast & Efficient**: Designed for speed with concurrent processing
- 🔧 **Flexible Configuration**: Basic or advanced search depth options

## Getting Started

### 1. Set Up Tavily API Key

1. Visit [tavily.com](https://app.tavily.com) 
2. Sign up for a free account
3. You get **1,000 free API credits** every month (no credit card required)
4. Copy your API key (format: `tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### 2. Add API Key to Environment

Add your Tavily API key to your environment variables:

```bash
# Add to your .env file
VITE_TAVILY_API_KEY=tvly-your-actual-api-key-here
```

### 3. Configure the Integration

1. Go to **Settings > Integrations** in your app
2. Find **"Web Search (Tavily)"** in the integrations library
3. Click to configure and adjust settings as needed:
   - **Search Depth**: Basic (1 credit) or Advanced (2 credits)
   - **Max Results**: 1-20 results per search
   - **Include AI Answer**: Get AI-generated summaries
   - **Domain Filters**: Control which sites to include/exclude

### 4. Usage

The web search integration can be triggered by natural language phrases like:
- "Search up [topic]"
- "Look up [information]"
- "Google this [query]"
- "Find information about [subject]"
- "What is [something]?"
- "Research [topic]"

## Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| **Search Depth** | Basic (faster, 1 credit) or Advanced (better results, 2 credits) | Basic |
| **Max Results** | Number of search results to return (1-20) | 5 |
| **Include AI Answer** | Get AI-generated answer to the query | Basic |
| **Include Domains** | Comma-separated list of domains to focus on | None |
| **Exclude Domains** | Comma-separated list of domains to avoid | None |

**Note**: The API key is securely stored in environment variables and not exposed in the UI.

## API Costs

- **Basic Search**: 1 credit per query
- **Advanced Search**: 2 credits per query
- **Free Tier**: 1,000 credits/month
- **Paid Plans**: Start at $30/month for 4,000 credits

## Example Results

When you search for "latest AI developments", you'll get:

```json
{
  "query": "latest AI developments",
  "answer": "Recent AI developments include...",
  "results": [
    {
      "title": "Latest AI Breakthroughs in 2025",
      "url": "https://example.com/ai-news",
      "content": "Relevant content excerpt...",
      "score": 0.95
    }
  ],
  "response_time": 1.2
}
```

## Best Practices

1. **Use Specific Queries**: More specific searches yield better results
2. **Domain Filtering**: Use include/exclude domains for focused searches
3. **Search Depth**: Use "basic" for quick searches, "advanced" for comprehensive research
4. **Monitor Credits**: Keep track of your API usage to avoid overages

## Troubleshooting

### Common Issues

**Authentication Error (401)**
- Check that `VITE_TAVILY_API_KEY` is set in your environment variables
- Verify your API key is correct and properly formatted
- Ensure you haven't exceeded your credit limit
- Restart your development server after adding the environment variable

**Environment Variable Not Found**
- Make sure you've added `VITE_TAVILY_API_KEY` to your `.env` file
- Verify the environment variable name is exactly `VITE_TAVILY_API_KEY`
- Restart your development server after making changes

**No Results**
- Try broader search terms
- Check if domain filters are too restrictive
- Verify the query isn't too long (stay under reasonable limits)

**Slow Responses**
- Try using "basic" search depth instead of "advanced"
- Reduce the number of max results

### Support

- [Tavily Documentation](https://docs.tavily.com)
- [Tavily Community](https://community.tavily.com)
- [Get Support](https://help.tavily.com)

## Testing

To test the integration, ensure your environment variable is set and use the integration through the app interface. The web search will automatically trigger when users use trigger phrases like "search up [topic]" during conversations.

## Integration with Voice/Chat

The web search integration automatically triggers when users mention trigger phrases in conversations:

- **Voice calls**: "Hey, can you search up the latest news about AI?"
- **Chat messages**: "Look up information about quantum computing"
- **Natural flow**: Works seamlessly within ongoing conversations

## Security Notes

- Your API key is securely stored in environment variables (not exposed in the UI)
- All requests use HTTPS encryption
- API keys are only accessible server-side
- Tavily follows SOC 2 Type II compliance standards

## Environment Setup

Make sure to add your Tavily API key to your environment:

```bash
# .env file
VITE_TAVILY_API_KEY=tvly-your-actual-api-key-here
```

**Important**: Never commit your API key to version control. Add `.env` to your `.gitignore` file.

---

**Enjoy powerful web search capabilities in your AI application! 🚀** 