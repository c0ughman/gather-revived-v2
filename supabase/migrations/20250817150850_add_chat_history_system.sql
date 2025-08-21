/*
  # Chat History System

  This migration creates a comprehensive chat history system for storing and browsing
  all past conversations. This is separate from the memory system and is purely for
  user reference and conversation archival.

  Features:
  - All messages automatically saved to database
  - Conversation sessions with metadata
  - Browse conversations by agent, date, or search
  - Export/import functionality
  - Message attachments and context tracking
*/

-- =============================================
-- CONVERSATION SESSIONS
-- =============================================

-- Conversation sessions to group related messages
CREATE TABLE conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session metadata
    title TEXT, -- Auto-generated or user-defined title
    conversation_type TEXT DEFAULT 'chat' CHECK (conversation_type IN ('chat', 'voice', 'mixed')),
    
    -- Conversation summary and stats
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0, -- For voice calls
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT now(),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    
    -- Organization
    is_starred BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    tags TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CONVERSATION MESSAGES
-- =============================================

-- All messages (chat and voice) stored here
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    
    -- Message content and metadata
    content TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'system', 'function_call', 'function_result')),
    
    -- Message context
    token_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    
    -- Function calling context
    function_name TEXT, -- If this was a function call
    function_args JSONB, -- Function arguments
    function_result JSONB, -- Function result
    
    -- Voice-specific data
    audio_duration_seconds INTEGER, -- For voice messages
    transcription_confidence FLOAT, -- Transcription quality
    
    -- Attachments and context
    attachments JSONB DEFAULT '[]'::jsonb, -- File attachments, images, etc.
    context_used JSONB DEFAULT '{}'::jsonb, -- What context was included (docs, memory, etc.)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CONVERSATION ANALYTICS
-- =============================================

-- Track conversation patterns and analytics
CREATE TABLE conversation_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    
    -- Analytics data
    topics_discussed TEXT[], -- Main topics covered
    user_sentiment TEXT CHECK (user_sentiment IN ('positive', 'neutral', 'negative')),
    conversation_quality_score FLOAT DEFAULT 0.5, -- 0.0 to 1.0
    
    -- Engagement metrics
    user_message_count INTEGER DEFAULT 0,
    assistant_message_count INTEGER DEFAULT 0,
    average_response_time_seconds FLOAT DEFAULT 0,
    
    -- Content analysis
    questions_asked INTEGER DEFAULT 0,
    functions_called INTEGER DEFAULT 0,
    documents_referenced INTEGER DEFAULT 0,
    memories_accessed INTEGER DEFAULT 0,
    
    -- Timestamps
    analyzed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Conversation sessions indexes
CREATE INDEX idx_conversation_sessions_agent_id ON conversation_sessions(agent_id);
CREATE INDEX idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX idx_conversation_sessions_started_at ON conversation_sessions(started_at DESC);
CREATE INDEX idx_conversation_sessions_last_message ON conversation_sessions(last_message_at DESC);
CREATE INDEX idx_conversation_sessions_type ON conversation_sessions(conversation_type);
CREATE INDEX idx_conversation_sessions_starred ON conversation_sessions(user_id) WHERE is_starred = true;
CREATE INDEX idx_conversation_sessions_archived ON conversation_sessions(user_id) WHERE is_archived = false;
CREATE INDEX idx_conversation_sessions_tags ON conversation_sessions USING GIN(tags);

-- Conversation messages indexes
CREATE INDEX idx_conversation_messages_session_id ON conversation_messages(session_id);
CREATE INDEX idx_conversation_messages_created_at ON conversation_messages(session_id, created_at ASC);
CREATE INDEX idx_conversation_messages_role ON conversation_messages(session_id, role);
CREATE INDEX idx_conversation_messages_type ON conversation_messages(message_type);
CREATE INDEX idx_conversation_messages_function ON conversation_messages(function_name) WHERE function_name IS NOT NULL;

-- Search indexes for content
CREATE INDEX idx_conversation_messages_content_search ON conversation_messages USING gin(to_tsvector('english', content));
CREATE INDEX idx_conversation_sessions_title_search ON conversation_sessions USING gin(to_tsvector('english', title));

-- Analytics indexes
CREATE INDEX idx_conversation_analytics_session_id ON conversation_analytics(session_id);
CREATE INDEX idx_conversation_analytics_topics ON conversation_analytics USING GIN(topics_discussed);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation sessions
CREATE POLICY "Users can manage own conversation sessions" ON conversation_sessions
    FOR ALL USING (user_id = auth.uid());

-- RLS policies for conversation messages
CREATE POLICY "Users can manage own conversation messages" ON conversation_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM conversation_sessions 
            WHERE conversation_sessions.id = conversation_messages.session_id 
            AND conversation_sessions.user_id = auth.uid()
        )
    );

-- RLS policies for conversation analytics
CREATE POLICY "Users can view own conversation analytics" ON conversation_analytics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM conversation_sessions 
            WHERE conversation_sessions.id = conversation_analytics.session_id 
            AND conversation_sessions.user_id = auth.uid()
        )
    );

-- =============================================
-- TRIGGER FUNCTIONS
-- =============================================

-- Function to update conversation session stats
CREATE OR REPLACE FUNCTION update_conversation_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update message count and last message time
    UPDATE conversation_sessions 
    SET 
        message_count = (
            SELECT COUNT(*) FROM conversation_messages 
            WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        ),
        total_tokens = (
            SELECT COALESCE(SUM(token_count), 0) FROM conversation_messages 
            WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        ),
        last_message_at = (
            SELECT MAX(created_at) FROM conversation_messages 
            WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        ),
        updated_at = now()
    WHERE id = COALESCE(NEW.session_id, OLD.session_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate token count for messages
CREATE OR REPLACE FUNCTION calculate_message_token_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Estimate token count (4 characters H 1 token)
    NEW.token_count = CEIL(LENGTH(NEW.content) / 4.0);
    
    -- Calculate word count
    NEW.word_count = array_length(string_to_array(trim(NEW.content), ' '), 1);
    
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate conversation titles
CREATE OR REPLACE FUNCTION generate_conversation_title()
RETURNS TRIGGER AS $$
DECLARE
    first_user_message TEXT;
    generated_title TEXT;
BEGIN
    -- Only generate title if not already set and we have at least 2 messages
    IF NEW.message_count >= 2 AND (OLD.title IS NULL OR OLD.title = '') THEN
        -- Get the first user message
        SELECT content INTO first_user_message
        FROM conversation_messages 
        WHERE session_id = NEW.id AND role = 'user'
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF first_user_message IS NOT NULL THEN
            -- Generate title from first 50 characters of first user message
            generated_title = trim(substring(first_user_message from 1 for 47));
            IF length(first_user_message) > 47 THEN
                generated_title = generated_title || '...';
            END IF;
            
            -- Update the title
            NEW.title = generated_title;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Message token counting trigger
CREATE TRIGGER calculate_message_tokens BEFORE INSERT OR UPDATE ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION calculate_message_token_count();

-- Session stats update triggers
CREATE TRIGGER update_session_stats_on_message_insert AFTER INSERT ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_session_stats();

CREATE TRIGGER update_session_stats_on_message_update AFTER UPDATE ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_session_stats();

CREATE TRIGGER update_session_stats_on_message_delete AFTER DELETE ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_session_stats();

-- Auto-generate conversation title trigger
CREATE TRIGGER generate_title_trigger BEFORE UPDATE ON conversation_sessions
    FOR EACH ROW EXECUTE FUNCTION generate_conversation_title();

-- Updated timestamp triggers
CREATE TRIGGER update_conversation_sessions_updated_at BEFORE UPDATE ON conversation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_messages_updated_at BEFORE UPDATE ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_analytics_updated_at BEFORE UPDATE ON conversation_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();