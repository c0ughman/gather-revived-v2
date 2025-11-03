-- Add layered document context fields to agent_documents table
-- This supports a 3-layer context system for efficient document processing

ALTER TABLE agent_documents 
ADD COLUMN layer1_summary TEXT,
ADD COLUMN layer1_word_bank TEXT,
ADD COLUMN layer2_summary TEXT,
ADD COLUMN layer3_full_text TEXT,
ADD COLUMN layered_processing_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN estimated_tokens INTEGER;

-- Add index for finding documents that need layered processing
CREATE INDEX idx_agent_documents_layered_processing 
ON agent_documents(layered_processing_complete) 
WHERE layered_processing_complete = FALSE;

-- Add index for estimated tokens to help with processing decisions
CREATE INDEX idx_agent_documents_tokens 
ON agent_documents(estimated_tokens) 
WHERE estimated_tokens IS NOT NULL;

-- Add comment explaining the layered system
COMMENT ON COLUMN agent_documents.layer1_summary IS 'Short summary (~500 tokens) - gestalt overview, always in context';
COMMENT ON COLUMN agent_documents.layer1_word_bank IS 'Keywords and entities (~200 tokens) - proper nouns, concepts';
COMMENT ON COLUMN agent_documents.layer2_summary IS 'Comprehensive facts summary (~2000 tokens) OR full content if document d2000 tokens';
COMMENT ON COLUMN agent_documents.layer3_full_text IS 'Complete document text - only stored for documents >2000 tokens';
COMMENT ON COLUMN agent_documents.layered_processing_complete IS 'Whether AI-powered layered processing has been completed';
COMMENT ON COLUMN agent_documents.estimated_tokens IS 'Estimated token count to determine layer processing strategy';