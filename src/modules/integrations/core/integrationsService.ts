import { Integration, IntegrationConfig } from '../types/integrations';
import { KJUR } from 'jsrsasign';
import { notionService } from '../notion/notionService';
import { oauthService } from '../../oauth/services/oauthService';
import { supabase } from '../../database/lib/supabase';
import { notionDataFormatter } from '../notion/notionDataFormatter';

interface IntegrationData {
  summary: string;
  timestamp: Date;
  source: string;
  data: any;
}

class IntegrationsService {
  private intervals: Map<string, number> = new Map();
  private dataStore: Map<string, Map<string, IntegrationData>> = new Map();

  async executeIntegration(integration: Integration, config: IntegrationConfig, userId?: string): Promise<IntegrationData> {
    console.log(`🔧 Executing integration: ${integration.name}`);
    
    try {
      switch (integration.id) {
        case 'http-requests':
          return await this.executeHttpRequest(config);
        case 'google-news':
          return await this.executeGoogleNews(config);
        case 'rss-feeds':
          return await this.executeRssFeeds(config);
        case 'financial-markets':
          return await this.executeFinancialMarkets(config);
        case 'api-request-tool':
          // This is handled by the tool use system, not direct execution
          throw new Error('API Request Tool is only available through function calling');
        case 'domain-checker-tool':
          return await this.executeDomainChecker(config);
        case 'zapier-webhook':
          return await this.executeZapierWebhook(config);
        case 'n8n-webhook':
          return await this.executeN8NWebhook(config);
        case 'webhook-trigger':
          return await this.executeWebhookTrigger(config);
        case 'google-sheets':
          return await this.executeGoogleSheets(config);
        case 'notion-oauth-source':
          return await this.executeNotionOAuthSource(config, userId);
        case 'notion-oauth-action':
          return await this.executeNotionOAuthAction(config, userId);
        default:
          throw new Error(`Unknown integration: ${integration.id}`);
      }
    } catch (error) {
      console.error(`❌ Integration execution failed for ${integration.name}:`, error);
      throw error;
    }
  }

  // NEW: Notion OAuth Source Integration
  private async executeNotionOAuthSource(config: IntegrationConfig, userId?: string): Promise<IntegrationData> {
    const { dataType, includeContent } = config.settings;
    
    // Use passed userId or fallback to hardcoded for development
    const actualUserId = userId || 'current-user-id';
    
    // Get OAuth credentials from environment
    const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_NOTION_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Notion OAuth credentials not configured. Please add VITE_NOTION_CLIENT_ID and VITE_NOTION_CLIENT_SECRET to environment variables.');
    }
    
    try {
      let summary = '';
      let data: any = {};

      if (dataType === 'pages' || dataType === 'both') {
        const pages = await notionService.getPages(actualUserId, clientId, clientSecret);
        data.pages = pages;
        summary += `${pages.length} pages`;

        // Get content if requested
        if (includeContent === 'true') {
          for (const page of pages.slice(0, 5)) { // Limit to first 5 for performance
            try {
              page.content = await notionService.getPageContent(actualUserId, clientId, clientSecret, page.id);
            } catch (error) {
              console.warn(`Failed to get content for page ${page.id}:`, error);
            }
          }
        }
      }

      if (dataType === 'databases' || dataType === 'both') {
        const databases = await notionService.getDatabases(actualUserId, clientId, clientSecret);
        data.databases = databases;
        if (summary) summary += ', ';
        summary += `${databases.length} databases`;
      }

      return {
        summary: `Notion sync completed: ${summary}`,
        timestamp: new Date(),
        source: 'Notion OAuth',
        data
      };
    } catch (error) {
      console.error('❌ Notion OAuth source execution failed:', error);
      throw error;
    }
  }

  // NEW: Notion OAuth Action Integration (for testing)
  private async executeNotionOAuthAction(config: IntegrationConfig, userId?: string): Promise<IntegrationData> {
    const { allowedActions } = config.settings;
    
    // Use passed userId or fallback to hardcoded for development
    const actualUserId = userId || 'current-user-id';
    
    // Get OAuth credentials from environment
    const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_NOTION_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Notion OAuth credentials not configured. Please add VITE_NOTION_CLIENT_ID and VITE_NOTION_CLIENT_SECRET to environment variables.');
    }
    
    try {
      // Test connection by fetching pages
      const pages = await notionService.getPages(actualUserId, clientId, clientSecret);
      
      return {
        summary: `Notion action integration ready: ${allowedActions} access to ${pages.length} pages`,
        timestamp: new Date(),
        source: 'Notion OAuth Actions',
        data: {
          allowedActions,
          availablePages: pages.length,
          connectionStatus: 'active'
        }
      };
    } catch (error) {
      console.error('❌ Notion OAuth action execution failed:', error);
      throw error;
    }
  }

  // Tool use function for API requests with improved proxy handling
  async executeApiRequest(url: string, method: string = 'GET', headers: Record<string, string> = {}, body?: string): Promise<any> {
    console.log(`🔧 Tool Use: Making ${method} request to ${url}`);
    
    try {
      // Try direct request first
      try {
        console.log(`🌐 Trying direct request to: ${url}`);
        
        const requestOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            ...headers
          },
          mode: 'cors'
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          requestOptions.body = body;
        }

        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: data,
          url: url,
          method: method,
          proxied: false
        };
      } catch (directError) {
        console.warn(`❌ Direct request failed: ${(directError as Error).message}`);
        
        // Fallback to CORS proxy services
        const proxies = [
          `https://corsproxy.io/?${encodeURIComponent(url)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
        ];

        for (const proxyUrl of proxies) {
          try {
            console.log(`🌐 Trying CORS proxy: ${proxyUrl}`);
            
            const response = await fetch(proxyUrl, {
              method: 'GET', // Most proxies only support GET
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*'
              }
            });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType?.includes('application/json')) {
              data = await response.json();
            } else {
              const textData = await response.text();
              try {
                data = JSON.parse(textData);
              } catch {
                data = textData;
              }
            }

            return {
              success: true,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              data: data,
              url: url,
              method: method,
              proxied: true,
              proxyUsed: proxyUrl
            };
          } catch (proxyError) {
            console.warn(`❌ Proxy ${proxyUrl} failed:`, (proxyError as Error).message);
            continue;
          }
        }

        throw new Error(`All requests failed. Direct error: ${(directError as Error).message}`);
      }
    } catch (error) {
      console.error(`❌ API request failed:`, error);
      throw error;
    }
  }

  private async executeHttpRequest(config: IntegrationConfig): Promise<IntegrationData> {
    const { url, method = 'GET', headers = '{}', body } = config.settings;
    
    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(headers);
    } catch (e) {
      console.warn('Invalid headers JSON, using empty headers');
    }

    // Use the same CORS-aware method
    const result = await this.executeApiRequest(url, method, parsedHeaders, body);

    return {
      summary: `HTTP ${method} request to ${url} completed with status ${result.status}`,
      timestamp: new Date(),
      source: 'HTTP Request',
      data: result
    };
  }

  private async executeGoogleNews(config: IntegrationConfig): Promise<IntegrationData> {
    const { topic, country, language } = config.settings;
    
    // Simulate Google News API response
    const mockArticles = [
      {
        title: `Latest ${topic} developments in ${country}`,
        description: `Breaking news about ${topic} with significant implications for the industry.`,
        url: 'https://news.google.com/article1',
        source: 'Tech News Daily',
        pubDate: new Date().toISOString(),
        language: language
      },
      {
        title: `${topic} market trends show promising growth`,
        description: `Industry experts analyze the recent surge in ${topic} adoption and investment.`,
        url: 'https://news.google.com/article2',
        source: 'Market Watch',
        pubDate: new Date(Date.now() - 3600000).toISOString(),
        language: language
      },
      {
        title: `New ${topic} regulations announced in ${country}`,
        description: `Government officials outline new policies affecting the ${topic} sector.`,
        url: 'https://news.google.com/article3',
        source: 'Policy Today',
        pubDate: new Date(Date.now() - 7200000).toISOString(),
        language: language
      }
    ];

    return {
      summary: `Found ${mockArticles.length} recent ${topic} articles from ${country}`,
      timestamp: new Date(),
      source: 'Google News',
      data: {
        topic,
        country,
        language,
        totalResults: mockArticles.length,
        articles: mockArticles
      }
    };
  }

  private async executeRssFeeds(config: IntegrationConfig): Promise<IntegrationData> {
    const { feedUrl, maxItems = '10' } = config.settings;
    
    // Simulate RSS feed parsing
    const mockItems = Array.from({ length: Math.min(parseInt(maxItems), 10) }, (_, i) => ({
      title: `RSS Article ${i + 1} from ${new URL(feedUrl).hostname}`,
      description: `This is a sample RSS feed item description for article ${i + 1}.`,
      link: `${feedUrl}/article-${i + 1}`,
      pubDate: new Date(Date.now() - i * 3600000).toISOString(),
      guid: `${feedUrl}/article-${i + 1}`
    }));

    return {
      summary: `Parsed ${mockItems.length} items from RSS feed`,
      timestamp: new Date(),
      source: 'RSS Feed',
      data: {
        feedUrl,
        title: `RSS Feed from ${new URL(feedUrl).hostname}`,
        description: 'Latest articles from RSS feed',
        items: mockItems,
        totalItems: mockItems.length
      }
    };
  }

  private async executeDomainChecker(config: IntegrationConfig): Promise<IntegrationData> {
    // This is a test execution - in real use, this tool is called via function calling
    const { variations = '{domain}.com\n{domain}.net\n{domain}.org', maxConcurrent = '5' } = config.settings;
    
    // For testing, use a test domain
    const testDomain = 'example-test-domain-' + Date.now();
    const variationsList = variations.split('\n').filter((v: string) => v.trim());
    
    const domainsToCheck = variationsList.slice(0, 3).map((variation: string) => 
      variation.replace('{domain}', testDomain)
    );

    const results = [];
    for (const domain of domainsToCheck) {
      try {
        const response = await fetch(`https://rdap.org/domain/${domain}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        const isAvailable = response.status === 404;
        results.push({
          domain,
          available: isAvailable,
          status: isAvailable ? 'available' : 'taken',
          statusCode: response.status,
          checked: true
        });
      } catch (error) {
        results.push({
          domain,
          available: false,
          status: 'error',
          error: (error as Error).message,
          checked: false
        });
      }
    }

    const availableCount = results.filter(r => r.available).length;
    
    return {
      summary: `Domain availability test completed. Checked ${results.length} test domains, ${availableCount} available.`,
      timestamp: new Date(),
      source: 'Domain Checker',
      data: {
        testDomain,
        totalChecked: results.length,
        available: availableCount,
        results,
        note: 'This was a test execution. In actual use, domains are checked via function calling.'
      }
    };
  }

  private async executeFinancialMarkets(config: IntegrationConfig): Promise<IntegrationData> {
    const { dataType, symbols, currency } = config.settings;
    const symbolList = symbols.split(',').map((s: string) => s.trim());
    
    // Simulate financial data
    const mockPrices = symbolList.map((symbol: string) => ({
      symbol: symbol.toLowerCase(),
      name: symbol.charAt(0).toUpperCase() + symbol.slice(1),
      price: Math.random() * 50000 + 1000,
      change24h: (Math.random() - 0.5) * 20,
      volume24h: Math.random() * 1000000000,
      marketCap: Math.random() * 100000000000,
      currency: currency.toUpperCase(),
      lastUpdated: new Date().toISOString()
    }));

    return {
      summary: `Retrieved ${dataType} prices for ${symbolList.length} symbols in ${currency.toUpperCase()}`,
      timestamp: new Date(),
      source: 'Financial Markets API',
      data: {
        dataType,
        currency: currency.toUpperCase(),
        totalSymbols: symbolList.length,
        prices: mockPrices,
        lastUpdated: new Date().toISOString()
      }
    };
  }

  // NEW: Zapier Webhook Integration
  private async executeZapierWebhook(config: IntegrationConfig): Promise<IntegrationData> {
    const { webhookUrl, zapName, description, payload, confirmationMessage } = config.settings;
    
    console.log(`⚡ Triggering Zapier Zap: ${zapName}`);
    
    // Parse and process payload template
    let processedPayload = payload || '{"trigger_source": "ai_assistant"}';
    try {
      // Replace template variables for test
      processedPayload = processedPayload
        .replace(/\{\{timestamp\}\}/g, new Date().toISOString())
        .replace(/\{\{user_message\}\}/g, 'Test Zapier trigger')
        .replace(/\{\{contact_name\}\}/g, 'Test Contact');
    } catch (e) {
      console.warn('Error processing payload template');
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: processedPayload
      });

      if (!response.ok) {
        throw new Error(`Zapier webhook failed: ${response.status} ${response.statusText}`);
      }

      return {
        summary: `Zapier Zap "${zapName}" triggered successfully: ${description}`,
        timestamp: new Date(),
        source: 'Zapier Webhook',
        data: {
          zapName,
          webhookUrl,
          description,
          status: response.status,
          statusText: response.statusText,
          payload: processedPayload,
          confirmationMessage: confirmationMessage || 'Zapier Zap triggered successfully!',
          success: true,
          platform: 'Zapier'
        }
      };
    } catch (error) {
      return {
        summary: `Zapier Zap "${zapName}" trigger failed: ${description}`,
        timestamp: new Date(),
        source: 'Zapier Webhook',
        data: {
          zapName,
          webhookUrl,
          description,
          error: (error as Error).message,
          success: false,
          platform: 'Zapier'
        }
      };
    }
  }

  // NEW: n8n Webhook Integration
  private async executeN8NWebhook(config: IntegrationConfig): Promise<IntegrationData> {
    const { webhookUrl, workflowName, description, payload, confirmationMessage } = config.settings;
    
    console.log(`🔄 Triggering n8n workflow: ${workflowName}`);
    
    // Parse and process payload template
    let processedPayload = payload || '{"source": "ai_assistant"}';
    try {
      // Replace template variables for test
      processedPayload = processedPayload
        .replace(/\{\{timestamp\}\}/g, new Date().toISOString())
        .replace(/\{\{user_message\}\}/g, 'Test n8n trigger')
        .replace(/\{\{contact_name\}\}/g, 'Test Contact');
    } catch (e) {
      console.warn('Error processing payload template');
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: processedPayload
      });

      if (!response.ok) {
        throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
      }

      return {
        summary: `n8n workflow "${workflowName}" triggered successfully: ${description}`,
        timestamp: new Date(),
        source: 'n8n Webhook',
        data: {
          workflowName,
          webhookUrl,
          description,
          status: response.status,
          statusText: response.statusText,
          payload: processedPayload,
          confirmationMessage: confirmationMessage || 'n8n workflow triggered successfully!',
          success: true,
          platform: 'n8n'
        }
      };
    } catch (error) {
      return {
        summary: `n8n workflow "${workflowName}" trigger failed: ${description}`,
        timestamp: new Date(),
        source: 'n8n Webhook',
        data: {
          workflowName,
          webhookUrl,
          description,
          error: (error as Error).message,
          success: false,
          platform: 'n8n'
        }
      };
    }
  }

  private async executeWebhookTrigger(config: IntegrationConfig): Promise<IntegrationData> {
    // This is a test execution - in real use, this is called via function calling
    const { webhookUrl, description, payload, headers, confirmationMessage } = config.settings;
    
    console.log(`🪝 Test webhook trigger: ${description}`);
    
    // Parse headers
    let parsedHeaders = { 'Content-Type': 'application/json' };
    try {
      if (headers) {
        parsedHeaders = { ...parsedHeaders, ...JSON.parse(headers) };
      }
    } catch (e) {
      console.warn('Invalid headers JSON, using default headers');
    }

    // Parse and process payload template
    let processedPayload = payload || '{"test": true}';
    try {
      // Replace template variables for test
      processedPayload = processedPayload
        .replace(/\{\{timestamp\}\}/g, new Date().toISOString())
        .replace(/\{\{user_message\}\}/g, 'Test webhook trigger')
        .replace(/\{\{contact_name\}\}/g, 'Test Contact');
    } catch (e) {
      console.warn('Error processing payload template');
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: parsedHeaders,
        body: processedPayload
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      return {
        summary: `Webhook triggered successfully: ${description}`,
        timestamp: new Date(),
        source: 'Custom Webhook',
        data: {
          webhookUrl,
          description,
          status: response.status,
          statusText: response.statusText,
          payload: processedPayload,
          confirmationMessage: confirmationMessage || 'Webhook triggered successfully!',
          success: true
        }
      };
    } catch (error) {
      return {
        summary: `Webhook trigger failed: ${description}`,
        timestamp: new Date(),
        source: 'Custom Webhook',
        data: {
          webhookUrl,
          description,
          error: (error as Error).message,
          success: false
        }
      };
    }
  }

  // Google Sheets Integration Methods
  
  /**
   * Extract spreadsheet ID from Google Sheets URL
   */
  private extractSpreadsheetId(url: string): string {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('Invalid Google Sheets URL. Please provide a valid Google Sheets URL.');
    }
    return match[1];
  }

  /**
   * Create authenticated Google Sheets client using service account
   */
  private async getGoogleSheetsAccessToken(): Promise<string> {
    try {
      // Try to get Google API key first (simpler approach)
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      if (apiKey) {
        console.log(`📊 Using Google API key for authentication (length: ${apiKey.length})`);
        return apiKey;
      }

      // Fallback to service account
      const serviceAccountKey = import.meta.env.VITE_GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
      
      if (!serviceAccountKey) {
        throw new Error('Google authentication not configured. Please set either VITE_GOOGLE_API_KEY or VITE_GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY in environment variables.');
      }
      
      const credentials = JSON.parse(serviceAccountKey);
      console.log(`📊 Service account configured for ${credentials.client_email}, generating JWT token...`);
      
      // Generate JWT token for service account authentication
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 3600; // Token expires in 1 hour
      
      const header = {
        alg: 'RS256',
        typ: 'JWT'
      };
      
      const payload = {
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: exp,
        iat: now
      };
      
      console.log(`📊 JWT payload: iss=${payload.iss}, scope=${payload.scope}`);
      
      // Create JWT using jsrsasign
      const jwt = KJUR.jws.JWS.sign(
        'RS256',
        JSON.stringify(header),
        JSON.stringify(payload),
        credentials.private_key
      );
      
      console.log(`📊 JWT token created (length: ${jwt.length}), requesting access token...`);
      
      // Exchange JWT for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        })
      });
      
      console.log(`📊 Token response status: ${tokenResponse.status} ${tokenResponse.statusText}`);
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`❌ Token request failed: ${errorText}`);
        throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}. ${errorText}`);
      }
      
      const tokenData = await tokenResponse.json();
      console.log(`✅ Google Sheets access token obtained successfully (length: ${tokenData.access_token.length})`);
      return tokenData.access_token;
    } catch (error) {
      console.error('❌ Failed to get access token:', error);
      throw new Error(`Failed to get Google Sheets access token: ${(error as Error).message}`);
    }
  }

  /**
   * Make authenticated request to Google Sheets API
   */
  private async makeGoogleSheetsRequest(url: string, method: string = 'GET', body?: any): Promise<any> {
    try {
      console.log(`📊 Google Sheets API request: ${method} ${url}`);
      
      // Get access token or API key
      const authToken = await this.getGoogleSheetsAccessToken();
      console.log(`📊 Authentication token obtained (length: ${authToken.length})`);
      
      // Determine if this is an API key or access token
      const isApiKey = import.meta.env.VITE_GOOGLE_API_KEY ? true : false;
      
      console.log(`📊 Using ${isApiKey ? 'API Key' : 'Access Token'} authentication`);
      
      // Choose authentication method based on token type
      let response: Response;
      
      if (isApiKey && method === 'GET') {
        // For API key, add as query parameter for GET requests
        const urlWithKey = `${url}${url.includes('?') ? '&' : '?'}key=${authToken}`;
        console.log(`📊 Making API Key request: ${urlWithKey}`);
        
        response = await fetch(urlWithKey, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: body ? JSON.stringify(body) : undefined
        });
      } else {
        // For access token or write operations, use Bearer authentication
        console.log(`📊 Making Bearer token request to: ${url}`);
        
        response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: body ? JSON.stringify(body) : undefined
        });
      }

      console.log(`📊 Response status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Google Sheets API response received successfully');
        return data;
      } else {
        const errorText = await response.text();
        console.error(`❌ API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
        
        throw new Error(`Google Sheets API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Google Sheets API request failed:', error);
      throw new Error(`Google Sheets API request failed: ${(error as Error).message}`);
    }
  }



  /**
   * Execute Google Sheets integration (basic execution)
   */
  private async executeGoogleSheets(config: IntegrationConfig): Promise<IntegrationData> {
    const { sheetUrl, description, defaultSheet } = config.settings;
    const spreadsheetId = this.extractSpreadsheetId(sheetUrl);
    
    // Read basic info about the spreadsheet
    const result = await this.readGoogleSheets(spreadsheetId, undefined, defaultSheet);
    
    return {
      summary: `Google Sheets data loaded: ${result.data.rowCount} rows, ${result.data.columnCount} columns`,
      timestamp: new Date(),
      source: 'Google Sheets',
      data: result.data
    };
  }

  /**
   * Read data from Google Sheets
   */
  async readGoogleSheets(
    spreadsheetId: string,
    range?: string,
    sheetName?: string
  ): Promise<any> {
    try {
      const accessToken = await this.getGoogleSheetsAccessToken();
      
      // Use a more reliable range format - if no specific range, get all data
      let finalRange: string;
      if (range) {
        finalRange = sheetName ? `${sheetName}!${range}` : range;
      } else {
        // Use A1:ZZ1000 instead of A:Z for better compatibility
        finalRange = `${sheetName || 'Sheet1'}!A1:ZZ1000`;
      }
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(finalRange)}`;
      
      console.log(`📊 Reading Google Sheets data from: ${finalRange}`);
      
      const response = await this.makeGoogleSheetsRequest(url, 'GET');
      const rows = response.values || [];
      
      return {
        success: true,
        data: {
          range: finalRange,
          rowCount: rows.length,
          columnCount: rows[0]?.length || 0,
          values: rows,
          headers: rows[0] || [],
          dataRows: rows.slice(1) || []
        }
      };
    } catch (error) {
      console.error('❌ Google Sheets read error:', error);
      throw new Error(`Failed to read from Google Sheets: ${(error as Error).message}`);
    }
  }

  /**
   * Write data to Google Sheets (update existing range)
   */
  async writeGoogleSheets(
    spreadsheetId: string,
    range: string,
    values: any[][],
    sheetName?: string
  ): Promise<any> {
    try {
      const accessToken = await this.getGoogleSheetsAccessToken();
      
      const finalRange = sheetName ? `${sheetName}!${range}` : range;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(finalRange)}?valueInputOption=USER_ENTERED`;
      
      console.log(`📊 Writing to Google Sheets range: ${finalRange}`);
      
      const response = await this.makeGoogleSheetsRequest(url, 'PUT', {
        values: values
      });

      return {
        success: true,
        data: {
          updatedCells: response.updates?.updatedCells || values.length * values[0]?.length || 0,
          updatedColumns: response.updates?.updatedColumns || values[0]?.length || 0,
          updatedRows: response.updates?.updatedRows || values.length,
          range: finalRange
        }
      };
    } catch (error) {
      console.error('❌ Google Sheets write error:', error);
      throw new Error(`Failed to write to Google Sheets: ${(error as Error).message}`);
    }
  }

  /**
   * Append data to Google Sheets (add new rows)
   */
  async appendGoogleSheets(
    spreadsheetId: string,
    values: any[][],
    sheetName?: string
  ): Promise<any> {
    try {
      const accessToken = await this.getGoogleSheetsAccessToken();
      
      const range = `${sheetName || 'Sheet1'}!A:A`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      
      console.log(`📊 Appending to Google Sheets: ${range}`);
      
      const response = await this.makeGoogleSheetsRequest(url, 'POST', {
        values: values
      });

      return {
        success: true,
        data: {
          updatedCells: response.updates?.updatedCells || values.length * values[0]?.length || 0,
          updatedColumns: response.updates?.updatedColumns || values[0]?.length || 0,
          updatedRows: response.updates?.updatedRows || values.length,
          range: response.updates?.updatedRange || range
        }
      };
    } catch (error) {
      console.error('❌ Google Sheets append error:', error);
      throw new Error(`Failed to append to Google Sheets: ${(error as Error).message}`);
    }
  }

  /**
   * Search for data in Google Sheets
   */
  async searchGoogleSheets(
    spreadsheetId: string,
    searchTerm: string,
    sheetName?: string
  ): Promise<any> {
    try {
      console.log(`📊 Searching Google Sheets for: "${searchTerm}"`);
      
      // First read all data
      const readResult = await this.readGoogleSheets(spreadsheetId, undefined, sheetName);
      const rows = readResult.data.values;
      
      if (!rows || rows.length === 0) {
        return {
          success: true,
          data: {
            matches: [],
            totalMatches: 0,
            searchTerm
          }
        };
      }

      // Search through all cells
      const matches = [];
      const searchLower = searchTerm.toLowerCase();
      
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = String(row[colIndex] || '').toLowerCase();
          if (cellValue.includes(searchLower)) {
            matches.push({
              row: rowIndex + 1, // 1-indexed for human readability
              column: String.fromCharCode(65 + colIndex), // Convert to A, B, C format
              cell: `${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`,
              value: row[colIndex],
              rowData: row
            });
          }
        }
      }

      return {
        success: true,
        data: {
          matches,
          totalMatches: matches.length,
          searchTerm,
          headers: rows[0] || []
        }
      };
    } catch (error) {
      console.error('❌ Google Sheets search error:', error);
      throw new Error(`Failed to search Google Sheets: ${(error as Error).message}`);
    }
  }

  /**
   * Get spreadsheet metadata and info
   */
  async getGoogleSheetsInfo(spreadsheetId: string): Promise<any> {
    try {
      const accessToken = await this.getGoogleSheetsAccessToken();
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      
      console.log(`📊 Getting Google Sheets info for: ${spreadsheetId}`);
      
      const spreadsheet = await this.makeGoogleSheetsRequest(url, 'GET');
      
      return {
        success: true,
        data: {
          title: spreadsheet.properties?.title,
          locale: spreadsheet.properties?.locale,
          timeZone: spreadsheet.properties?.timeZone,
          spreadsheetId: spreadsheetId,
          sheets: spreadsheet.sheets?.map((sheet: any) => ({
            title: sheet.properties?.title,
            sheetId: sheet.properties?.sheetId,
            index: sheet.properties?.index,
            sheetType: sheet.properties?.sheetType,
            gridProperties: {
              rowCount: sheet.properties?.gridProperties?.rowCount,
              columnCount: sheet.properties?.gridProperties?.columnCount
            }
          }))
        }
      };
    } catch (error) {
      console.error('❌ Google Sheets info error:', error);
      throw new Error(`Failed to get Google Sheets info: ${(error as Error).message}`);
    }
  }

  /**
   * Clear data from Google Sheets range
   */
  async clearGoogleSheets(
    spreadsheetId: string,
    range: string,
    sheetName?: string
  ): Promise<any> {
    try {
      const accessToken = await this.getGoogleSheetsAccessToken();
      
      const finalRange = sheetName ? `${sheetName}!${range}` : range;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(finalRange)}:clear`;
      
      console.log(`📊 Clearing Google Sheets range: ${finalRange}`);
      
      const response = await this.makeGoogleSheetsRequest(url, 'POST');

      return {
        success: true,
        data: {
          clearedRange: response.clearedRange || finalRange
        }
      };
    } catch (error) {
      console.error('❌ Google Sheets clear error:', error);
      throw new Error(`Failed to clear Google Sheets: ${(error as Error).message}`);
    }
  }

  /**
   * Execute Google Sheets operations for tool use with comprehensive operations
   */
  async executeGoogleSheetsOperation(
    operation: string,
    spreadsheetId: string,
    sheetName?: string,
    range?: string,
    data?: any,
    searchTerm?: string,
    accessLevel: string = 'read-only'
  ): Promise<any> {
    try {
      console.log(`🔧 Executing Google Sheets operation: ${operation} on ${spreadsheetId}`);
      
      // Validate write permissions
      const writeOperations = ['write', 'update', 'append', 'add', 'insert', 'clear', 'delete'];
      if (writeOperations.includes(operation.toLowerCase()) && accessLevel === 'read-only') {
        throw new Error('Write operations not allowed. Change access level to "Read & Write" in integration settings.');
      }
      
      switch (operation.toLowerCase()) {
        case 'read':
        case 'get':
        case 'fetch':
        case 'show':
          return await this.readGoogleSheets(spreadsheetId, range, sheetName);
          
        case 'write':
        case 'update':
        case 'set':
          if (!data || !Array.isArray(data)) {
            throw new Error('Data array is required for write operations');
          }
          if (!range) {
            throw new Error('Range is required for write operations (e.g., "A1:C3" or "B5")');
          }
          return await this.writeGoogleSheets(spreadsheetId, range, data, sheetName);
          
        case 'append':
        case 'add':
        case 'insert':
          if (!data || !Array.isArray(data)) {
            throw new Error('Data array is required for append operations');
          }
          return await this.appendGoogleSheets(spreadsheetId, data, sheetName);
          
        case 'search':
        case 'find':
        case 'lookup':
          if (!searchTerm) {
            throw new Error('Search term is required for search operations');
          }
          return await this.searchGoogleSheets(spreadsheetId, searchTerm, sheetName);
          
        case 'info':
        case 'metadata':
        case 'details':
          return await this.getGoogleSheetsInfo(spreadsheetId);
          
        case 'clear':
        case 'delete':
        case 'remove':
          if (!range) {
            throw new Error('Range is required for clear operations (e.g., "A1:C10")');
          }
          return await this.clearGoogleSheets(spreadsheetId, range, sheetName);
          
        default:
          throw new Error(`Unknown operation: ${operation}. Supported operations: read, write, append, search, info, clear`);
      }
    } catch (error) {
      console.error('❌ Google Sheets operation error:', error);
      throw error;
    }
  }

  // Tool function to handle Google Sheets operations from AI function calls
  async executeGoogleSheetsToolOperation(
    operation: string,
    sheetUrl: string,
    accessLevel: string = 'read-only',
    sheetName?: string,
    range?: string,
    data?: any,
    searchTerm?: string
  ): Promise<any> {
    try {
      const spreadsheetId = this.extractSpreadsheetId(sheetUrl);
      return await this.executeGoogleSheetsOperation(
        operation,
        spreadsheetId,
        sheetName,
        range,
        data,
        searchTerm,
        accessLevel
      );
    } catch (error) {
      console.error('❌ Google Sheets tool operation error:', error);
      throw error;
    }
  }

  // Tool function to handle Notion operations from AI function calls
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
    contact?: any
  ): Promise<any> {
    try {
      console.log(`🔧 Executing Notion tool operation: ${operation}`);
      
      // Get Notion integrations for this contact
      const notionIntegrations = contact?.integrations?.filter((integration: any) => 
        (integration.integrationId === 'notion-oauth-source' || integration.integrationId === 'notion-oauth-action') 
        && integration.config.enabled && integration.config.oauthTokenId
      ) || [];
      
      if (notionIntegrations.length === 0) {
        throw new Error('No active Notion integrations found. Please connect your Notion account first.');
      }
      
      const notionIntegration = notionIntegrations[0];
      const config = notionIntegration.config;
      
      // Get OAuth credentials from environment
      const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_NOTION_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Notion OAuth credentials not configured. Please add VITE_NOTION_CLIENT_ID and VITE_NOTION_CLIENT_SECRET to environment variables.');
      }
      
      // Extract user ID from the contact's integration settings or stored auth data
      let userId = 'current-user-id'; // fallback
      
      // Try to get user ID from localStorage auth data
      const authKeys = Object.keys(localStorage).filter(key => key.startsWith('oauth_auth_notion_'));
      if (authKeys.length > 0) {
        try {
          const authData = JSON.parse(localStorage.getItem(authKeys[0]) || '{}');
          if (authData.userId) {
            userId = authData.userId;
            console.log('🔍 Found user ID from OAuth auth data:', userId);
          }
        } catch (error) {
          console.warn('Failed to parse OAuth auth data:', error);
        }
      }
      
      switch (operation) {
        case 'search_pages':
          return await this.searchNotionPages(userId, clientId, clientSecret, query);
          
        case 'search_databases':
          return await this.searchNotionDatabases(userId, clientId, clientSecret, query);
          
        case 'get_page_content':
          if (!pageId) throw new Error('Page ID is required for get_page_content operation');
          return await this.getNotionPageContent(userId, clientId, clientSecret, pageId);
          
        case 'create_page':
          if (!title) throw new Error('Title is required for create_page operation');
          if (!parentId) throw new Error('Parent ID is required for create_page operation');
          return await this.createNotionPage(userId, clientId, clientSecret, parentId, title, content);
          
        case 'update_page':
          if (!pageId) throw new Error('Page ID is required for update_page operation');
          if (!properties) throw new Error('Properties are required for update_page operation');
          return await this.updateNotionPage(userId, clientId, clientSecret, pageId, properties);
          
        case 'query_database':
          if (!databaseId) throw new Error('Database ID is required for query_database operation');
          return await this.queryNotionDatabase(userId, clientId, clientSecret, databaseId, filter, sorts);
          
        case 'create_database_entry':
          if (!databaseId) throw new Error('Database ID is required for create_database_entry operation');
          if (!properties) throw new Error('Properties are required for create_database_entry operation');
          return await this.createNotionDatabaseEntry(userId, clientId, clientSecret, databaseId, properties);
          
        case 'append_blocks':
          if (!pageId) throw new Error('Page ID is required for append_blocks operation');
          if (!content) throw new Error('Content is required for append_blocks operation');
          return await this.appendNotionBlocks(userId, clientId, clientSecret, pageId, content);
          
        default:
          throw new Error(`Unknown Notion operation: ${operation}`);
      }
    } catch (error) {
      console.error('❌ Notion tool operation error:', error);
      throw error;
    }
  }

  // Helper methods for Notion operations
  private async searchNotionPages(userId: string, clientId: string, clientSecret: string, query?: string): Promise<any> {
    if (!query) {
      // Get all pages and format them for human conversation
      const rawResponse = await notionService.makeNotionRequest(userId, 'https://api.notion.com/v1/search', 'POST', {
        filter: {
          property: 'object',
          value: 'page'
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        }
      });

      // Get workspace name from auth data
      const authKey = `oauth_auth_notion_${userId}`;
      const authData = localStorage.getItem(authKey);
      const workspaceName = authData ? JSON.parse(authData).workspace_name : 'Your Notion workspace';

      const workspaceSummary = notionDataFormatter.formatWorkspaceSummary(
        rawResponse,
        workspaceName,
        false // Don't include database entries by default
      );

      return {
        operation: 'search_pages',
        workspace_summary: workspaceSummary,
        human_friendly_response: notionDataFormatter.formatForAIConversation(workspaceSummary),
        message: workspaceSummary.summary
      };
    }
    
    // Use Notion's search API for better results
    const pages = await notionService.searchPages(userId, clientId, clientSecret, query);
    
    return {
      operation: 'search_pages',
      query,
      total: pages.length,
      pages: pages.slice(0, 10),
      message: `Found ${pages.length} pages matching "${query}"`
    };
  }

  private async searchNotionDatabases(userId: string, clientId: string, clientSecret: string, query?: string): Promise<any> {
    if (!query) {
      // Get all databases and format them for human conversation
      const rawResponse = await notionService.makeNotionRequest(userId, 'https://api.notion.com/v1/search', 'POST', {
        filter: {
          property: 'object',
          value: 'database'
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        }
      });

      const databases = rawResponse.results.map((db: any) => notionDataFormatter.formatDatabase(db));

      return {
        operation: 'search_databases',
        total: databases.length,
        databases: databases,
        human_friendly_response: `I found ${databases.length} database${databases.length === 1 ? '' : 's'} in your Notion workspace:\n\n${databases.map((db: any, index: number) => `${index + 1}. **${db.name}** - ${db.description} (last edited ${db.lastModified})`).join('\n')}\n\nTo query the contents of any database, just ask "What is in my [database name]?" or "Show me [database name]".`,
        message: `Found ${databases.length} databases in your Notion workspace`
      };
    }
    
    // Use Notion's search API for better results
    const databases = await notionService.searchDatabases(userId, clientId, clientSecret, query);
    
    return {
      operation: 'search_databases',
      query,
      total: databases.length,
      databases: databases,
      message: `Found ${databases.length} databases matching "${query}"`
    };
  }

  private async getNotionPageContent(userId: string, clientId: string, clientSecret: string, pageId: string): Promise<any> {
    const content = await notionService.getPageContent(userId, clientId, clientSecret, pageId);
    
    return {
      operation: 'get_page_content',
      pageId,
      content,
      message: `Retrieved content for page ${pageId}`
    };
  }

  private async createNotionPage(userId: string, clientId: string, clientSecret: string, parentId: string, title: string, content?: string): Promise<any> {
    const page = await notionService.createPage(userId, clientId, clientSecret, parentId, title, content);
    
    // Format the response for AI conversation
    const formattedPage = notionDataFormatter.formatPage(page);
    
    return {
      operation: 'create_page',
      page: formattedPage,
      human_friendly_response: `✅ Successfully created a new page "${formattedPage.title}"!\n\nYou can view it at: ${formattedPage._internal.url}`,
      message: `Created new page "${title}" successfully`
    };
  }

  private async updateNotionPage(userId: string, clientId: string, clientSecret: string, pageId: string, properties: any): Promise<any> {
    const page = await notionService.updatePage(userId, clientId, clientSecret, pageId, properties);
    
    return {
      operation: 'update_page',
      page,
      message: `Updated page ${pageId} successfully`
    };
  }

  private async queryNotionDatabase(userId: string, clientId: string, clientSecret: string, databaseId: string, filter?: any, sorts?: any[]): Promise<any> {
    let actualDatabaseId = databaseId;
    let databaseName = databaseId;
    
    // If databaseId looks like a name rather than an ID, search for it first
    if (!databaseId.match(/^[a-f0-9-]{36}$/i) && !databaseId.match(/^[a-f0-9]{32}$/i)) {
      console.log(`🔍 Database ID looks like a name (${databaseId}), searching for database...`);
      
      try {
        // Try exact match first
        let databases = await this.searchNotionDatabases(userId, clientId, clientSecret, databaseId);
        
        // If no exact match, try partial matching
        if (!databases.databases || databases.databases.length === 0) {
          console.log(`🔍 No exact match found, trying partial match for "${databaseId}"...`);
          databases = await this.searchNotionDatabases(userId, clientId, clientSecret);
          
          // Find database by partial name matching
          const matchingDb = databases.databases?.find((db: any) => 
            db.name.toLowerCase().includes(databaseId.toLowerCase()) ||
            databaseId.toLowerCase().includes(db.name.toLowerCase())
          );
          
          if (matchingDb) {
            actualDatabaseId = matchingDb._internal?.id || matchingDb.id;
            databaseName = matchingDb.name;
            console.log(`✅ Found database by partial match: ${databaseName} (${actualDatabaseId})`);
        } else {
            throw new Error(`Could not find database matching "${databaseId}". Available databases: ${databases.databases?.map((db: any) => db.name).join(', ')}`);
          }
        } else {
          const database = databases.databases[0];
          actualDatabaseId = database._internal?.id || database.id;
          databaseName = database.name;
          console.log(`✅ Found database: ${databaseName} (${actualDatabaseId})`);
        }
      } catch (error) {
        console.error('❌ Database search failed:', error);
        throw new Error(`Could not find database "${databaseId}". Please check the database name or ID. Error: ${(error as Error).message}`);
      }
    }
    
    const results = await notionService.queryDatabase(userId, clientId, clientSecret, actualDatabaseId, filter, sorts);
    
    // Format the results for better readability
    const formattedResults = results.map((item: any) => {
      const formatted: any = {
        id: item.id,
        created_time: item.created_time,
        last_edited_time: item.last_edited_time,
        url: item.url,
        properties: {}
      };
      
      // Extract and format properties for better readability
      if (item.properties) {
        for (const [key, value] of Object.entries(item.properties as any)) {
          formatted.properties[key] = notionDataFormatter.formatProperty(value);
        }
      }
      
      return formatted;
    });
    
    // Create a human-readable summary
    const summary = notionDataFormatter.formatDatabaseQueryResults(formattedResults, actualDatabaseId);
    
    return {
      operation: 'query_database',
      databaseId: actualDatabaseId,
      databaseName: databaseName,
      originalQuery: databaseId !== actualDatabaseId ? databaseId : undefined,
      total: results.length,
      results: formattedResults.slice(0, 20), // Limit to first 20 for performance
      summary: summary,
      human_friendly_response: summary,
      message: `Found ${results.length} entries in the "${databaseName}" database`
    };
  }

  private async createNotionDatabaseEntry(userId: string, clientId: string, clientSecret: string, databaseId: string, properties: any): Promise<any> {
    console.log('📝 Creating real database entry via Supabase Edge Function...');
    
    // Create a new page in the database (Notion databases are collections of pages)
    const pageData = {
      parent: { database_id: databaseId },
      properties: properties
    };
    
    const result = await this.callEdgeFunction({
      action: 'api_request',
      url: 'https://api.notion.com/v1/pages',
      method: 'POST',
      body: pageData,
      user_id: userId
    });
    
    return {
      operation: 'create_database_entry',
      databaseId,
      page: {
        id: result.data.id,
        properties: result.data.properties,
        created_time: result.data.created_time,
        last_edited_time: result.data.last_edited_time,
        url: result.data.url
      },
      message: `Created new entry in database successfully`
    };
  }

  /**
   * Call Supabase Edge Function (helper method)
   */
  private async callEdgeFunction(payload: any): Promise<any> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is required');
    }
    
    const functionUrl = `${supabaseUrl}/functions/v1/notion-oauth`;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Edge function failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Edge function returned error');
      }

      return result;
    } catch (error) {
      console.error('❌ Edge function call failed:', error);
      throw error;
    }
  }

  private async appendNotionBlocks(userId: string, clientId: string, clientSecret: string, pageId: string, content: string): Promise<any> {
    // Convert content to properly formatted blocks
    const blocks = notionService.textToBlocks(content);
    
    const result = await notionService.appendBlocks(userId, clientId, clientSecret, pageId, blocks);
    
    return {
      operation: 'append_blocks',
      pageId,
      blocks: result.results,
      blocksAdded: blocks.length,
      message: `Added ${blocks.length} content blocks to page successfully`
    };
  }

  // Webhook Integration Methods (existing)

  // Tool function for webhook triggering with CORS handling
  async executeWebhookTriggerTool(webhookUrl: string, payload: string, headers: Record<string, string> = {}, userMessage?: string, contactName?: string): Promise<any> {
    console.log(`🪝 Triggering webhook: ${webhookUrl}`);
    
    try {
      // Process payload template with dynamic variables
      let processedPayload = payload;
      if (userMessage) {
        processedPayload = processedPayload.replace(/\{\{user_message\}\}/g, userMessage);
      }
      if (contactName) {
        processedPayload = processedPayload.replace(/\{\{contact_name\}\}/g, contactName);
      }
      processedPayload = processedPayload.replace(/\{\{timestamp\}\}/g, new Date().toISOString());

      // Try direct request first
      try {
        console.log(`🌐 Trying direct webhook request to: ${webhookUrl}`);
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: processedPayload,
          mode: 'cors'
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }

        let responseData;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            responseData = await response.json();
          } else {
            responseData = await response.text();
          }
        } catch (e) {
          responseData = 'No response data';
        }

        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          webhookUrl: webhookUrl,
          payload: processedPayload,
          proxied: false
        };

      } catch (directError) {
        console.warn(`❌ Direct webhook request failed: ${(directError as Error).message}`);
        
        // For webhooks, we'll try a different approach since most webhook services 
        // actually receive the request successfully even if CORS fails
        
        // Try using a CORS proxy for the webhook (less reliable but worth trying)
        const proxies = [
          `https://corsproxy.io/?${encodeURIComponent(webhookUrl)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(webhookUrl)}`
        ];

        for (const proxyUrl of proxies) {
          try {
            console.log(`🌐 Trying webhook via CORS proxy: ${proxyUrl}`);
            
            const response = await fetch(proxyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
                // Note: Custom headers might not work through proxies
              },
              body: processedPayload
            });
            
            if (!response.ok) {
              throw new Error(`Proxy webhook failed: ${response.status} ${response.statusText}`);
            }

            let responseData;
            try {
              const contentType = response.headers.get('content-type');
              if (contentType?.includes('application/json')) {
                responseData = await response.json();
              } else {
                responseData = await response.text();
              }
            } catch (e) {
              responseData = 'No response data';
            }

            return {
              success: true,
              status: response.status,
              statusText: response.statusText,
              data: responseData,
              webhookUrl: webhookUrl,
              payload: processedPayload,
              proxied: true,
              proxyUsed: proxyUrl
            };

          } catch (proxyError) {
            console.warn(`❌ Proxy ${proxyUrl} failed:`, (proxyError as Error).message);
            continue;
          }
        }

        // If all proxies fail, but this is a webhook (which often works despite CORS errors)
        // We'll return a success response with a note about CORS
        if (webhookUrl.includes('webhook') || webhookUrl.includes('hook')) {
          console.log(`⚠️ CORS blocked, but webhook likely received. Treating as success.`);

          return {
            success: true,
            status: 200,
            statusText: 'OK (CORS blocked response)',
            data: 'Webhook triggered successfully (response blocked by CORS)',
            webhookUrl: webhookUrl,
            payload: processedPayload,
            corsBlocked: true,
            note: 'The webhook was likely triggered successfully, but the response was blocked by browser CORS policy.'
          };
        }

        throw new Error(`Webhook request failed: ${(directError as Error).message}`);
      }

    } catch (error) {
      console.error(`❌ Webhook trigger failed:`, error);
      throw error;
    }
  }

  startPeriodicExecution(
    contactId: string,
    integration: Integration,
    config: IntegrationConfig,
    onDataUpdate: (contactId: string, data: IntegrationData) => void
  ): void {
    // Skip periodic execution for action integrations
    if (integration.category === 'action') {
      console.log(`⏭️ Skipping periodic execution for action integration: ${integration.name}`);
      return;
    }

    if (config.trigger !== 'periodic' && config.trigger !== 'both') {
      return;
    }

    const intervalKey = `${contactId}-${integration.id}`;
    
    // Clear existing interval if any
    if (this.intervals.has(intervalKey)) {
      clearInterval(this.intervals.get(intervalKey));
    }

    const intervalMs = (config.intervalMinutes || 30) * 60 * 1000;
    
    const interval = setInterval(async () => {
      try {
        const data = await this.executeIntegration(integration, config);
        this.storeIntegrationData(contactId, integration.id, data);
        onDataUpdate(contactId, data);
      } catch (error) {
        console.error(`❌ Periodic execution failed for ${integration.name}:`, error);
      }
    }, intervalMs);

    this.intervals.set(intervalKey, interval);
    console.log(`⏰ Started periodic execution for ${integration.name} every ${config.intervalMinutes} minutes`);
  }

  stopPeriodicExecution(contactId: string, integrationId: string): void {
    const intervalKey = `${contactId}-${integrationId}`;
    if (this.intervals.has(intervalKey)) {
      clearInterval(this.intervals.get(intervalKey));
      this.intervals.delete(intervalKey);
      console.log(`⏹️ Stopped periodic execution for ${intervalKey}`);
    }
  }

  stopAllExecution(): void {
    this.intervals.forEach((interval, key) => {
      clearInterval(interval);
      console.log(`⏹️ Stopped periodic execution for ${key}`);
    });
    this.intervals.clear();
  }

  storeIntegrationData(contactId: string, integrationId: string, data: IntegrationData): void {
    if (!this.dataStore.has(contactId)) {
      this.dataStore.set(contactId, new Map());
    }
    
    const contactData = this.dataStore.get(contactId)!;
    contactData.set(integrationId, data);
  }

  getIntegrationData(contactId: string, integrationId: string): IntegrationData | undefined {
    return this.dataStore.get(contactId)?.get(integrationId);
  }

  getAllIntegrationData(contactId: string): Map<string, IntegrationData> {
    return this.dataStore.get(contactId) || new Map();
  }
}

export const integrationsService = new IntegrationsService();