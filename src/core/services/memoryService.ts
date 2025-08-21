/**
 * Memory Management Service
 * 
 * Handles all memory operations including:
 * - Medium-term memory CRUD operations
 * - Paper notes management
 * - Memory usage tracking
 * - Context building for AI conversations
 */

import { supabase } from '../../modules/database/lib/supabase';
import {
  MediumTermMemory,
  CreateMediumTermMemoryRequest,
  PaperNote,
  CreatePaperNoteRequest,
  MemoryUsage,
  MemoryContext,
  MemorySearchQuery,
  MemorySearchResult,
  MemoryServiceInterface,
  MemoryTopic
} from '../types/memory';
import { MEMORY_LIMITS } from '../utils/tokenUtils';

class MemoryService implements MemoryServiceInterface {
  
  // =============================================
  // MEDIUM-TERM MEMORY OPERATIONS
  // =============================================
  
  async createMediumTermMemory(request: CreateMediumTermMemoryRequest): Promise<MediumTermMemory> {
    const { data, error } = await supabase
      .from('agent_medium_memories')
      .insert([{
        agent_id: request.agent_id,
        content: request.content,
        summary: request.summary,
        topic: request.topic,
        keywords: request.keywords || [],
        conversation_id: request.conversation_id,
        related_document_id: request.related_document_id,
        importance_score: request.importance_score || 0.5
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating medium-term memory:', error);
      throw new Error(`Failed to create memory: ${error.message}`);
    }

    return data as MediumTermMemory;
  }

  async getMediumTermMemories(agentId: string, limit = 50): Promise<MediumTermMemory[]> {
    const { data, error } = await supabase
      .from('agent_medium_memories')
      .select('*')
      .eq('agent_id', agentId)
      .order('importance_score', { ascending: false })
      .order('last_accessed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching medium-term memories:', error);
      throw new Error(`Failed to fetch memories: ${error.message}`);
    }

    return data as MediumTermMemory[];
  }

  async updateMemoryAccess(memoryId: string): Promise<void> {
    // First get current access count
    const { data: currentData } = await supabase
      .from('agent_medium_memories')
      .select('access_count')
      .eq('id', memoryId)
      .single();

    const { error } = await supabase
      .from('agent_medium_memories')
      .update({
        access_count: (currentData?.access_count || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', memoryId);

    if (error) {
      console.error('Error updating memory access:', error);
      throw new Error(`Failed to update memory access: ${error.message}`);
    }
  }

  async updateMediumTermMemory(memoryId: string, updates: Partial<MediumTermMemory>): Promise<MediumTermMemory> {
    const { data, error } = await supabase
      .from('agent_medium_memories')
      .update(updates)
      .eq('id', memoryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating medium-term memory:', error);
      throw new Error(`Failed to update memory: ${error.message}`);
    }

    return data as MediumTermMemory;
  }

  async deleteMediumTermMemory(memoryId: string): Promise<void> {
    const { error } = await supabase
      .from('agent_medium_memories')
      .delete()
      .eq('id', memoryId);

    if (error) {
      console.error('Error deleting medium-term memory:', error);
      throw new Error(`Failed to delete memory: ${error.message}`);
    }
  }

  async searchMediumTermMemories(agentId: string, query: string): Promise<MediumTermMemory[]> {
    const { data, error } = await supabase
      .from('agent_medium_memories')
      .select('*')
      .eq('agent_id', agentId)
      .or(`content.ilike.%${query}%,summary.ilike.%${query}%,topic.ilike.%${query}%`)
      .order('importance_score', { ascending: false })
      .order('last_accessed_at', { ascending: false });

    if (error) {
      console.error('Error searching medium-term memories:', error);
      throw new Error(`Failed to search memories: ${error.message}`);
    }

    return data as MediumTermMemory[];
  }

  async getMemoryTopics(agentId: string): Promise<MemoryTopic[]> {
    const { data, error } = await supabase
      .from('agent_memory_topics')
      .select('*')
      .eq('agent_id', agentId)
      .order('frequency_count', { ascending: false });

    if (error) {
      console.error('Error fetching memory topics:', error);
      throw new Error(`Failed to fetch topics: ${error.message}`);
    }

    return data as MemoryTopic[];
  }


  // =============================================
  // PAPER NOTES OPERATIONS
  // =============================================

  async createPaperNote(request: CreatePaperNoteRequest): Promise<PaperNote> {
    const { data, error } = await supabase
      .from('agent_paper_notes')
      .insert([{
        agent_id: request.agent_id,
        title: request.title,
        content: request.content,
        note_type: request.note_type || 'general',
        conversation_id: request.conversation_id,
        source_message_id: request.source_message_id,
        tags: request.tags || [],
        is_pinned: request.is_pinned || false
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating paper note:', error);
      throw new Error(`Failed to create paper note: ${error.message}`);
    }

    return data as PaperNote;
  }

  async getPaperNotes(agentId: string): Promise<PaperNote[]> {
    const { data, error } = await supabase
      .from('agent_paper_notes')
      .select('*')
      .eq('agent_id', agentId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching paper notes:', error);
      throw new Error(`Failed to fetch paper notes: ${error.message}`);
    }

    return data as PaperNote[];
  }

  async updatePaperNote(noteId: string, updates: Partial<PaperNote>): Promise<PaperNote> {
    const { data, error } = await supabase
      .from('agent_paper_notes')
      .update(updates)
      .eq('id', noteId)
      .select()
      .single();

    if (error) {
      console.error('Error updating paper note:', error);
      throw new Error(`Failed to update paper note: ${error.message}`);
    }

    return data as PaperNote;
  }

  async deletePaperNote(noteId: string): Promise<void> {
    const { error } = await supabase
      .from('agent_paper_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('Error deleting paper note:', error);
      throw new Error(`Failed to delete paper note: ${error.message}`);
    }
  }

  // =============================================
  // MEMORY USAGE TRACKING
  // =============================================

  async getMemoryUsage(agentId: string): Promise<MemoryUsage> {
    const { data, error } = await supabase
      .from('agent_memory_usage')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No usage record exists, create one
        const { data: newUsage, error: createError } = await supabase
          .from('agent_memory_usage')
          .insert([{ agent_id: agentId }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating memory usage record:', createError);
          throw new Error(`Failed to create memory usage: ${createError.message}`);
        }

        return newUsage as MemoryUsage;
      }

      console.error('Error fetching memory usage:', error);
      throw new Error(`Failed to fetch memory usage: ${error.message}`);
    }

    return data as MemoryUsage;
  }

  // =============================================
  // CONTEXT BUILDING
  // =============================================

  async buildMemoryContext(agentId: string): Promise<MemoryContext> {
    const [mediumMemories, paperNotes, memoryUsage] = await Promise.all([
      this.getMediumTermMemories(agentId, 100), // Get more from DB, filter by tokens later
      this.getPaperNotes(agentId),
      this.getMemoryUsage(agentId)
    ]);

    // Filter memories to fit within token limits
    const filteredMediumMemories = this.filterMemoriesByTokens(
      mediumMemories, 
      MEMORY_LIMITS.MEDIUM_TERM_MEMORY
    );

    const filteredPaperNotes = this.filterPaperNotesByTokens(
      paperNotes,
      MEMORY_LIMITS.PAPER_NOTES
    );

    // Get active document summaries
    const { data: documents } = await supabase
      .from('agent_documents')
      .select('summary, word_bank, facts_list')
      .eq('agent_id', agentId)
      .eq('is_context_enabled', true)
      .not('summary', 'is', null);

    const activeDocumentSummaries = (documents || []).map(doc => ({
      summary: doc.summary || '',
      word_bank: doc.word_bank || '',
      facts_list: doc.facts_list || undefined
    }));

    const totalTokens = 
      filteredMediumMemories.reduce((sum, mem) => sum + mem.token_count, 0) +
      filteredPaperNotes.reduce((sum, note) => sum + note.token_count, 0) +
      activeDocumentSummaries.reduce((sum, doc) => 
        sum + this.estimateTokens(doc.summary + doc.word_bank + (doc.facts_list || '')), 0
      );

    return {
      medium_term_memories: filteredMediumMemories,
      active_document_summaries: activeDocumentSummaries,
      paper_notes: filteredPaperNotes,
      total_tokens: totalTokens
    };
  }

  // =============================================
  // SEARCH ACROSS ALL MEMORY TYPES
  // =============================================

  async searchAllMemories(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];
    const { query: searchQuery, agent_id, memory_types = ['medium', 'paper', 'documents'], limit = 10 } = query;

    const promises: Promise<void>[] = [];

    if (memory_types.includes('medium')) {
      promises.push(
        this.searchMediumTermMemories(agent_id, searchQuery).then(memories => {
          memories.forEach(memory => {
            results.push({
              type: 'medium',
              id: memory.id,
              content: memory.content,
              summary: memory.summary,
              relevance_score: this.calculateRelevanceScore(memory.content, searchQuery),
              metadata: {
                topic: memory.topic,
                importance_score: memory.importance_score,
                access_count: memory.access_count
              }
            });
          });
        })
      );
    }

    if (memory_types.includes('paper')) {
      promises.push(
        this.searchPaperNotes(agent_id, searchQuery).then(notes => {
          notes.forEach(note => {
            results.push({
              type: 'paper',
              id: note.id,
              content: note.content,
              summary: note.title,
              relevance_score: this.calculateRelevanceScore(note.content, searchQuery),
              metadata: {
                note_type: note.note_type,
                is_pinned: note.is_pinned,
                tags: note.tags
              }
            });
          });
        })
      );
    }

    await Promise.all(promises);

    // Sort by relevance score and return top results
    return results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);
  }

  async searchPaperNotes(agentId: string, query: string): Promise<PaperNote[]> {
    const { data, error } = await supabase
      .from('agent_paper_notes')
      .select('*')
      .eq('agent_id', agentId)
      .or(`content.ilike.%${query}%,title.ilike.%${query}%`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching paper notes:', error);
      return [];
    }

    return data as PaperNote[];
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  private filterMemoriesByTokens(memories: MediumTermMemory[], maxTokens: number): MediumTermMemory[] {
    let totalTokens = 0;
    const filtered: MediumTermMemory[] = [];

    for (const memory of memories) {
      if (totalTokens + memory.token_count <= maxTokens) {
        filtered.push(memory);
        totalTokens += memory.token_count;
      } else {
        break;
      }
    }

    return filtered;
  }

  private filterPaperNotesByTokens(notes: PaperNote[], maxTokens: number): PaperNote[] {
    let totalTokens = 0;
    const filtered: PaperNote[] = [];

    // Prioritize pinned notes
    const sortedNotes = [...notes].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    for (const note of sortedNotes) {
      if (totalTokens + note.token_count <= maxTokens) {
        filtered.push(note);
        totalTokens += note.token_count;
      } else {
        break;
      }
    }

    return filtered;
  }

  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  private calculateRelevanceScore(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    
    let score = 0;
    let matchCount = 0;

    for (const word of queryWords) {
      const wordCount = (contentLower.match(new RegExp(word, 'g')) || []).length;
      if (wordCount > 0) {
        matchCount++;
        score += wordCount;
      }
    }

    // Normalize score based on content length and number of matches
    const normalizedScore = (score / content.length) * 1000;
    const completeness = matchCount / queryWords.length;
    
    return normalizedScore * completeness;
  }

  // =============================================
  // AI-DRIVEN MEMORY SAVING
  // =============================================

  /**
   * Save information to memory as initiated by the AI during conversation
   * This allows the AI to actively build its own memory by identifying relevant information
   */
  async saveMemoryFromAI(agentId: string, memoryData: {
    information: string;
    topic?: string;
    importance?: 'low' | 'medium' | 'high';
    type?: 'fact' | 'concept' | 'preference' | 'insight' | 'summary';
  }): Promise<MediumTermMemory> {
    try {
      // Generate a concise summary if the information is long
      const summary = memoryData.information.length > 150 
        ? memoryData.information.substring(0, 147) + '...'
        : memoryData.information;

      // Extract keywords from the information
      const keywords = this.extractKeywordsFromText(memoryData.information);

      // Determine importance score
      let importanceScore = 0.5; // Default medium importance
      switch (memoryData.importance) {
        case 'high':
          importanceScore = 0.9;
          break;
        case 'medium':
          importanceScore = 0.7;
          break;
        case 'low':
          importanceScore = 0.3;
          break;
      }

      // Create the memory entry
      const memoryEntry = await this.createMediumTermMemory({
        agent_id: agentId,
        content: memoryData.information,
        summary: summary,
        topic: memoryData.topic || this.extractTopicFromText(memoryData.information),
        keywords: keywords,
        importance_score: importanceScore
      });

      console.log(`🧠 AI saved new memory: "${summary}" [${memoryData.topic || 'General'}]`);
      return memoryEntry;
    } catch (error) {
      console.error('Error saving AI-generated memory:', error);
      throw error;
    }
  }

  /**
   * Extract keywords from text for memory indexing
   */
  private extractKeywordsFromText(text: string): string[] {
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can'];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word));
    
    // Return top 5 unique keywords
    const uniqueWords = [...new Set(words)];
    return uniqueWords.slice(0, 5);
  }

  /**
   * Extract main topic from text
   */
  private extractTopicFromText(text: string): string {
    const keywords = this.extractKeywordsFromText(text);
    if (keywords.length === 0) return 'General';
    
    // Return the first significant keyword as topic, capitalized
    return keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1);
  }


  // =============================================
  // AUTO-GENERATION HELPERS
  // =============================================

  async generateMemoryKey(content: string, agentId: string): Promise<string> {
    // Simple key generation based on content analysis
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => word.length > 3)
      .slice(0, 3);

    const baseKey = words.join('_');
    const timestamp = Date.now().toString().slice(-6);
    
    return `${baseKey}_${timestamp}`;
  }


}

export const memoryService = new MemoryService();