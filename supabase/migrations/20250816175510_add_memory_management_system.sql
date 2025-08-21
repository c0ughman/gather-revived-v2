/*
  # Memory Management System

  This migration creates the comprehensive memory management system for AI agents including:
  
  1. **Medium-Term Memory**
     - Stores frequently accessed or recent memories with topic tracking
     - Max 10,000 tokens per agent, oldest memories removed when limit reached
     - Topic frequency tracking for memory prioritization
  
  2. **Long-Term Memory**
     - Key-value storage for infrequently accessed memories
     - Auto-generated keys based on content analysis
     - Searchable and retrievable via function calls
  
  3. **Paper Notes**
     - User-generated notes from voice calls and chat sessions
     - Max 10,000 tokens per agent, with user alerts when approaching limit
     - Permanent storage with context-based inclusion

  4. **Enhanced Document System**
     - Document summaries (700 tokens max)
     - Word banks (300 tokens max) 
     - Facts lists (2,000 tokens max)
     - Full document content (50,000 tokens max)
*/

-- =============================================
-- MEDIUM-TERM MEMORY SYSTEM
-- =============================================

-- Medium-term memory entries for agents
CREATE TABLE agent_medium_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    
    -- Memory content and metadata
    content TEXT NOT NULL,
    summary TEXT, -- Brief summary of the memory
    topic TEXT NOT NULL, -- Main topic/category
    keywords TEXT[], -- Searchable keywords
    
    -- Context and relationships
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    related_document_id UUID REFERENCES agent_documents(id) ON DELETE SET NULL,
    
    -- Usage tracking for prioritization
    access_count INTEGER DEFAULT 1,
    last_accessed_at TIMESTAMPTZ DEFAULT now(),
    topic_frequency INTEGER DEFAULT 1, -- How often this topic has been discussed
    
    -- Memory importance scoring
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    
    -- Token management
    token_count INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Topic frequency tracking table
CREATE TABLE agent_memory_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    frequency_count INTEGER DEFAULT 1,
    last_mentioned_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(agent_id, topic)
);

-- =============================================
-- LONG-TERM MEMORY SYSTEM  
-- =============================================

-- Long-term key-value memory storage
CREATE TABLE agent_long_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    
    -- Key-value storage
    memory_key TEXT NOT NULL, -- Auto-generated searchable key
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'json', 'structured')),
    
    -- Auto-generated metadata
    keywords TEXT[], -- For search functionality
    context_summary TEXT, -- Brief context summary
    
    -- Usage tracking
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    
    -- Token management
    token_count INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(agent_id, memory_key)
);

-- =============================================
-- PAPER NOTES SYSTEM
-- =============================================

-- Paper notes from voice calls and chat sessions
CREATE TABLE agent_paper_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    
    -- Note content and metadata
    title TEXT,
    content TEXT NOT NULL,
    note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'voice_call', 'chat', 'generated')),
    
    -- Source context
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- Organization
    tags TEXT[],
    is_pinned BOOLEAN DEFAULT false,
    
    -- Token management
    token_count INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ENHANCED DOCUMENT SYSTEM
-- =============================================

-- Add new columns to existing agent_documents table for enhanced memory features
ALTER TABLE agent_documents 
ADD COLUMN IF NOT EXISTS summary_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS word_bank TEXT, -- Key words and phrases (300 tokens max)
ADD COLUMN IF NOT EXISTS word_bank_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS facts_list TEXT, -- Important facts (2000 tokens max)  
ADD COLUMN IF NOT EXISTS facts_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_context_enabled BOOLEAN DEFAULT true, -- Whether doc can be included in context
ADD COLUMN IF NOT EXISTS last_summarized_at TIMESTAMPTZ;

-- =============================================
-- MEMORY USAGE TRACKING
-- =============================================

-- Track memory usage and token limits per agent
CREATE TABLE agent_memory_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    
    -- Token usage by memory type
    medium_memory_tokens INTEGER DEFAULT 0,
    long_memory_tokens INTEGER DEFAULT 0,
    paper_notes_tokens INTEGER DEFAULT 0,
    
    -- Document token usage
    document_summary_tokens INTEGER DEFAULT 0,
    document_facts_tokens INTEGER DEFAULT 0,
    active_document_tokens INTEGER DEFAULT 0, -- Currently in context
    
    -- Total system usage
    total_memory_tokens INTEGER DEFAULT 0,
    
    -- Last update timestamp
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(agent_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Medium-term memory indexes
CREATE INDEX idx_agent_medium_memories_agent_id ON agent_medium_memories(agent_id);
CREATE INDEX idx_agent_medium_memories_topic ON agent_medium_memories(agent_id, topic);
CREATE INDEX idx_agent_medium_memories_access ON agent_medium_memories(agent_id, last_accessed_at DESC);
CREATE INDEX idx_agent_medium_memories_importance ON agent_medium_memories(agent_id, importance_score DESC);
CREATE INDEX idx_agent_medium_memories_keywords ON agent_medium_memories USING GIN(keywords);

-- Topic tracking indexes
CREATE INDEX idx_agent_memory_topics_agent_id ON agent_memory_topics(agent_id);
CREATE INDEX idx_agent_memory_topics_frequency ON agent_memory_topics(agent_id, frequency_count DESC);

-- Long-term memory indexes
CREATE INDEX idx_agent_long_memories_agent_id ON agent_long_memories(agent_id);
CREATE INDEX idx_agent_long_memories_key ON agent_long_memories(agent_id, memory_key);
CREATE INDEX idx_agent_long_memories_keywords ON agent_long_memories USING GIN(keywords);

-- Paper notes indexes
CREATE INDEX idx_agent_paper_notes_agent_id ON agent_paper_notes(agent_id);
CREATE INDEX idx_agent_paper_notes_type ON agent_paper_notes(agent_id, note_type);
CREATE INDEX idx_agent_paper_notes_conversation ON agent_paper_notes(conversation_id);
CREATE INDEX idx_agent_paper_notes_tags ON agent_paper_notes USING GIN(tags);

-- Memory usage tracking
CREATE INDEX idx_agent_memory_usage_agent_id ON agent_memory_usage(agent_id);

-- Enhanced document indexes
CREATE INDEX idx_agent_documents_context_enabled ON agent_documents(agent_id) WHERE is_context_enabled = true;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE agent_medium_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_long_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_paper_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for medium-term memories
CREATE POLICY "Users can manage own agent medium memories" ON agent_medium_memories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_medium_memories.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- RLS policies for memory topics
CREATE POLICY "Users can manage own agent memory topics" ON agent_memory_topics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_memory_topics.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- RLS policies for long-term memories
CREATE POLICY "Users can manage own agent long memories" ON agent_long_memories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_long_memories.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- RLS policies for paper notes
CREATE POLICY "Users can manage own agent paper notes" ON agent_paper_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_paper_notes.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- RLS policies for memory usage
CREATE POLICY "Users can view own agent memory usage" ON agent_memory_usage
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_agents 
            WHERE user_agents.id = agent_memory_usage.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- =============================================
-- TRIGGER FUNCTIONS
-- =============================================

-- Function to update memory token counts and usage tracking
CREATE OR REPLACE FUNCTION update_memory_token_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update token count based on content length
    IF TG_TABLE_NAME = 'agent_medium_memories' THEN
        NEW.token_count = CEIL(LENGTH(NEW.content) / 4.0);
    ELSIF TG_TABLE_NAME = 'agent_long_memories' THEN
        NEW.token_count = CEIL(LENGTH(NEW.content) / 4.0);
    ELSIF TG_TABLE_NAME = 'agent_paper_notes' THEN
        NEW.token_count = CEIL(LENGTH(NEW.content) / 4.0);
    END IF;
    
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to maintain medium-term memory token limits
CREATE OR REPLACE FUNCTION enforce_medium_memory_limits()
RETURNS TRIGGER AS $$
DECLARE
    current_total INTEGER;
    agent_limit INTEGER := 10000; -- 10k token limit
    memory_to_remove UUID;
BEGIN
    -- Calculate current total tokens for this agent
    SELECT COALESCE(SUM(token_count), 0) INTO current_total
    FROM agent_medium_memories 
    WHERE agent_id = NEW.agent_id;
    
    -- If over limit, remove oldest memories by access time and importance
    WHILE current_total > agent_limit LOOP
        SELECT id INTO memory_to_remove
        FROM agent_medium_memories 
        WHERE agent_id = NEW.agent_id
        ORDER BY importance_score ASC, last_accessed_at ASC
        LIMIT 1;
        
        IF memory_to_remove IS NOT NULL THEN
            DELETE FROM agent_medium_memories WHERE id = memory_to_remove;
            
            -- Recalculate total
            SELECT COALESCE(SUM(token_count), 0) INTO current_total
            FROM agent_medium_memories 
            WHERE agent_id = NEW.agent_id;
        ELSE
            EXIT; -- No more memories to remove
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update topic frequency
CREATE OR REPLACE FUNCTION update_topic_frequency()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update topic frequency
    INSERT INTO agent_memory_topics (agent_id, topic, frequency_count, last_mentioned_at)
    VALUES (NEW.agent_id, NEW.topic, 1, now())
    ON CONFLICT (agent_id, topic) 
    DO UPDATE SET 
        frequency_count = agent_memory_topics.frequency_count + 1,
        last_mentioned_at = now(),
        updated_at = now();
    
    -- Update topic frequency in the memory record
    UPDATE agent_medium_memories 
    SET topic_frequency = (
        SELECT frequency_count 
        FROM agent_memory_topics 
        WHERE agent_id = NEW.agent_id AND topic = NEW.topic
    )
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update overall memory usage statistics
CREATE OR REPLACE FUNCTION update_memory_usage_stats()
RETURNS TRIGGER AS $$
DECLARE
    agent_uuid UUID;
    medium_tokens INTEGER;
    long_tokens INTEGER;
    paper_tokens INTEGER;
    doc_summary_tokens INTEGER;
    doc_facts_tokens INTEGER;
    total_tokens INTEGER;
BEGIN
    -- Determine which agent was affected
    IF TG_TABLE_NAME = 'agent_medium_memories' THEN
        agent_uuid = COALESCE(NEW.agent_id, OLD.agent_id);
    ELSIF TG_TABLE_NAME = 'agent_long_memories' THEN
        agent_uuid = COALESCE(NEW.agent_id, OLD.agent_id);
    ELSIF TG_TABLE_NAME = 'agent_paper_notes' THEN
        agent_uuid = COALESCE(NEW.agent_id, OLD.agent_id);
    ELSIF TG_TABLE_NAME = 'agent_documents' THEN
        agent_uuid = COALESCE(NEW.agent_id, OLD.agent_id);
    END IF;
    
    -- Calculate totals for this agent
    SELECT COALESCE(SUM(token_count), 0) INTO medium_tokens
    FROM agent_medium_memories WHERE agent_id = agent_uuid;
    
    SELECT COALESCE(SUM(token_count), 0) INTO long_tokens
    FROM agent_long_memories WHERE agent_id = agent_uuid;
    
    SELECT COALESCE(SUM(token_count), 0) INTO paper_tokens
    FROM agent_paper_notes WHERE agent_id = agent_uuid;
    
    SELECT COALESCE(SUM(summary_tokens + facts_tokens), 0) INTO doc_summary_tokens
    FROM agent_documents WHERE agent_id = agent_uuid;
    
    total_tokens = medium_tokens + long_tokens + paper_tokens + doc_summary_tokens;
    
    -- Update or insert usage record
    INSERT INTO agent_memory_usage (
        agent_id, 
        medium_memory_tokens, 
        long_memory_tokens, 
        paper_notes_tokens,
        document_summary_tokens,
        total_memory_tokens,
        updated_at
    )
    VALUES (agent_uuid, medium_tokens, long_tokens, paper_tokens, doc_summary_tokens, total_tokens, now())
    ON CONFLICT (agent_id) 
    DO UPDATE SET 
        medium_memory_tokens = medium_tokens,
        long_memory_tokens = long_tokens,
        paper_notes_tokens = paper_tokens,
        document_summary_tokens = doc_summary_tokens,
        total_memory_tokens = total_tokens,
        updated_at = now();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Token counting triggers
CREATE TRIGGER update_medium_memory_tokens BEFORE INSERT OR UPDATE ON agent_medium_memories
    FOR EACH ROW EXECUTE FUNCTION update_memory_token_counts();

CREATE TRIGGER update_long_memory_tokens BEFORE INSERT OR UPDATE ON agent_long_memories
    FOR EACH ROW EXECUTE FUNCTION update_memory_token_counts();

CREATE TRIGGER update_paper_notes_tokens BEFORE INSERT OR UPDATE ON agent_paper_notes
    FOR EACH ROW EXECUTE FUNCTION update_memory_token_counts();

-- Medium-term memory management triggers
CREATE TRIGGER enforce_medium_memory_limits_trigger AFTER INSERT ON agent_medium_memories
    FOR EACH ROW EXECUTE FUNCTION enforce_medium_memory_limits();

CREATE TRIGGER update_topic_frequency_trigger AFTER INSERT ON agent_medium_memories
    FOR EACH ROW EXECUTE FUNCTION update_topic_frequency();

-- Memory usage tracking triggers
CREATE TRIGGER update_memory_usage_on_medium AFTER INSERT OR UPDATE OR DELETE ON agent_medium_memories
    FOR EACH ROW EXECUTE FUNCTION update_memory_usage_stats();

CREATE TRIGGER update_memory_usage_on_long AFTER INSERT OR UPDATE OR DELETE ON agent_long_memories
    FOR EACH ROW EXECUTE FUNCTION update_memory_usage_stats();

CREATE TRIGGER update_memory_usage_on_paper AFTER INSERT OR UPDATE OR DELETE ON agent_paper_notes
    FOR EACH ROW EXECUTE FUNCTION update_memory_usage_stats();

CREATE TRIGGER update_memory_usage_on_docs AFTER INSERT OR UPDATE OR DELETE ON agent_documents
    FOR EACH ROW EXECUTE FUNCTION update_memory_usage_stats();

-- Updated timestamp triggers
CREATE TRIGGER update_medium_memories_updated_at BEFORE UPDATE ON agent_medium_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memory_topics_updated_at BEFORE UPDATE ON agent_memory_topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_long_memories_updated_at BEFORE UPDATE ON agent_long_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paper_notes_updated_at BEFORE UPDATE ON agent_paper_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();