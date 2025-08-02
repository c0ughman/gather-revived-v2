import { Integration, IntegrationConfig } from '../types/integrations';
import { notionService } from '../notion/notionService';
import { notionDataFormatter } from '../notion/notionDataFormatter';
import { firecrawlService } from '../firecrawl/firecrawlService';
import { AIContact } from '../../../core/types/types';

// In-memory cache for integration data
const integrationDataCache: Record<string, {
  data: any;
  timestamp: Date;
  summary: string;
}> = {};

class IntegrationsService {
  /**
   * Execute an integration and return the result
   */
  async executeIntegration(integration: Integration, config: IntegrationConfig): Promise<any> {
    try {
      console.log(`🔄 Executing integration: ${integration.name}`);
      
      switch (integration.id) {
        case 'http-requests':
          return await this.executeHttpRequest(config);
        case 'web-search':
          return await this.executeWebSearch(config);
        case 'google-news':
          return await this.executeGoogleNews(config);
        case 'rss-feeds':
          return await this.executeRssFeeds(config);
        case 'financial-markets':
          return await this.executeFinancialMarkets(config);
        case 'notion-oauth-source':
          return await this.executeNotionSource(config);
        case 'firecrawl-web-scraping':
          return await this.executeFirecrawlScraping(config);
        default:
          throw new Error(`Integration ${integration.id} not implemented`);
      }
    } catch (error) {
      console.error(`❌ Integration execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store integration data in cache
   */
  storeIntegrationData(contactId: string, integrationId: string, data: any, summary: string): void {
    const cacheKey = `${contactId}:${integrationId}`;
    integrationDataCache[cacheKey] = {
      data,
      timestamp: new Date(),
      summary
    };
    console.log(`💾 Stored integration data for ${integrationId}`);
  }

  /**
   * Get integration data from cache
   */
  getIntegrationData(contactId: string, integrationId: string): {
    data: any;
    timestamp: Date;
    summary: string;
  } | null {
    const cacheKey = `${contactId}:${integrationId}`;
    return integrationDataCache[cacheKey] || null;
  }

  /**
   * Clear integration data from cache
   */
  clearIntegrationData(contactId: string, integrationId: string): void {
    const cacheKey = `${contactId}:${integrationId}`;
    delete integrationDataCache[cacheKey];
    console.log(`🧹 Cleared integration data for ${integrationId}`);
  }

  /**
   * Execute HTTP request integration
   */
  private async executeHttpRequest(config: IntegrationConfig): Promise<any> {
    const { url, method = 'GET', headers = '{}', body } = config.settings;
    
    if (!url) {
      throw new Error('URL is required');
    }

    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(headers);
    } catch (e) {
      console.warn('Invalid headers JSON, using empty headers');
    }

    const options: RequestInit = {
      method,
      headers: parsedHeaders
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = body;
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
    }

    try {
      return await response.json();
    } catch (e) {
      return await response.text();
    }
  }

  /**
   * Execute Tavily Web Search integration
   */
  private async executeWebSearch(config: IntegrationConfig): Promise<any> {
    console.log('🔍 Starting Tavily web search execution');
    console.log('📋 Web search config:', config);
    
    const { 
      searchDepth = 'basic', 
      maxResults = 5, 
      includeAnswer = 'basic',
      includeDomains = '',
      excludeDomains = ''
    } = config.settings;
    
    // Use secure proxy endpoint instead of direct API call
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL environment variable is required');
    }

    // Extract query from the config or default search term
    const query = config.settings.query || 'recent news';
    console.log('🔍 Search query:', query);

    // Parse domain lists
    const includeDomainsList = includeDomains ? 
      includeDomains.split(',').map((d: string) => d.trim()).filter((d: string) => d) : [];
    const excludeDomainsList = excludeDomains ? 
      excludeDomains.split(',').map((d: string) => d.trim()).filter((d: string) => d) : [];

    const requestBody: any = {
      query,
      search_depth: searchDepth,
      max_results: parseInt(maxResults.toString()) || 5,
      include_answer: includeAnswer !== 'false' ? includeAnswer : false
    };

    // Add domain filters if provided
    if (includeDomainsList.length > 0) {
      requestBody.include_domains = includeDomainsList;
    }
    if (excludeDomainsList.length > 0) {
      requestBody.exclude_domains = excludeDomainsList;
    }

    console.log('📤 Tavily request body:', requestBody);
    console.log('🌐 Making request to Tavily proxy...');

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/tavily-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 Tavily response status:', response.status);
      console.log('📡 Tavily response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Tavily API error response:', errorText);
        throw new Error(`Tavily search failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Tavily search successful!');
      console.log('📊 Search results:', {
        query: result.query,
        answer_length: result.answer?.length || 0,
        results_count: result.results?.length || 0,
        response_time: result.response_time
      });
      
      // Format the response for better readability
      const formattedResult = {
        query: result.query,
        answer: result.answer || null,
        results: result.results || [],
        response_time: result.response_time,
        search_metadata: {
          search_depth: searchDepth,
          max_results: maxResults,
          total_results: result.results?.length || 0
        }
      };

      console.log('📦 Formatted web search result:', formattedResult);
      return formattedResult;

    } catch (error) {
      console.error('❌ Tavily search request failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Execute Google News integration
   */
  private async executeGoogleNews(config: IntegrationConfig): Promise<any> {
    const { topic = 'technology', country = 'US' } = config.settings;
    
    // Use a free news API
    const url = `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(topic)}&country=${country.toLowerCase()}&apiKey=sample-key`;
    
    // For demo purposes, return mock data
    return {
      status: "ok",
      totalResults: 10,
      articles: [
        {
          source: { id: "techcrunch", name: "TechCrunch" },
          author: "John Smith",
          title: `Latest ${topic} news from ${country}`,
          description: "This is a sample news article about technology.",
          url: "https://techcrunch.com/sample-article",
          publishedAt: new Date().toISOString()
        },
        {
          source: { id: "wired", name: "Wired" },
          author: "Jane Doe",
          title: `Breaking: New developments in ${topic}`,
          description: "Another sample news article about technology.",
          url: "https://wired.com/sample-article",
          publishedAt: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * Execute RSS Feeds integration
   */
  private async executeRssFeeds(config: IntegrationConfig): Promise<any> {
    const { feedUrl, maxItems = 10 } = config.settings;
    
    if (!feedUrl) {
      throw new Error('Feed URL is required');
    }

    // For demo purposes, return mock data
    return {
      title: "Sample RSS Feed",
      description: "This is a sample RSS feed",
      link: feedUrl,
      items: Array.from({ length: Math.min(parseInt(maxItems), 20) }, (_, i) => ({
        title: `Sample RSS Item ${i + 1}`,
        link: `${feedUrl}/item/${i + 1}`,
        pubDate: new Date().toISOString(),
        content: `This is the content of RSS item ${i + 1}`
      }))
    };
  }

  /**
   * Execute Financial Markets integration
   */
  private async executeFinancialMarkets(config: IntegrationConfig): Promise<any> {
    const { dataType = 'crypto', symbols = 'bitcoin,ethereum', currency = 'usd' } = config.settings;
    
    // For demo purposes, return mock data
    if (dataType === 'crypto') {
      const symbolList = symbols.split(',').map(s => s.trim());
      return {
        prices: symbolList.map(symbol => ({
          symbol,
          price: Math.random() * 50000,
          change_24h: (Math.random() * 10) - 5,
          market_cap: Math.random() * 1000000000000,
          last_updated: new Date().toISOString()
        }))
      };
    } else if (dataType === 'stocks') {
      const symbolList = symbols.split(',').map(s => s.trim());
      return {
        prices: symbolList.map(symbol => ({
          symbol,
          price: Math.random() * 1000,
          change_percent: (Math.random() * 10) - 5,
          volume: Math.random() * 10000000,
          last_updated: new Date().toISOString()
        }))
      };
    } else {
      throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  /**
   * Execute Notion Source integration
   */
  private async executeNotionSource(config: IntegrationConfig): Promise<any> {
    // This would normally use the Notion API, but for demo purposes, return mock data
    return {
      pages: [
        { id: "page1", title: "Meeting Notes", lastEdited: "2 days ago" },
        { id: "page2", title: "Project Plan", lastEdited: "yesterday" },
        { id: "page3", title: "Ideas", lastEdited: "just now" }
      ],
      databases: [
        { id: "db1", name: "Tasks", entryCount: 24 },
        { id: "db2", name: "Projects", entryCount: 5 },
        { id: "db3", name: "Team Members", entryCount: 12 }
      ]
    };
  }

  /**
   * Execute Firecrawl Web Scraping integration
   */
  private async executeFirecrawlScraping(config: IntegrationConfig): Promise<any> {
    const { 
      urls, 
      extractType = 'text', 
      includeImages = false, 
      maxPages = 10, 
      crawlDepth = 1 
    } = config.settings || {};
    
    // API key is now handled by environment variable
    const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('Firecrawl API key not configured. Please set VITE_FIRECRAWL_API_KEY environment variable.');
    }

    // Check if URLs are configured
    if (!urls) {
      return {
        success: false,
        error: 'URLs to scrape are required. Please configure the integration with URLs to scrape.',
        message: 'Please add URLs to the Firecrawl integration configuration before using it.'
      };
    }

    // Parse URLs from textarea
    const urlList = urls.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urlList.length === 0) {
      throw new Error('At least one valid URL is required');
    }

    const firecrawlConfig = {
      apiKey,
      extractType: extractType as 'text' | 'markdown' | 'html' | 'screenshot',
      includeImages: includeImages === 'true',
      maxPages: parseInt(maxPages.toString()) || 10,
      crawlDepth: parseInt(crawlDepth.toString()) || 1
    };

    const result = await firecrawlService.executeScraping(urlList, firecrawlConfig);
    
    if (!result.success) {
      throw new Error(result.error || 'Firecrawl scraping failed');
    }

    return {
      success: true,
      pages: result.pages || [],
      metadata: result.metadata,
      formattedResults: firecrawlService.formatScrapingResults(result)
    };
  }

  /**
   * Execute API request tool
   */
  async executeApiRequest(url: string, method: string = 'GET', headers: any = {}, body?: string): Promise<any> {
    try {
      console.log(`🌐 Executing API request: ${method} ${url}`);
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = body;
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      try {
        return await response.json();
      } catch (e) {
        return await response.text();
      }
    } catch (error) {
      console.error(`❌ API request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute web search tool for dynamic queries from chat/voice
   */
  async executeWebSearchTool(
    query: string,
    searchDepth: string = 'basic',
    maxResults: number = 5,
    includeAnswer: boolean = true
  ): Promise<any> {
    console.log('🔍 Starting dynamic web search tool execution');
    console.log('📋 Search parameters:', { query, searchDepth, maxResults, includeAnswer });
    
    try {
      console.log(`🔍 Executing web search tool for query: "${query}"`);
      
      // Use secure proxy endpoint instead of direct API call
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL environment variable is required');
      }
      
      const requestBody: any = {
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        include_answer: includeAnswer
      };

      console.log('📤 Web search tool request body:', requestBody);
      console.log('🌐 Making web search tool request to Tavily proxy...');

      const response = await fetch(`${supabaseUrl}/functions/v1/tavily-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 Web search tool response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Web search tool API error:', errorText);
        throw new Error(`Tavily search failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Web search tool successful!');
      console.log('📊 Tool search results:', {
        query: result.query,
        answer_length: result.answer?.length || 0,
        results_count: result.results?.length || 0,
        response_time: result.response_time
      });
      
      // Format the response for better readability
      const formattedResult = {
        query: result.query,
        answer: result.answer || null,
        results: result.results || [],
        response_time: result.response_time,
        search_metadata: {
          search_depth: searchDepth,
          max_results: maxResults,
          total_results: result.results?.length || 0
        }
      };

      console.log('📦 Web search tool formatted result:', formattedResult);
      return formattedResult;

    } catch (error) {
      console.error('❌ Web search tool failed:', error);
      console.error('❌ Tool error details:', {
        message: error.message,
        query,
        searchDepth,
        maxResults
      });
      throw error;
    }
  }

  /**
   * Execute webhook trigger tool - Now using Supabase Edge Function to avoid CORS issues
   */
  async executeWebhookTriggerTool(
    webhookUrl: string,
    payload: string,
    headers: any = {},
    userMessage: string,
    contactName?: string
  ): Promise<any> {
    try {
      console.log(`🪝 Executing webhook trigger: ${webhookUrl}`);
      
      // Process dynamic variables in payload
      let processedPayload = payload
        .replace(/{{timestamp}}/g, new Date().toISOString())
        .replace(/{{user_message}}/g, userMessage)
        .replace(/{{contact_name}}/g, contactName || 'AI Assistant');
      
      // Parse the payload as JSON
      let payloadObj;
      try {
        payloadObj = JSON.parse(processedPayload);
      } catch (e) {
        console.warn('Invalid payload JSON, using empty object');
        payloadObj = {};
      }

      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined in environment variables');
      }

      // Use Supabase Edge Function as a proxy to avoid CORS issues
      const proxyUrl = `${supabaseUrl}/functions/v1/trigger-external-webhook`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          webhookUrl,
          payload: payloadObj,
          headers
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Webhook proxy failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      return {
        success: result.success,
        status: result.status,
        data: result.data
      };
    } catch (error) {
      console.error(`❌ Webhook trigger failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute Notion tool operation
   */
  async executeNotionToolOperation(
    operation: string,
    query?: string,
    pageId?: string,
    databaseId?: string,
    title?: string,
    content?: string,
    parentId?: string,
    properties?: any,
    filter?: any,
    sorts?: any[],
    contact?: AIContact
  ): Promise<any> {
    try {
      console.log(`📝 Executing Notion operation: ${operation}`);
      
      // Get user ID from contact
      const userId = contact?.id.split('_')[0];
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Get Notion credentials
      const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_NOTION_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Notion credentials not configured');
      }

      switch (operation) {
        case 'search_pages':
          return await notionService.searchPages(userId, clientId, clientSecret, query || '');
          
        case 'search_databases':
          return await notionService.searchDatabases(userId, clientId, clientSecret, query || '');
          
        case 'get_page_content':
          if (!pageId) {
            throw new Error('Page ID is required');
          }
          return await notionService.getPageContent(userId, clientId, clientSecret, pageId);
          
        case 'create_page':
          if (!parentId) {
            throw new Error('Parent ID is required');
          }
          if (!title) {
            throw new Error('Title is required');
          }
          return await notionService.createPage(userId, clientId, clientSecret, parentId, title, content);
          
        case 'update_page':
          if (!pageId) {
            throw new Error('Page ID is required');
          }
          if (!properties) {
            throw new Error('Properties are required');
          }
          return await notionService.updatePage(userId, clientId, clientSecret, pageId, properties);
          
        case 'query_database':
          if (!databaseId) {
            throw new Error('Database ID is required');
          }
          
          // First try to search for database by name if it's not a UUID
          if (databaseId.length < 36) {
            console.log(`🔍 Searching for database by name: ${databaseId}`);
            const databases = await notionService.searchDatabases(userId, clientId, clientSecret, databaseId);
            
            if (databases && databases.length > 0) {
              // Find the best match by name
              const bestMatch = databases.find(db => 
                db.title.toLowerCase() === databaseId.toLowerCase()
              ) || databases[0];
              
              console.log(`✅ Found database: ${bestMatch.title} (${bestMatch.id})`);
              databaseId = bestMatch.id;
            } else {
              throw new Error(`Database "${databaseId}" not found`);
            }
          }
          
          const results = await notionService.queryDatabase(userId, clientId, clientSecret, databaseId, filter, sorts);
          
          // Format results for better readability
          return notionDataFormatter.formatDatabaseQueryResults(results, databaseId);
          
        default:
          throw new Error(`Unsupported Notion operation: ${operation}`);
      }
    } catch (error) {
      console.error(`❌ Notion operation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute Firecrawl tool operation
   */
  async executeFirecrawlToolOperation(
    url: string,
    extractType: string = 'text',
    includeImages: boolean = false,
    maxPages: number = 5,
    contact?: AIContact
  ): Promise<any> {
    try {
      console.log(`🕷️ Executing Firecrawl tool operation for URL: ${url}`);
      
      // Get API key from environment variable
      const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;
      if (!apiKey) {
        throw new Error('Firecrawl API key not configured. Please set VITE_FIRECRAWL_API_KEY environment variable.');
      }
      
      const firecrawlConfig = {
        apiKey,
        extractType: extractType as 'text' | 'markdown' | 'html' | 'screenshot',
        includeImages,
        maxPages
      };

      const result = await firecrawlService.executeDynamicScraping(url, firecrawlConfig, contact);
      
      if (!result.success) {
        throw new Error(result.error || 'Firecrawl tool operation failed');
      }

      return {
        success: true,
        url,
        pages: result.pages || [],
        metadata: result.metadata,
        formattedResults: firecrawlService.formatScrapingResults(result)
      };
    } catch (error) {
      console.error(`❌ Firecrawl tool operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Execute Google Sheets tool operation
   */
  async executeGoogleSheetsToolOperation(
    operation: string,
    sheetUrl: string,
    accessLevel: string = 'read-only',
    sheetName: string = 'Sheet1',
    range?: string,
    data?: any[][],
    searchTerm?: string
  ): Promise<any> {
    try {
      console.log(`📊 Executing Google Sheets operation: ${operation}`);
      
      // Extract sheet ID from URL
      const sheetId = this.extractSheetId(sheetUrl);
      if (!sheetId) {
        throw new Error('Invalid Google Sheet URL');
      }

      // Check access level for write operations
      if ((operation === 'write' || operation === 'append' || operation === 'clear') && accessLevel !== 'read-write') {
        throw new Error(`Operation "${operation}" requires read-write access level`);
      }

      // For demo purposes, return mock data
      switch (operation) {
        case 'read':
          return {
            operation,
            sheetName,
            range: range || 'A1:D10',
            data: this.generateMockSheetData(5, 4)
          };
          
        case 'write':
          return {
            operation,
            sheetName,
            range: range || 'A1:D5',
            updatedCells: data ? data.length * data[0].length : 20,
            success: true
          };
          
        case 'append':
          return {
            operation,
            sheetName,
            appendedRows: data ? data.length : 1,
            success: true
          };
          
        case 'search':
          return {
            operation,
            sheetName,
            searchTerm,
            results: [
              { row: 2, data: ['John', 'Doe', 'john@example.com', '555-1234'] },
              { row: 5, data: ['Jane', 'Doe', 'jane@example.com', '555-5678'] }
            ]
          };
          
        case 'info':
          return {
            operation,
            sheetName,
            sheetId,
            title: 'Sample Spreadsheet',
            sheets: ['Sheet1', 'Sheet2', 'Data'],
            columns: ['Name', 'Email', 'Phone', 'Status'],
            rowCount: 100,
            columnCount: 10
          };
          
        case 'clear':
          return {
            operation,
            sheetName,
            range: range || 'A1:D10',
            clearedCells: 40,
            success: true
          };
          
        default:
          throw new Error(`Unsupported Google Sheets operation: ${operation}`);
      }
    } catch (error) {
      console.error(`❌ Google Sheets operation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract Google Sheet ID from URL
   */
  private extractSheetId(url: string): string | null {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Generate mock sheet data for demo purposes
   */
  private generateMockSheetData(rows: number, cols: number): string[][] {
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Date', 'Amount'];
    const statuses = ['Active', 'Pending', 'Completed', 'Cancelled'];
    
    const data: string[][] = [headers.slice(0, cols)];
    
    for (let i = 0; i < rows - 1; i++) {
      const row: string[] = [];
      row.push(`Person ${i + 1}`);
      row.push(`person${i + 1}@example.com`);
      row.push(`555-${1000 + i}`);
      if (cols > 3) row.push(statuses[Math.floor(Math.random() * statuses.length)]);
      if (cols > 4) row.push(new Date().toLocaleDateString());
      if (cols > 5) row.push(`$${(Math.random() * 1000).toFixed(2)}`);
      
      data.push(row.slice(0, cols));
    }
    
    return data;
  }

  /**
   * Start periodic execution of an integration
   */
  startPeriodicExecution(
    contactId: string,
    integration: Integration,
    config: IntegrationConfig,
    onDataUpdate?: (contactId: string, data: any) => void
  ): void {
    console.log(`🔄 Starting periodic execution for ${integration.name} (${contactId})`);
    
    // For now, we'll just execute once immediately
    // In a real implementation, you'd set up intervals based on config.intervalMinutes
    this.executeIntegration(integration, config)
      .then((data) => {
        console.log(`✅ Periodic execution completed for ${integration.name}`);
        
        // Store the data
        this.storeIntegrationData(contactId, integration.id, data, `Periodic execution of ${integration.name}`);
        
        // Call the callback if provided
        if (onDataUpdate) {
          onDataUpdate(contactId, data);
        }
      })
      .catch((error) => {
        console.error(`❌ Periodic execution failed for ${integration.name}:`, error);
      });
  }

  /**
   * Stop periodic execution of an integration
   */
  stopPeriodicExecution(contactId: string, integrationId: string): void {
    console.log(`🛑 Stopping periodic execution for ${integrationId} (${contactId})`);
    // In a real implementation, you'd clear the interval
  }

  /**
   * Debug function to test web search manually
   * Call this from browser console: integrationsService.debugWebSearch("test query")
   */
  async debugWebSearch(query: string = "latest tech news"): Promise<any> {
    console.log('🧪 DEBUG: Testing web search with query:', query);
    try {
      const result = await this.executeWebSearchTool(query);
      console.log('🧪 DEBUG: Web search test successful:', result);
      return result;
    } catch (error) {
      console.error('🧪 DEBUG: Web search test failed:', error);
      throw error;
    }
  }
}

export const integrationsService = new IntegrationsService();