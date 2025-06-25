/*
  # Complete AI Agent Platform Database Schema

  This migration creates a comprehensive database schema for an AI agent platform with:
  
  1. **Global Catalogs**
     - `agent_templates` - Available AI agent templates
     - `integration_templates` - Available integration types
  
  2. **User Data**
     - `user_profiles` - Extended user information
     - `user_agents` - User's AI agent instances
     - `agent_integrations` - Integration instances for agents
     - `agent_documents` - Documents associated with agents
     - `conversations` - Chat conversations
     - `messages` - Individual messages
     - `message_attachments` - Document attachments to messages
  
  3. **Security**
     - Row Level Security (RLS) enabled on all user tables
     - Policies for authenticated users to access only their data
  
  4. **Performance**
     - Proper indexes for common queries
     - Foreign key constraints for data integrity
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- GLOBAL CATALOG TABLES (Public Data)
-- =============================================

-- Available AI Agent Templates
CREATE TABLE agent_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    default_color TEXT NOT NULL DEFAULT '#3b82f6',
    default_voice TEXT DEFAULT 'Puck',
    default_avatar_url TEXT,
    personality_traits JSONB DEFAULT '[]'::jsonb,
    capabilities JSONB DEFAULT '[]'::jsonb,
    suggested_integrations JSONB DEFAULT '[]'::jsonb, -- Array of integration template IDs
    tags JSONB DEFAULT '[]'::jsonb,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Available Integration Templates
CREATE TABLE integration_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('source', 'action')),
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    requires_api_key BOOLEAN DEFAULT false,
    requires_oauth BOOLEAN DEFAULT false,
    
    -- Configuration schema for this integration type
    config_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Field definitions for setup form
    setup_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Usage examples and documentation
    examples JSONB DEFAULT '[]'::jsonb,
    documentation_url TEXT,
    
    -- Categorization and discovery
    tags JSONB DEFAULT '[]'::jsonb,
    difficulty_level TEXT DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    
    -- Availability and status
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_beta BOOLEAN DEFAULT false,
    
    -- Metadata
    provider TEXT, -- e.g., 'Google', 'OpenAI', 'Custom'
    version TEXT DEFAULT '1.0.0',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- USER DATA TABLES
-- =============================================

-- Extended user profiles (supplements auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}'::jsonb,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    usage_stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- User's AI Agent Instances
CREATE TABLE user_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id TEXT REFERENCES agent_templates(id) ON DELETE SET NULL,
    
    -- Core agent properties
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    initials TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    voice TEXT DEFAULT 'Puck',
    avatar_url TEXT,
    
    -- Status and behavior
    status TEXT DEFAULT 'online' CHECK (status IN ('online', 'busy', 'offline')),
    last_seen TEXT DEFAULT 'now',
    
    -- Customization
    personality_prompt TEXT,
    system_instructions TEXT,
    custom_settings JSONB DEFAULT '{}'::jsonb,
    
    -- Organization
    folder TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    is_favorite BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    
    -- Usage tracking
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Integration instances for specific agents
CREATE TABLE agent_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL REFERENCES integration_templates(id) ON DELETE RESTRICT,
    
    -- Instance configuration
    name TEXT NOT NULL, -- User-defined name for this integration instance
    description TEXT,
    
    -- Configuration and settings
    config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Instance-specific configuration
    credentials JSONB DEFAULT '{}'::jsonb, -- Encrypted API keys, tokens, etc.
    
    -- Execution settings
    trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'periodic', 'chat-start', 'both')),
    interval_minutes INTEGER,
    
    -- Status and monitoring
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
    last_executed_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    error_message TEXT,
    execution_count INTEGER DEFAULT 0,
    
    -- Data storage
    last_data JSONB,
    data_summary TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents associated with agents
CREATE TABLE agent_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    
    -- File information
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- MIME type
    file_size INTEGER NOT NULL,
    file_url TEXT, -- If stored in Supabase Storage
    
    -- Content and processing
    content TEXT, -- Extracted text content
    summary TEXT,
    extracted_text TEXT, -- For binary files
    
    -- Processing metadata
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    extraction_quality TEXT CHECK (extraction_quality IN ('excellent', 'good', 'partial', 'poor')),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Organization
    folder TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Usage tracking
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation sessions
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    
    -- Conversation metadata
    title TEXT,
    summary TEXT,
    
    -- Status and type
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    conversation_type TEXT DEFAULT 'chat' CHECK (conversation_type IN ('chat', 'voice', 'mixed')),
    
    -- Metrics
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT now(),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual messages within conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Message content
    content TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
    
    -- Message metadata
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'image', 'file', 'system')),
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    
    -- AI-specific fields
    model_used TEXT,
    function_calls JSONB,
    
    -- Organization
    thread_id UUID, -- For threaded conversations
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Document attachments to messages
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES agent_documents(id) ON DELETE CASCADE,
    
    -- Attachment metadata
    attachment_type TEXT DEFAULT 'reference' CHECK (attachment_type IN ('reference', 'upload', 'generated')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(message_id, document_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Agent templates
CREATE INDEX idx_agent_templates_category ON agent_templates(category);
CREATE INDEX idx_agent_templates_featured ON agent_templates(is_featured) WHERE is_featured = true;
CREATE INDEX idx_agent_templates_active ON agent_templates(is_active) WHERE is_active = true;

-- Integration templates
CREATE INDEX idx_integration_templates_category ON integration_templates(category);
CREATE INDEX idx_integration_templates_featured ON integration_templates(is_featured) WHERE is_featured = true;
CREATE INDEX idx_integration_templates_active ON integration_templates(is_active) WHERE is_active = true;

-- User agents
CREATE INDEX idx_user_agents_user_id ON user_agents(user_id);
CREATE INDEX idx_user_agents_template_id ON user_agents(template_id);
CREATE INDEX idx_user_agents_status ON user_agents(status);
CREATE INDEX idx_user_agents_favorite ON user_agents(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_user_agents_last_used ON user_agents(user_id, last_used_at DESC);

-- Agent integrations
CREATE INDEX idx_agent_integrations_agent_id ON agent_integrations(agent_id);
CREATE INDEX idx_agent_integrations_template_id ON agent_integrations(template_id);
CREATE INDEX idx_agent_integrations_status ON agent_integrations(status);
CREATE INDEX idx_agent_integrations_trigger ON agent_integrations(trigger_type);

-- Documents
CREATE INDEX idx_agent_documents_agent_id ON agent_documents(agent_id);
CREATE INDEX idx_agent_documents_type ON agent_documents(file_type);
CREATE INDEX idx_agent_documents_status ON agent_documents(processing_status);

-- Conversations
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(user_id, last_message_at DESC);

-- Messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(conversation_id, timestamp);
CREATE INDEX idx_messages_sender ON messages(sender);

-- Message attachments
CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX idx_message_attachments_document_id ON message_attachments(document_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all user tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- User agents policies
CREATE POLICY "Users can view own agents" ON user_agents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agents" ON user_agents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents" ON user_agents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents" ON user_agents
    FOR DELETE USING (auth.uid() = user_id);

-- Agent integrations policies
CREATE POLICY "Users can view own agent integrations" ON agent_integrations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_integrations.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own agent integrations" ON agent_integrations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_integrations.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- Agent documents policies
CREATE POLICY "Users can view own agent documents" ON agent_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_documents.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own agent documents" ON agent_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_documents.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- Conversations policies
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own conversations" ON conversations
    FOR ALL USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own messages" ON messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

-- Message attachments policies
CREATE POLICY "Users can view own message attachments" ON message_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM messages 
            JOIN conversations ON conversations.id = messages.conversation_id
            WHERE messages.id = message_attachments.message_id 
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own message attachments" ON message_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM messages 
            JOIN conversations ON conversations.id = messages.conversation_id
            WHERE messages.id = message_attachments.message_id 
            AND conversations.user_id = auth.uid()
        )
    );

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_agents_updated_at BEFORE UPDATE ON user_agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_integrations_updated_at BEFORE UPDATE ON agent_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_documents_updated_at BEFORE UPDATE ON agent_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation metrics
CREATE OR REPLACE FUNCTION update_conversation_metrics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversations 
        SET 
            message_count = message_count + 1,
            last_message_at = NEW.timestamp
        WHERE id = NEW.conversation_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE conversations 
        SET message_count = message_count - 1
        WHERE id = OLD.conversation_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger to update conversation metrics when messages change
CREATE TRIGGER update_conversation_metrics_trigger
    AFTER INSERT OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_metrics();

-- Function to update agent usage stats
CREATE OR REPLACE FUNCTION update_agent_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_agents 
    SET 
        total_messages = total_messages + 1,
        last_used_at = now()
    WHERE id = (
        SELECT agent_id FROM conversations 
        WHERE id = NEW.conversation_id
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update agent usage when messages are added
CREATE TRIGGER update_agent_usage_trigger
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_agent_usage_stats();