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
    // Check for similar memories before creating new one
    const existingMemoryId = await this.checkForSimilarMemory(request.agent_id, request.content, request.summary);
    
    if (existingMemoryId) {
      // Update existing memory timestamp instead of creating duplicate
      console.log(`🔄 Found similar memory, updating timestamp instead of creating duplicate`);
      return await this.updateMemoryAccess(existingMemoryId);
    }

    // No similar memory found, create new one
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
    console.log('🏴‍☠️ MEDIUM TERM MEMORY ACCESSED - Barcelona - Agent:', agentId, '- Action: GET_MEMORIES - Limit:', limit);
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

  async updateMemoryAccess(memoryId: string): Promise<MediumTermMemory> {
    // First get current access count
    const { data: currentData } = await supabase
      .from('agent_medium_memories')
      .select('access_count')
      .eq('id', memoryId)
      .single();

    const { data, error } = await supabase
      .from('agent_medium_memories')
      .update({
        access_count: (currentData?.access_count || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', memoryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating memory access:', error);
      throw new Error(`Failed to update memory access: ${error.message}`);
    }

    return data as MediumTermMemory;
  }

  async updateMediumTermMemory(memoryId: string, updates: Partial<MediumTermMemory>): Promise<MediumTermMemory> {
    // If trying to pin a memory, check if pinned memories would exceed token limit
    if (updates.importance_score !== undefined && updates.importance_score >= 1.0) {
      const canPin = await this.canPinMemory(memoryId);
      if (!canPin) {
        throw new Error('Cannot pin memory: Pinned memories already at token limit');
      }
    }

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

  /**
   * Check if a memory can be pinned without exceeding token limits
   */
  private async canPinMemory(memoryId: string): Promise<boolean> {
    try {
      // Get the memory to be pinned
      const { data: memoryToPin } = await supabase
        .from('agent_medium_memories')
        .select('agent_id, content')
        .eq('id', memoryId)
        .single();

      if (!memoryToPin) return false;

      // Get all current pinned memories for this agent
      const { data: pinnedMemories } = await supabase
        .from('agent_medium_memories')
        .select('content')
        .eq('agent_id', memoryToPin.agent_id)
        .gte('importance_score', 1.0);

      // Calculate tokens for existing pinned memories
      const existingPinnedTokens = (pinnedMemories || [])
        .reduce((total, mem) => total + this.countTokens(mem.content || ''), 0);

      // Calculate tokens for memory to be pinned
      const memoryTokens = this.countTokens(memoryToPin.content || '');

      // Check if total would exceed limit (500 tokens based on context_limits)
      const totalTokens = existingPinnedTokens + memoryTokens;
      return totalTokens <= 500; // MEDIUM_TERM_MEMORY_MAX_TOKENS

    } catch (error) {
      console.error('Error checking pin capability:', error);
      return false;
    }
  }

  /**
   * Simple token counting (4 chars per token approximation)
   */
  private countTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
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
    console.log('🏴‍☠️ MEDIUM TERM MEMORY SEARCH ACCESSED - Barcelona - Agent:', agentId, '- SEARCH KEYWORD:', `"${query}"`);
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

  /**
   * Check if a similar memory already exists using AI analysis
   * Returns the ID of similar memory if found, null otherwise
   */
  async checkForSimilarMemory(agentId: string, content: string, summary?: string): Promise<string | null> {
    try {
      // Get existing memories in context for this agent
      const existingMemories = await this.getMediumTermMemories(agentId, 100);
      
      if (existingMemories.length === 0) {
        return null; // No existing memories to compare against
      }

      // Use AI to analyze similarity - create a prompt for the AI
      const prompt = this.buildSimilarityAnalysisPrompt(content, summary, existingMemories);
      
      // Call AI service to analyze similarity
      const result = await this.analyzeMemorySimilarity(prompt);
      
      if (result.hasSimilar) {
        console.log(`🔍 Memory deduplication: Found similar memory ID ${result.similarMemoryId}`);
        return result.similarMemoryId;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking for similar memory:', error);
      // Don't block memory saving if similarity check fails
      return null;
    }
  }

  /**
   * Build prompt for AI similarity analysis
   */
  private buildSimilarityAnalysisPrompt(newContent: string, newSummary: string | undefined, existingMemories: any[]): string {
    const memoryListText = existingMemories.map((memory, index) => 
      `${index + 1}. ID: ${memory.id} | Content: "${memory.content}" | Summary: "${memory.summary || 'N/A'}"`
    ).join('\n');

    return `You are analyzing whether a new memory should be saved or if it's too similar to existing memories.

NEW MEMORY TO SAVE:
Content: "${newContent}"
Summary: "${newSummary || 'N/A'}"

EXISTING MEMORIES:
${memoryListText}

TASK: Determine if the new memory is substantially similar to any existing memory. Two memories are considered similar if they contain essentially the same information, facts, or insights, even if worded differently.

Examples of SIMILAR memories that should NOT be saved:
- "User likes pizza" vs "User enjoys eating pizza" 
- "Meeting is at 3pm tomorrow" vs "Tomorrow's meeting starts at 15:00"
- "John works at Google" vs "John is employed by Google Inc."

Examples of DIFFERENT memories that SHOULD be saved:
- "User likes pizza" vs "User is allergic to mushrooms"
- "Meeting at 3pm" vs "Meeting location is Conference Room A"
- "John works at Google" vs "John graduated from Stanford"

Respond with ONLY a JSON object:
{
  "hasSimilar": boolean,
  "similarMemoryId": "memory_id_if_similar_found_or_null",
  "reasoning": "brief explanation of your decision"
}`;
  }

  /**
   * Enhanced similarity analysis with improved algorithms
   */
  private async analyzeMemorySimilarity(prompt: string): Promise<{
    hasSimilar: boolean;
    similarMemoryId: string | null;
    reasoning: string;
  }> {
    // Extract key information from the prompt for enhanced similarity detection
    const lines = prompt.split('\n');
    const newContentLine = lines.find(line => line.startsWith('Content:'));
    const existingMemoriesStart = lines.findIndex(line => line === 'EXISTING MEMORIES:');
    
    if (!newContentLine || existingMemoriesStart === -1) {
      return { hasSimilar: false, similarMemoryId: null, reasoning: 'Could not parse prompt' };
    }
    
    const newContent = newContentLine.replace(/Content: "/g, '').replace(/"$/g, '');
    const existingMemoryLines = lines.slice(existingMemoriesStart + 1).filter(line => line.trim().length > 0 && !line.startsWith('TASK:'));
    
    // Enhanced similarity check with multiple techniques
    for (const memoryLine of existingMemoryLines) {
      const idMatch = memoryLine.match(/ID: ([^|]+)/);
      const contentMatch = memoryLine.match(/Content: "([^"]+)"/);
      
      if (idMatch && contentMatch) {
        const existingContent = contentMatch[1];
        
        // Calculate multiple similarity scores
        const wordSimilarity = this.calculateWordSimilarity(newContent, existingContent);
        const fuzzyScore = this.calculateFuzzyMatchScore(newContent, existingContent);
        const semanticScore = this.calculateSemanticSimilarity(newContent, existingContent);
        
        // Combined similarity score with weights
        const combinedScore = (wordSimilarity * 0.4) + (fuzzyScore * 0.3) + (semanticScore * 0.3);
        
        console.log(`🔍 Memory similarity analysis: word=${Math.round(wordSimilarity*100)}%, fuzzy=${Math.round(fuzzyScore*100)}%, semantic=${Math.round(semanticScore*100)}%, combined=${Math.round(combinedScore*100)}%`);
        
        // Lowered threshold to 50%
        if (combinedScore > 0.5) {
          return {
            hasSimilar: true,
            similarMemoryId: idMatch[1].trim(),
            reasoning: `Found ${Math.round(combinedScore * 100)}% similarity (word: ${Math.round(wordSimilarity*100)}%, fuzzy: ${Math.round(fuzzyScore*100)}%, semantic: ${Math.round(semanticScore*100)}%)`
          };
        }
      }
    }
    
    return { hasSimilar: false, similarMemoryId: null, reasoning: 'No similar memories found' };
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
  // ENHANCED SIMILARITY DETECTION METHODS
  // =============================================

  /**
   * Calculate word-based similarity with improved normalization
   */
  private calculateWordSimilarity(content1: string, content2: string): number {
    const words1 = this.normalizeContent(content1);
    const words2 = this.normalizeContent(content2);
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    return intersection.size / Math.max(words1.size, words2.size);
  }

  /**
   * Calculate semantic similarity using synonym detection
   */
  private calculateSemanticSimilarity(content1: string, content2: string): number {
    const words1 = this.normalizeContent(content1);
    const words2 = this.normalizeContent(content2);
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    let synonymMatches = 0;
    let totalWords = 0;
    
    for (const word1 of words1) {
      totalWords++;
      if (words2.has(word1)) {
        synonymMatches++; // Direct match
      } else {
        // Check for synonyms
        const synonyms = this.getSynonyms(word1);
        if (synonyms.some(synonym => words2.has(synonym))) {
          synonymMatches++;
        }
      }
    }
    
    return totalWords > 0 ? synonymMatches / totalWords : 0;
  }

  /**
   * Calculate fuzzy matching score for slight variations
   */
  private calculateFuzzyMatchScore(content1: string, content2: string): number {
    const normalized1 = content1.toLowerCase().trim();
    const normalized2 = content2.toLowerCase().trim();
    
    // Calculate Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    if (maxLength === 0) return 1;
    
    return 1 - (distance / maxLength);
  }

  /**
   * Normalize content by removing stop words and handling punctuation
   */
  private normalizeContent(content: string): Set<string> {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'am', 'i', 'you', 'he', 'she',
      'it', 'we', 'they', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its',
      'our', 'their', 'me', 'him', 'her', 'us', 'them'
    ]);
    
    return new Set(
      content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
    );
  }

  /**
   * Get synonyms for common word pairs
   */
  private getSynonyms(word: string): string[] {
    const synonymMap: { [key: string]: string[] } = {
      'like': ['love', 'enjoy', 'prefer', 'adore'],
      'love': ['like', 'enjoy', 'adore'],
      'enjoy': ['like', 'love', 'prefer'],
      'prefer': ['like', 'enjoy', 'favor'],
      'work': ['job', 'employment', 'career', 'position'],
      'works': ['employed', 'job'],
      'employed': ['works', 'job'],
      'job': ['work', 'employment', 'career', 'position'],
      'eat': ['consume', 'have'],
      'eating': ['consuming', 'having'],
      'food': ['meal', 'dish'],
      'good': ['great', 'excellent', 'nice', 'wonderful'],
      'great': ['good', 'excellent', 'awesome', 'wonderful'],
      'bad': ['poor', 'terrible', 'awful'],
      'big': ['large', 'huge', 'massive'],
      'small': ['little', 'tiny', 'mini'],
      'fast': ['quick', 'rapid', 'speedy'],
      'slow': ['gradual', 'sluggish'],
      'happy': ['glad', 'joyful', 'pleased'],
      'sad': ['unhappy', 'depressed', 'upset'],
      'smart': ['intelligent', 'clever', 'bright'],
      'learn': ['study', 'understand'],
      'learning': ['studying', 'understanding'],
      'create': ['make', 'build', 'develop'],
      'creating': ['making', 'building', 'developing'],
      'use': ['utilize', 'employ'],
      'using': ['utilizing', 'employing']
    };
    
    return synonymMap[word] || [];
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
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