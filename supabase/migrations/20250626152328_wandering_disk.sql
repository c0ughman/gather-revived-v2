/*
  # OAuth Tokens Table
  
  This migration creates a table to store OAuth tokens for integrations
  that require OAuth authentication (like Notion, Slack, Google, etc.)
*/

-- Create OAuth tokens table
CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'notion', 'slack', 'google', etc.
    
    -- Token data
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scope TEXT,
    token_type TEXT DEFAULT 'Bearer',
    
    -- Provider-specific data
    bot_id TEXT, -- For Notion
    workspace_id TEXT, -- For Notion, Slack, etc.
    workspace_name TEXT, -- For Notion, Slack, etc.
    user_info JSONB, -- Store user profile info from provider
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure one token per user per provider
    UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own OAuth tokens" ON oauth_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OAuth tokens" ON oauth_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own OAuth tokens" ON oauth_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own OAuth tokens" ON oauth_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);
CREATE INDEX idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at) WHERE expires_at IS NOT NULL;

-- Updated at trigger
CREATE TRIGGER update_oauth_tokens_updated_at 
    BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();