-- =============================================
-- REMOVE LONG-TERM MEMORY SYSTEM
-- =============================================
-- This migration removes the agent_long_memories table and related components
-- as the system is being simplified to use only medium-term memory

-- Drop triggers first
DROP TRIGGER IF EXISTS update_long_memory_tokens ON agent_long_memories;
DROP TRIGGER IF EXISTS update_memory_usage_on_long ON agent_long_memories;
DROP TRIGGER IF EXISTS update_long_memories_updated_at ON agent_long_memories;

-- Drop indexes
DROP INDEX IF EXISTS idx_agent_long_memories_agent_id;
DROP INDEX IF EXISTS idx_agent_long_memories_key;
DROP INDEX IF EXISTS idx_agent_long_memories_keywords;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can manage own agent long memories" ON agent_long_memories;

-- Drop the table
DROP TABLE IF EXISTS agent_long_memories;

-- Update memory usage tracking function to remove long_memory references
CREATE OR REPLACE FUNCTION update_memory_usage_stats()
RETURNS TRIGGER AS $$
DECLARE
    agent_uuid UUID;
    medium_tokens INTEGER := 0;
    paper_tokens INTEGER := 0;
    doc_summary_tokens INTEGER := 0;
    total_tokens INTEGER;
BEGIN
    -- Determine which agent was affected
    IF TG_TABLE_NAME = 'agent_medium_memories' THEN
        agent_uuid = COALESCE(NEW.agent_id, OLD.agent_id);
    ELSIF TG_TABLE_NAME = 'agent_paper_notes' THEN
        agent_uuid = COALESCE(NEW.agent_id, OLD.agent_id);
    ELSIF TG_TABLE_NAME = 'agent_documents' THEN
        agent_uuid = COALESCE(NEW.agent_id, OLD.agent_id);
    END IF;
    
    -- Calculate totals for this agent (excluding long-term memory)
    SELECT COALESCE(SUM(token_count), 0) INTO medium_tokens
    FROM agent_medium_memories WHERE agent_id = agent_uuid;
    
    SELECT COALESCE(SUM(token_count), 0) INTO paper_tokens
    FROM agent_paper_notes WHERE agent_id = agent_uuid;
    
    SELECT COALESCE(SUM(summary_tokens + facts_tokens), 0) INTO doc_summary_tokens
    FROM agent_documents WHERE agent_id = agent_uuid;
    
    total_tokens = medium_tokens + paper_tokens + doc_summary_tokens;
    
    -- Update or insert usage record (without long_memory_tokens column)
    INSERT INTO agent_memory_usage (
        agent_id, 
        medium_memory_tokens, 
        paper_notes_tokens,
        document_summary_tokens,
        total_memory_tokens,
        updated_at
    )
    VALUES (agent_uuid, medium_tokens, paper_tokens, doc_summary_tokens, total_tokens, now())
    ON CONFLICT (agent_id) 
    DO UPDATE SET 
        medium_memory_tokens = EXCLUDED.medium_memory_tokens,
        paper_notes_tokens = EXCLUDED.paper_notes_tokens,
        document_summary_tokens = EXCLUDED.document_summary_tokens,
        total_memory_tokens = EXCLUDED.total_memory_tokens,
        updated_at = EXCLUDED.updated_at;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update token counting function to remove long_memory references
CREATE OR REPLACE FUNCTION update_memory_token_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update token count based on content length
    IF TG_TABLE_NAME = 'agent_medium_memories' THEN
        NEW.token_count = CEIL(LENGTH(NEW.content) / 4.0);
    ELSIF TG_TABLE_NAME = 'agent_paper_notes' THEN
        NEW.token_count = CEIL(LENGTH(NEW.content) / 4.0);
    END IF;
    
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove long_memory_tokens column from agent_memory_usage table
ALTER TABLE agent_memory_usage DROP COLUMN IF EXISTS long_memory_tokens;