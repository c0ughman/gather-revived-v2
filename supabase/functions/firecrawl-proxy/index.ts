import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface FirecrawlRequest {
  apiKey: string;
  urls: string[];
  extractType: 'text' | 'markdown' | 'html' | 'screenshot';
  includeImages?: boolean;
  maxPages?: number;
  crawlDepth?: number;
  allowedDomains?: string[];
}

interface FirecrawlResponse {
  success: boolean;
  data?: any;
  error?: string;
  pages?: any[];
  metadata?: {
    totalPages: number;
    totalSize: number;
    crawlTime: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const requestData: FirecrawlRequest = await req.json()
    
    console.log('🕷️ Firecrawl proxy request received')
    console.log('📋 Request data:', {
      ...requestData,
      apiKey: '[REDACTED]'
    })

    // Validate required fields
    if (!requestData.apiKey) {
      throw new Error('API key is required')
    }

    if (!requestData.urls || requestData.urls.length === 0) {
      throw new Error('At least one URL is required')
    }

    // Validate and clean URLs
    const cleanedUrls = requestData.urls.map(url => {
      try {
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        
        // Validate URL format
        new URL(url);
        return url;
      } catch (error) {
        throw new Error(`Invalid URL format: ${url}`);
      }
    });

    console.log('🔗 Cleaned URLs:', cleanedUrls);

    // Prepare Firecrawl API request according to documentation
    const firecrawlRequest = {
      url: cleanedUrls[0], // Use first URL as per docs
      formats: [requestData.extractType === 'text' ? 'markdown' : requestData.extractType || 'markdown'], // Convert 'text' to 'markdown'
      // Optional fields
      onlyMainContent: false,
      timeout: 30000
    }

    console.log('🌐 Making request to Firecrawl API...')

    // Make request to Firecrawl API
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${requestData.apiKey}`
      },
      body: JSON.stringify(firecrawlRequest)
    })

    console.log('📡 Firecrawl API response status:', firecrawlResponse.status)

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text()
      console.error('❌ Firecrawl API error:', errorText)
      throw new Error(`Firecrawl API error: ${firecrawlResponse.status} ${errorText}`)
    }

    const firecrawlData = await firecrawlResponse.json()
    console.log('✅ Firecrawl API request successful')

    // Format the response according to new API format
    const response: FirecrawlResponse = {
      success: true,
      data: firecrawlData.data,
      pages: firecrawlData.data ? [{
        url: cleanedUrls[0],
        content: firecrawlData.data.markdown || firecrawlData.data.html || '',
        title: firecrawlData.data.metadata?.title || '',
        metadata: firecrawlData.data.metadata || {}
      }] : [],
      metadata: {
        totalPages: 1,
        totalSize: JSON.stringify(firecrawlData).length,
        crawlTime: Date.now() - Date.now() // Placeholder for actual timing
      }
    }

    console.log('📊 Response summary:', {
      totalPages: response.metadata?.totalPages || 0,
      totalSize: response.metadata?.totalSize || 0
    })

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ Firecrawl proxy error:', error)
    
    const errorResponse: FirecrawlResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
}) 