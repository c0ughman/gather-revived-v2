#!/bin/bash

# Supabase Edge Functions Deployment Script
# This script sets up the Notion OAuth integration with Supabase

echo "🚀 Setting up Supabase Edge Functions for Notion OAuth..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "🔐 Please log in to Supabase first:"
    echo "supabase login"
    exit 1
fi

# Get project reference
echo "📋 Please enter your Supabase project reference ID:"
read -p "Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Project ID is required"
    exit 1
fi

# Link the project
echo "🔗 Linking to Supabase project..."
supabase link --project-ref $PROJECT_ID

# Set environment variables
echo "🔧 Setting up environment variables..."

echo "📋 Please enter your Notion OAuth credentials:"
read -p "Notion Client ID: " NOTION_CLIENT_ID
read -s -p "Notion Client Secret: " NOTION_CLIENT_SECRET
echo

if [ -z "$NOTION_CLIENT_ID" ] || [ -z "$NOTION_CLIENT_SECRET" ]; then
    echo "❌ Both Notion Client ID and Secret are required"
    exit 1
fi

# Set secrets in Supabase
echo "🔐 Setting Supabase secrets..."
supabase secrets set NOTION_CLIENT_ID="$NOTION_CLIENT_ID"
supabase secrets set NOTION_CLIENT_SECRET="$NOTION_CLIENT_SECRET"

# Apply database migrations
echo "🗄️ Applying database migrations..."
supabase db push

# Deploy Edge Functions
echo "🚀 Deploying Edge Functions..."
supabase functions deploy notion-oauth

echo "✅ Deployment complete!"
echo ""
echo "🎉 Your Notion OAuth integration is now set up!"
echo ""
echo "📝 Next steps:"
echo "1. Make sure your Notion OAuth app redirect URI includes:"
echo "   https://your-domain.com/oauth/callback/notion"
echo "2. Test the integration in your app"
echo ""
echo "🔍 To view function logs:"
echo "supabase functions logs notion-oauth"
echo ""
echo "🛠️ To update the function:"
echo "supabase functions deploy notion-oauth" 