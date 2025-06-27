# Supabase Notion OAuth Integration Setup

This guide will help you set up the complete Notion OAuth integration using Supabase Edge Functions.

## 🚀 Quick Setup

### Prerequisites
- Supabase project created
- Notion OAuth app configured
- Supabase CLI installed (`npm install -g supabase`)

### 1. Run the Deployment Script
```bash
./deploy-supabase.sh
```

This script will:
- Link your Supabase project
- Set up environment variables
- Deploy the Edge Function
- Apply database migrations

### 2. Manual Setup (Alternative)

If you prefer manual setup:

#### Install Supabase CLI
```bash
npm install -g supabase
```

#### Login to Supabase
```bash
supabase login
```

#### Link Your Project
```bash
supabase link --project-ref YOUR_PROJECT_ID
```

#### Set Environment Variables
```bash
supabase secrets set NOTION_CLIENT_ID="21ed872b-594c-80a6-8056-00371e393d86"
supabase secrets set NOTION_CLIENT_SECRET="your_notion_client_secret"
```

#### Apply Database Migration
```bash
supabase db push
```

#### Deploy Edge Function
```bash
supabase functions deploy notion-oauth
```

## 🔧 Configuration Required in Supabase Dashboard

### 1. Add the OAuth Tokens Table
The migration should have created this automatically, but verify in your Supabase dashboard:

**Table: `oauth_tokens`**
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users)
- `provider` (TEXT)
- `access_token` (TEXT)
- `refresh_token` (TEXT, nullable)
- `workspace_id` (TEXT, nullable)
- `workspace_name` (TEXT, nullable)
- `bot_id` (TEXT, nullable)
- `expires_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 2. Verify Row Level Security (RLS)
Ensure RLS is enabled with these policies:
- Users can view their own tokens
- Users can insert their own tokens
- Users can update their own tokens
- Users can delete their own tokens

## 🎯 Notion OAuth App Configuration

In your Notion OAuth app settings (https://www.notion.so/my-integrations):

### Redirect URIs
Add these redirect URIs:
```
http://localhost:5173/oauth/callback/notion
http://localhost:5174/oauth/callback/notion
http://localhost:5175/oauth/callback/notion
https://your-production-domain.com/oauth/callback/notion
```

### OAuth & Permissions
- **OAuth Domain**: Your domain
- **Redirect URIs**: Listed above
- **Capabilities**: 
  - Read content
  - Update content
  - Insert content

## 🧪 Testing the Integration

### 1. Check Edge Function Deployment
```bash
supabase functions logs notion-oauth
```

### 2. Test OAuth Flow
1. Start your React app: `npm run dev`
2. Navigate to Notion integration
3. Click "Connect to Notion"
4. Complete OAuth flow
5. Check browser console for success messages

### 3. Test API Calls
After connecting, try:
- Searching pages
- Getting page content
- Creating pages

## 🔍 Debugging

### View Edge Function Logs
```bash
supabase functions logs notion-oauth --follow
```

### Common Issues

#### 1. "Function not found" Error
- Ensure function is deployed: `supabase functions deploy notion-oauth`
- Check function URL in browser console

#### 2. "Token exchange failed" Error
- Verify `NOTION_CLIENT_SECRET` is set correctly
- Check Notion OAuth app redirect URIs
- Ensure authorization code is valid

#### 3. "Database error" Error
- Verify `oauth_tokens` table exists
- Check RLS policies are set up
- Ensure user is authenticated

#### 4. CORS Errors
- Edge Functions should handle CORS automatically
- Check `corsHeaders` in the function

## 📁 File Structure

```
supabase/
├── functions/
│   ├── _shared/
│   │   └── cors.ts              # CORS headers
│   └── notion-oauth/
│       └── index.ts             # Main Edge Function
└── migrations/
    └── 20250627000000_oauth_tokens_table.sql
```

## 🔐 Security Features

- **Secure Token Storage**: Tokens stored in Supabase database with RLS
- **Environment Variables**: Client secrets stored as Supabase secrets
- **Row Level Security**: Users can only access their own tokens
- **Token Caching**: Tokens cached in localStorage for performance
- **Automatic Cleanup**: Tokens can be revoked and cleaned up

## 🚀 Production Deployment

### Environment Variables
Ensure these are set in your production environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Supabase Secrets
These are set via Supabase CLI:
- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`

### Domain Configuration
Update Notion OAuth app with production domain redirect URIs.

## 📞 Support

If you encounter issues:

1. Check Edge Function logs: `supabase functions logs notion-oauth`
2. Verify environment variables are set
3. Test OAuth flow step by step
4. Check browser console for detailed error messages

## 🎉 Success!

Once set up, your app will:
- ✅ Handle Notion OAuth securely
- ✅ Store tokens in Supabase database
- ✅ Make real API calls to Notion
- ✅ Cache tokens for performance
- ✅ Handle token refresh automatically 