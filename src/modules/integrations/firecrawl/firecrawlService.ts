import { AIContact } from '../../../core/types/types';

// Firecrawl API response types
interface FirecrawlResponse {
  success: boolean;
  data?: any;
  error?: string;
  pages?: FirecrawlPage[];
  metadata?: {
    totalPages: number;
    totalSize: number;
    crawlTime: number;
  };
}

interface FirecrawlPage {
  url: string;
  title?: string;
  content?: string;
  markdown?: string;
  html?: string;
  screenshot?: string;
  images?: FirecrawlImage[];
  metadata?: {
    description?: string;
    keywords?: string[];
    author?: string;
    publishedDate?: string;
  };
}

interface FirecrawlImage {
  src: string;
  alt?: string;
  title?: string;
}

interface FirecrawlConfig {
  apiKey: string;
  extractType: 'text' | 'markdown' | 'html' | 'screenshot';
  includeImages?: boolean;
  maxPages?: number;
  crawlDepth?: number;
  allowedDomains?: string[];
}

class FirecrawlService {
  private baseUrl = 'https://api.firecrawl.dev';
  private isProcessing = false;
  private requestQueue: Array<{
    urls: string[];
    config: FirecrawlConfig;
    contact?: AIContact;
    resolve: (value: FirecrawlResponse) => void;
    reject: (reason: any) => void;
  }> = [];

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        console.log('🔄 Processing queued Firecrawl request...');
        const result = await this.executeScrapingInternal(request.urls, request.config, request.contact);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Check if a request is currently being processed
   */
  isRequestInProgress(): boolean {
    return this.isProcessing || this.requestQueue.length > 0;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { isProcessing: boolean; queueLength: number } {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.requestQueue.length
    };
  }

  /**
   * Validate Firecrawl API key using the correct v1 endpoint
   */
  private async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log('🔑 Making validation request to Firecrawl v1 API...');
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          url: 'https://httpbin.org/get',
          formats: ['markdown']
        })
      });

      console.log(`🔑 Validation response status: ${response.status}`);

      // If we get a response (even an error), the API key is valid
      // If we get 401/403, the API key is invalid
      if (response.status === 401 || response.status === 403) {
        console.error('❌ API key validation failed: Unauthorized');
        return false;
      }
      
      // Any other response (including errors) suggests the API key is valid
      console.log('✅ API key appears valid (got non-auth response)');
      return true;
    } catch (error) {
      console.error('❌ API key validation failed:', error);
      return false;
    }
  }

  /**
   * Execute a Firecrawl scraping operation (queued)
   */
  async executeScraping(
    urls: string[],
    config: FirecrawlConfig,
    contact?: AIContact
  ): Promise<FirecrawlResponse> {
    return new Promise((resolve, reject) => {
      // Add request to queue
      this.requestQueue.push({
        urls,
        config,
        contact,
        resolve,
        reject
      });

      // Process queue if not already processing
      this.processQueue();
    });
  }

  /**
   * Internal method to execute scraping (not queued)
   */
  private async executeScrapingInternal(
    urls: string[],
    config: FirecrawlConfig,
    contact?: AIContact
  ): Promise<FirecrawlResponse> {
    try {
      console.log('🕷️ Starting Firecrawl scraping operation');
      console.log('📋 URLs to scrape:', urls);
      console.log('⚙️ Config:', { ...config, apiKey: '[REDACTED]' });

      // Get API key from environment variable
      const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY || config.apiKey;
      if (!apiKey) {
        throw new Error('Firecrawl API key is required. Please set VITE_FIRECRAWL_API_KEY environment variable.');
      }

      // Validate API key (with better error handling)
      console.log('🔑 Validating Firecrawl API key...');
      const isApiKeyValid = await this.validateApiKey(apiKey);
      if (!isApiKeyValid) {
        console.error('❌ API key validation failed');
        throw new Error('Invalid Firecrawl API key. Please check your API key in the .env file or get a new one from https://firecrawl.dev');
      }
      console.log('✅ API key validation successful');

      // Validate and clean URLs
      if (!urls || urls.length === 0) {
        throw new Error('At least one URL is required');
      }

      // Ensure all URLs have https:// protocol
      const cleanedUrls = urls.map(url => {
        let cleanedUrl = url.trim();
        
        // Add https:// if no protocol is specified
        if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
          cleanedUrl = 'https://' + cleanedUrl;
        }
        
        // Validate URL format
        try {
          new URL(cleanedUrl);
          return cleanedUrl;
        } catch (error) {
          throw new Error(`Invalid URL format: ${url}`);
        }
      });

      console.log('🔗 Cleaned URLs:', cleanedUrls);

      console.log('🌐 Attempting direct Firecrawl API call...');

      // Try direct API call first (new v1 API format)
      const requestBody = {
        url: cleanedUrls[0], // v1 API takes a single URL
        formats: [config.extractType === 'text' ? 'markdown' : config.extractType || 'markdown']
      };

      console.log('📤 Firecrawl request body:', requestBody);

      // Add retry logic for Firecrawl API issues
      let lastError: Error | null = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/${maxRetries}... (Direct API)`);
          
          const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
          });

          console.log('📡 Firecrawl response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Firecrawl API error (attempt ${attempt}):`, errorText);
            
                  // Check for specific error types
      if (errorText.includes('Invalid URL')) {
        throw new Error('The Firecrawl API rejected the URL. This could be due to: 1) API key restrictions, 2) The URL not being accessible, 3) The API key being invalid, or 4) The API having changed its requirements. Please check your Firecrawl API key in the .env file or get a new one from https://firecrawl.dev');
      }
            
            // If it's a 502 error (server error), retry
            if (response.status === 502 && attempt < maxRetries) {
              console.log(`⏳ Retrying in ${attempt * 2} seconds...`);
              await new Promise(resolve => setTimeout(resolve, attempt * 2000));
              lastError = new Error(`Firecrawl API error: ${response.status} ${errorText}`);
              continue;
            }
            
            throw new Error(`Firecrawl scraping failed: ${response.status} ${errorText}`);
          }

          const result = await response.json();
          console.log('✅ Firecrawl scraping successful!');
          console.log('📊 Raw API response:', result);

          // Handle new v1 API response format
          const pages = [];
          if (result.data) {
            pages.push({
              url: cleanedUrls[0],
              title: result.data.metadata?.title || '',
              content: result.data.markdown || result.data.html || result.data.text || '',
              markdown: result.data.markdown,
              html: result.data.html,
              metadata: result.data.metadata || {}
            });
          }

          console.log('📊 Processed results:', {
            totalPages: pages.length,
            contentLength: pages[0]?.content?.length || 0
          });

          return {
            success: true,
            data: result.data,
            pages: pages,
            metadata: {
              totalPages: pages.length,
              totalSize: JSON.stringify(result).length,
              crawlTime: 0 // API doesn't provide this
            }
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.error(`❌ Attempt ${attempt} failed:`, lastError.message);
          
          if (attempt < maxRetries) {
            console.log(`⏳ Retrying in ${attempt * 2} seconds...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          }
        }
      }

      // All retries failed
      throw lastError || new Error('All retry attempts failed');

    } catch (error) {
      console.error('❌ Firecrawl scraping failed:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        urls,
        config: { ...config, apiKey: '[REDACTED]' }
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Execute dynamic Firecrawl scraping tool for chat/voice requests
   */
  async executeDynamicScraping(
    url: string,
    config: FirecrawlConfig,
    contact?: AIContact
  ): Promise<FirecrawlResponse> {
    try {
      console.log('🕷️ Starting dynamic Firecrawl scraping');
      console.log('📋 URL to scrape:', url);
      console.log('⚙️ Config:', { ...config, apiKey: '[REDACTED]' });

      // Validate and clean URL
      if (!url) {
        throw new Error('URL is required for dynamic scraping');
      }

      // Ensure URL has https:// protocol
      let cleanedUrl = url.trim();
      if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
        cleanedUrl = 'https://' + cleanedUrl;
      }

      // Validate URL format
      try {
        new URL(cleanedUrl);
      } catch (error) {
        throw new Error(`Invalid URL format: ${url}`);
      }

      // Validate domain if allowedDomains is set
      if (config.allowedDomains && config.allowedDomains.length > 0) {
        const urlDomain = new URL(cleanedUrl).hostname;
        const isAllowed = config.allowedDomains.some(domain => 
          urlDomain === domain || urlDomain.endsWith(`.${domain}`)
        );
        
        if (!isAllowed) {
          throw new Error(`Domain ${urlDomain} is not in the allowed domains list`);
        }
      }

      // Use environment variable for API key
      const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;
      if (!apiKey) {
        throw new Error('Firecrawl API key not configured. Please set VITE_FIRECRAWL_API_KEY environment variable.');
      }

      return await this.executeScraping([cleanedUrl], { ...config, apiKey }, contact);

    } catch (error) {
      console.error('❌ Dynamic Firecrawl scraping failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Format scraping results for better readability
   */
  formatScrapingResults(results: FirecrawlResponse): string {
    if (!results.success || !results.pages || results.pages.length === 0) {
      return `No content was scraped. ${results.error || 'Unknown error occurred.'}`;
    }

    let formatted = `Successfully scraped ${results.pages.length} page(s):\n\n`;

    results.pages.forEach((page, index) => {
      formatted += `**Page ${index + 1}: ${page.url}**\n`;
      
      if (page.title) {
        formatted += `Title: ${page.title}\n`;
      }
      
      if (page.content) {
        // Truncate content if too long
        const content = page.content.length > 1000 
          ? page.content.substring(0, 1000) + '...'
          : page.content;
        formatted += `Content: ${content}\n`;
      }
      
      if (page.images && page.images.length > 0) {
        formatted += `Images: ${page.images.length} found\n`;
      }
      
      formatted += '\n';
    });

    if (results.metadata) {
      formatted += `**Summary:** ${results.metadata.totalPages} pages, ${results.metadata.totalSize} bytes, ${results.metadata.crawlTime}ms\n`;
    }

    return formatted;
  }

  /**
   * Extract specific information from scraped content
   */
  extractInformation(pages: FirecrawlPage[], query: string): string {
    if (!pages || pages.length === 0) {
      return 'No pages to extract information from.';
    }

    let extracted = `Extracting information about "${query}" from ${pages.length} page(s):\n\n`;

    pages.forEach((page, index) => {
      extracted += `**From ${page.url}:**\n`;
      
      if (page.content) {
        // Simple keyword matching (in a real implementation, you'd use more sophisticated NLP)
        const content = page.content.toLowerCase();
        const queryLower = query.toLowerCase();
        
        if (content.includes(queryLower)) {
          // Find the sentence containing the query
          const sentences = page.content.split(/[.!?]+/);
          const relevantSentences = sentences.filter(sentence => 
            sentence.toLowerCase().includes(queryLower)
          );
          
          if (relevantSentences.length > 0) {
            extracted += relevantSentences.slice(0, 3).join('. ') + '.\n';
          } else {
            extracted += 'Query found in content but no relevant sentences extracted.\n';
          }
        } else {
          extracted += 'Query not found in this page.\n';
        }
      } else {
        extracted += 'No content available for this page.\n';
      }
      
      extracted += '\n';
    });

    return extracted;
  }
}

export const firecrawlService = new FirecrawlService(); 