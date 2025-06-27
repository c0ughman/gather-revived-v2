import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const NOTION_CLIENT_ID = Deno.env.get('NOTION_CLIENT_ID')!
const NOTION_CLIENT_SECRET = Deno.env.get('NOTION_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface NotionTokenResponse {
  access_token: string
  token_type: string
  bot_id: string
  workspace_name: string
  workspace_id: string
  workspace_icon: string
  owner: {
    type: string
    user?: {
      object: string
      id: string
      name: string
      avatar_url: string
      type: string
      person: {
        email: string
      }
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { action, code, access_token, url, method = 'GET', body, user_id } = await req.json()

    console.log(`🔧 Notion Edge Function - Action: ${action}`)

    if (action === 'exchange_token') {
      console.log('🔄 Exchanging authorization code for access token...')
      
      if (!code) {
        throw new Error('Authorization code is required')
      }

      // Exchange authorization code for access token
      const credentials = btoa(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`)
      
      const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${req.headers.get('origin')}/oauth/callback/notion`
        })
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('❌ Token exchange failed:', errorText)
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`)
      }

      const tokenData: NotionTokenResponse = await tokenResponse.json()
      
      console.log('✅ Token exchange successful')
      console.log(`🏢 Workspace: ${tokenData.workspace_name}`)

      // Store the token securely in Supabase (optional - for production use)
      if (user_id) {
        try {
          const { error } = await supabase
            .from('oauth_tokens')
            .upsert({
              user_id: user_id,
              provider: 'notion',
              access_token: tokenData.access_token,
              workspace_id: tokenData.workspace_id,
              workspace_name: tokenData.workspace_name,
              bot_id: tokenData.bot_id,
              updated_at: new Date().toISOString()
            })

          if (error) {
            console.error('⚠️ Failed to store token in database:', error)
            // Don't fail the request if token storage fails
          } else {
            console.log('💾 Token stored securely in database')
          }
        } catch (dbError) {
          console.error('⚠️ Database error:', dbError)
          // Continue without failing
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          access_token: tokenData.access_token,
          workspace_name: tokenData.workspace_name,
          workspace_id: tokenData.workspace_id,
          bot_id: tokenData.bot_id,
          owner: tokenData.owner
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'api_request') {
      console.log(`🌐 Making Notion API request: ${method} ${url}`)
      
      if (!access_token) {
        throw new Error('Access token is required for API requests')
      }

      if (!url) {
        throw new Error('URL is required for API requests')
      }

      // Make authenticated Notion API request
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        }
      }

      if (body && method !== 'GET') {
        requestOptions.body = JSON.stringify(body)
      }

      const apiResponse = await fetch(url, requestOptions)
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text()
        console.error('❌ Notion API error:', errorText)
        throw new Error(`Notion API error: ${apiResponse.status} ${errorText}`)
      }

      const data = await apiResponse.json()
      
      console.log(`✅ Notion API request successful`)
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'get_stored_token') {
      console.log(`🔍 Retrieving stored token for user: ${user_id}`)
      
      if (!user_id) {
        throw new Error('User ID is required to retrieve stored token')
      }

      const { data, error } = await supabase
        .from('oauth_tokens')
        .select('access_token, workspace_name, workspace_id, bot_id, updated_at')
        .eq('user_id', user_id)
        .eq('provider', 'notion')
        .single()

      if (error) {
        console.error('❌ Failed to retrieve token:', error)
        throw new Error('No stored Notion token found. Please reconnect your account.')
      }

      if (!data) {
        throw new Error('No stored Notion token found. Please reconnect your account.')
      }

      console.log('✅ Retrieved stored token')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          access_token: data.access_token,
          workspace_name: data.workspace_name,
          workspace_id: data.workspace_id,
          bot_id: data.bot_id,
          updated_at: data.updated_at
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'revoke_token') {
      console.log(`🗑️ Revoking token for user: ${user_id}`)
      
      if (!user_id) {
        throw new Error('User ID is required to revoke token')
      }

      const { error } = await supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', user_id)
        .eq('provider', 'notion')

      if (error) {
        console.error('❌ Failed to revoke token:', error)
        throw new Error('Failed to revoke token')
      }

      console.log('✅ Token revoked successfully')
      
      return new Response(
        JSON.stringify({ success: true, message: 'Token revoked successfully' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    throw new Error(`Unknown action: ${action}`)

  } catch (error) {
    console.error('❌ Edge Function Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 