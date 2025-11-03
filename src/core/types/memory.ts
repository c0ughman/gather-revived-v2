/**
 * Types for the comprehensive memory management system
 */

// =============================================
// MEDIUM-TERM MEMORY TYPES
// =============================================

export interface MediumTermMemory {
  id: string;
  agent_id: string;
  content: string;
  summary?: string;
  topic: string;
  keywords?: string[];
  conversation_id?: string;
  related_document_id?: string;
  access_count: number;
  last_accessed_at: string;
  topic_frequency: number;
  importance_score: number; // 0-1 scale
  token_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMediumTermMemoryRequest {
  agent_id: string;
  content: string;
  summary?: string;
  topic: string;
  keywords?: string[];
  conversation_id?: string;
  related_document_id?: string;
  importance_score?: number;
}

export interface MemoryTopic {
  id: string;
  agent_id: string;
  topic: string;
  frequency_count: number;
  last_mentioned_at: string;
  created_at: string;
  updated_at: string;
}


// =============================================
// PAPER NOTES TYPES
// =============================================

export interface PaperNote {
  id: string;
  agent_id: string;
  title?: string;
  content: string;
  note_type: 'general' | 'voice_call' | 'chat' | 'generated';
  conversation_id?: string;
  source_message_id?: string;
  tags?: string[];
  is_pinned: boolean;
  token_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePaperNoteRequest {
  agent_id: string;
  title?: string;
  content: string;
  note_type?: 'general' | 'voice_call' | 'chat' | 'generated';
  conversation_id?: string;
  source_message_id?: string;
  tags?: string[];
  is_pinned?: boolean;
}

// =============================================
// ENHANCED DOCUMENT TYPES
// =============================================

export interface EnhancedDocumentInfo {
  id: string;
  agent_id: string;
  name: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  file_url?: string;
  content?: string;
  summary?: string;
  summary_tokens: number;
  word_bank?: string; // Key words and phrases (300 tokens max)
  word_bank_tokens: number;
  facts_list?: string; // Important facts (2000 tokens max)
  facts_tokens: number;
  content_tokens: number;
  extracted_text?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  extraction_quality?: 'excellent' | 'good' | 'partial' | 'poor';
  metadata?: Record<string, any>;
  folder?: string;
  tags?: string[];
  access_count: number;
  last_accessed_at?: string;
  is_context_enabled: boolean;
  last_summarized_at?: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// MEMORY USAGE TRACKING TYPES
// =============================================

export interface MemoryUsage {
  id: string;
  agent_id: string;
  medium_memory_tokens: number;
  paper_notes_tokens: number;
  document_summary_tokens: number;
  document_facts_tokens: number;
  active_document_tokens: number;
  total_memory_tokens: number;
  updated_at: string;
}

export interface MemoryLimits {
  agent_description: number;
  medium_term_memory: number;
  paper_notes: number;
  conversation_context: number;
  document_summary: number;
  document_word_bank: number;
  document_facts: number;
  document_full: number;
  total_system_max: number;
}

// =============================================
// MEMORY CONTEXT TYPES
// =============================================

export interface MemoryContext {
  medium_term_memories: MediumTermMemory[];
  active_document_summaries: {
    summary: string;
    word_bank: string;
    facts_list?: string;
  }[];
  paper_notes: PaperNote[];
  total_tokens: number;
}

export interface MemorySearchQuery {
  query: string;
  agent_id: string;
  memory_types?: ('medium' | 'paper' | 'documents')[];
  topics?: string[];
  limit?: number;
}

export interface MemorySearchResult {
  type: 'medium' | 'paper' | 'document';
  id: string;
  content: string;
  summary?: string;
  relevance_score: number;
  metadata?: Record<string, any>;
}

// =============================================
// MEMORY SERVICE INTERFACES
// =============================================

export interface MemoryServiceInterface {
  // Medium-term memory
  createMediumTermMemory(request: CreateMediumTermMemoryRequest): Promise<MediumTermMemory>;
  getMediumTermMemories(agentId: string, limit?: number): Promise<MediumTermMemory[]>;
  updateMemoryAccess(memoryId: string): Promise<MediumTermMemory>;
  searchMediumTermMemories(agentId: string, query: string): Promise<MediumTermMemory[]>;
  
  // Paper notes
  createPaperNote(request: CreatePaperNoteRequest): Promise<PaperNote>;
  getPaperNotes(agentId: string): Promise<PaperNote[]>;
  updatePaperNote(noteId: string, updates: Partial<PaperNote>): Promise<PaperNote>;
  deletePaperNote(noteId: string): Promise<void>;
  
  // Memory usage
  getMemoryUsage(agentId: string): Promise<MemoryUsage>;
  
  // Context building
  buildMemoryContext(agentId: string): Promise<MemoryContext>;
  
  // Search across all memory types
  searchAllMemories(query: MemorySearchQuery): Promise<MemorySearchResult[]>;
}