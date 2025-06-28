#!/bin/bash

# Database Setup Script for Supabase
# This script ensures all migrations are applied and the database is properly configured

echo "🗄️ Setting up Supabase database..."

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

# Get project reference if not already linked
if [ ! -f .supabase/config.toml ]; then
    echo "📋 Please enter your Supabase project reference ID:"
    read -p "Project ID: " PROJECT_ID

    if [ -z "$PROJECT_ID" ]; then
        echo "❌ Project ID is required"
        exit 1
    fi

    # Link the project
    echo "🔗 Linking to Supabase project..."
    supabase link --project-ref $PROJECT_ID
fi

# Apply all database migrations
echo "🗄️ Applying database migrations..."
supabase db push

# Check if migrations were applied successfully
if [ $? -eq 0 ]; then
    echo "✅ Database migrations applied successfully!"
    echo ""
    echo "🎉 Your database is now properly configured!"
    echo ""
    echo "📝 The following tables should now be available:"
    echo "- users (managed by Supabase Auth)"
    echo "- user_profiles"
    echo "- user_agents"
    echo "- agent_templates"
    echo "- integration_templates"
    echo "- agent_integrations"
    echo "- conversations"
    echo "- messages"
    echo "- agent_documents"
    echo "- oauth_tokens"
    echo "- user_subscriptions"
    echo "- user_usage"
    echo ""
    echo "🔍 You can now test user signup in your application!"
else
    echo "❌ Failed to apply database migrations"
    echo "Please check the error messages above and try again"
    exit 1
fi