import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify API key is configured
    if (!TAVILY_API_KEY) {
      console.error('TAVILY_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const { query, search_depth = 'basic', include_images = false, include_answer = true, max_results = 5 } = body

    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Valid query parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Sanitize and validate parameters
    const sanitizedQuery = query.trim().slice(0, 500) // Limit query length
    const validSearchDepth = ['basic', 'advanced'].includes(search_depth) ? search_depth : 'basic'
    const validMaxResults = Math.min(Math.max(1, parseInt(max_results) || 5), 20) // Limit between 1-20

    // Make request to Tavily API
    const tavilyPayload = {
      api_key: TAVILY_API_KEY,
      query: sanitizedQuery,
      search_depth: validSearchDepth,
      include_images: Boolean(include_images),
      include_answer: Boolean(include_answer),
      max_results: validMaxResults
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tavilyPayload)
    })

    const data = await response.json()

    // Return response with proper headers
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Tavily proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})