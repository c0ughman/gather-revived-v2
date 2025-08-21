/**
 * AI Service - Backend Only
 * 
 * This service provides AI generation using only the Python backend.
 * All frontend fallbacks have been removed as requested.
 */

import { AIContact, Message } from '../../../core/types/types';
import { DocumentInfo } from '../types/documents';
import { pythonApiService } from '../../../core/services/pythonApiService';
import { memoryService } from '../../../core/services/memoryService';
import { conversationHistoryService } from '../../../core/services/conversationHistoryService';

class EnhancedAiService {
  private backendAvailable: boolean = false;

  constructor() {
    // Check Python backend availability on initialization
    this.checkBackendAvailability();
    console.log('🤖 AI Service initialized (Backend-only)');
  }

  /**
   * Generate AI response using Python backend with function calling support
   */
  async generateResponse(
    contact: AIContact,
    userMessage: string,
    chatHistory: Message[],
    conversationDocuments: DocumentInfo[] = []
  ): Promise<string> {
    console.log(`🤖 Generating response using Python backend for ${contact.name}`);

    if (!this.backendAvailable) {
      await this.checkBackendAvailability();
      if (!this.backendAvailable) {
        throw new Error('Python backend is not available. Please ensure the backend server is running.');
      }
    }

    try {
      // First, get the AI response
      let response = await pythonApiService.generateAIResponse(
        contact,
        userMessage,
        chatHistory,
        conversationDocuments
      );

      // Intelligent context detection - search when user references past events or topics
      const contextualSearchQuery = this.detectContextualSearchNeeds(userMessage, chatHistory);

      if (contextualSearchQuery) {
        console.log(`🧠 Detected contextual search need: "${contextualSearchQuery}"`);
        
        try {
          // Search past conversations for context
          const searchResults = await this.handleFunctionCall('search_past_chats', {
            query: contextualSearchQuery,
            limit: 3  // Keep it focused
          }, contact.id);

          // Parse search results to add relevant context to AI
          const parsedResults = JSON.parse(searchResults);
          
          if (parsedResults.success && parsedResults.results && parsedResults.results.length > 0) {
            // Add context to the conversation without being obvious about it
            const contextualInfo = parsedResults.results
              .map((result: any) => `[Context: ${result.relevant_excerpt}]`)
              .join('\n');
            
            // Generate response with additional context
            const contextEnrichedMessage = `${userMessage}\n\n[Additional Context from Past Conversations:\n${contextualInfo}]`;
            
            response = await pythonApiService.generateAIResponse(
              contact,
              contextEnrichedMessage,
              chatHistory,
              conversationDocuments
            );
            
            console.log(`✅ Enhanced response with context from ${parsedResults.results.length} past conversations`);
          }
        } catch (searchError) {
          console.error('❌ Background context search failed:', searchError);
          // Continue with normal response if search fails
        }
      }

      return response;
    } catch (error) {
      console.error(`❌ Backend failed for AI generation:`, error);
      // Mark backend as unavailable and re-throw error
      this.backendAvailable = false;
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Intelligent detection of when to search past conversations for context
   * This analyzes the user's message for references to past events, specific topics, or contextual needs
   */
  private detectContextualSearchNeeds(message: string, chatHistory: Message[]): string | null {
    
    // 1. Direct references to past events/conversations
    const pastReferencePatterns = [
      /(?:last time|before|earlier|previously|when we|remember when|you (?:said|mentioned|told me))/i,
      /(?:did we|have we|have you|did you|what did|when did)/i,
      /(?:our (?:previous|last) (?:conversation|discussion|chat|talk))/i,
      /(?:you (?:mentioned|told me|said) (?:before|earlier|previously))/i,
      /(?:we (?:discussed|talked about) (?:this )?before)/i
    ];

    if (pastReferencePatterns.some(pattern => pattern.test(message))) {
      console.log(`🔍 Detected past reference pattern`);
      return this.extractMainTopicsFromMessage(message);
    }

    // 2. Questions that might benefit from historical context
    const contextualQuestionPatterns = [
      /(?:why|how|what|when|where) (?:did|do|does|is|was|were)/i,
      /(?:can you (?:explain|tell me)|what about|how about)/i,
      /(?:what's the (?:status|update) on)/i,
      /(?:remind me about|refresh my memory)/i
    ];

    if (contextualQuestionPatterns.some(pattern => pattern.test(message))) {
      // Extract key entities/topics that might have been discussed before
      const topics = this.extractMainTopicsFromMessage(message);
      if (topics && topics.length > 3) { // Only search if we have substantial topics
        console.log(`🔍 Detected contextual question about: ${topics}`);
        return topics;
      }
    }

    // 3. Specific entities or topics that might have context
    const namedEntities = this.extractNamedEntitiesFromMessage(message);
    if (namedEntities.length > 0) {
      // Check if this seems like a follow-up about something specific
      const followUpIndicators = [
        /(?:more about|tell me about|what about|how is|what's happening with)/i,
        /(?:update|status|progress|development)/i,
        /(?:issue|problem|solution|plan)/i
      ];

      if (followUpIndicators.some(pattern => pattern.test(message))) {
        console.log(`🔍 Detected follow-up about named entities: ${namedEntities.join(', ')}`);
        return namedEntities.join(' ');
      }
    }

    // 4. Current conversation lacks context (short history + complex question)
    if (chatHistory.length < 5 && message.length > 50) {
      const complexityIndicators = [
        /(?:complex|complicated|detailed|specific|particular)/i,
        /(?:multiple|several|various|different)/i,
        /(?:project|system|process|method|approach)/i
      ];

      if (complexityIndicators.some(pattern => pattern.test(message))) {
        const topics = this.extractMainTopicsFromMessage(message);
        if (topics && topics.length > 5) {
          console.log(`🔍 Detected complex question with limited context: ${topics}`);
          return topics;
        }
      }
    }

    return null;
  }

  /**
   * Extract main topics/keywords from a message for searching
   */
  private extractMainTopicsFromMessage(message: string): string {
    // Remove common words and extract meaningful terms
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'we', 'they', 'me', 'us', 'them', 'my', 'your', 'our', 'their',
      'what', 'when', 'where', 'why', 'how', 'who', 'which'
    ]);

    const words = message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));

    // Return the most meaningful words (limited to avoid over-broad searches)
    return words.slice(0, 5).join(' ');
  }

  /**
   * Extract named entities (proper nouns, specific terms) from message
   */
  private extractNamedEntitiesFromMessage(message: string): string[] {
    // Look for capitalized words (potential proper nouns) and quoted terms
    const entities: string[] = [];
    
    // Capitalized words (potential names, places, products)
    const capitalizedWords = message.match(/\b[A-Z][a-zA-Z]+\b/g) || [];
    entities.push(...capitalizedWords);

    // Quoted terms
    const quotedTerms = message.match(/"([^"]+)"/g) || [];
    entities.push(...quotedTerms.map(term => term.replace(/"/g, '')));

    // Technical terms or specific formats
    const technicalPatterns = [
      /\b[a-zA-Z]+\.[a-zA-Z]+\b/g, // domain-like terms
      /\b[A-Z]{2,}\b/g, // acronyms
      /\b\w+[-_]\w+\b/g // hyphenated or underscore terms
    ];

    technicalPatterns.forEach(pattern => {
      const matches = message.match(pattern) || [];
      entities.push(...matches);
    });

    // Remove duplicates and return unique entities
    return [...new Set(entities)]
      .filter(entity => entity.length > 1)
      .slice(0, 3); // Limit to most relevant entities
  }

  /**
   * Summarize document using Python backend only
   */
  async summarizeDocument(documentContent: string, filename: string): Promise<string> {
    console.log(`📄 Summarizing document using Python backend: ${filename}`);

    if (!this.backendAvailable) {
      await this.checkBackendAvailability();
      if (!this.backendAvailable) {
        throw new Error('Python backend is not available. Please ensure the backend server is running.');
      }
    }

    try {
      return await pythonApiService.summarizeDocument(documentContent, filename);
    } catch (error) {
      console.error(`❌ Backend failed for document summarization:`, error);
      // Mark backend as unavailable and re-throw error
      this.backendAvailable = false;
      throw new Error(`Document summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service status and capabilities
   */
  async getServiceStatus(): Promise<{
    backend: { available: boolean; features: string[] };
    status: string;
  }> {
    await this.checkBackendAvailability();

    return {
      backend: {
        available: this.backendAvailable,
        features: [
          'Google Gemini API integration',
          'Response generation with optimized performance',
          'Document summarization',
          'Chat history processing',
          'Advanced prompt optimization',
          'Server-side error handling',
          'Secure API key management'
        ]
      },
      status: this.backendAvailable ? 'Backend Ready' : 'Backend Unavailable'
    };
  }

  /**
   * Force refresh of Python backend availability
   */
  async refreshBackendStatus(): Promise<void> {
    await this.checkBackendAvailability();
    console.log(`🔄 AI backend status refreshed - Available: ${this.backendAvailable}`);
  }

  /**
   * Check if Python backend is available
   */
  private async checkBackendAvailability(): Promise<void> {
    try {
      this.backendAvailable = await pythonApiService.isAvailable();
      console.log(`🔍 Backend availability check: ${this.backendAvailable ? 'Available' : 'Unavailable'}`);
    } catch (error) {
      console.warn('Backend availability check failed:', error);
      this.backendAvailable = false;
    }
  }

  /**
   * Get backend availability status
   */
  isBackendAvailable(): boolean {
    return this.backendAvailable;
  }

  /**
   * Handle function calls from chat interface
   * This enables the same functionality that voice calls have
   */
  async handleFunctionCall(functionName: string, functionArgs: any, agentId: string): Promise<string> {
    try {
      console.log(`🔧 Handling function call in chat: ${functionName}`, functionArgs);

      // Handle search past chats function
      if (functionName === 'search_past_chats') {
        if (!agentId) {
          throw new Error('No agent ID available for searching past conversations');
        }

        // Validate required arguments
        if (!functionArgs.query || typeof functionArgs.query !== 'string') {
          throw new Error('Query parameter is required and must be a string');
        }

        const limit = Math.max(1, Math.min(10, functionArgs.limit || 5));
        
        // Search for past conversations
        const sessions = await conversationHistoryService.searchAgentMessages(agentId, functionArgs.query);
        
        // Limit results
        const limitedSessions = sessions.slice(0, limit);
        
        // Create conversation previews
        const previews = await conversationHistoryService.createConversationPreviews(limitedSessions, functionArgs.query);
        
        // Format results for AI consumption
        const formattedResults = previews.map(preview => ({
          conversation_id: preview.id,
          title: preview.title,
          date: preview.lastMessageAt.toISOString(),
          summary: preview.preview,
          relevant_excerpt: preview.searchMatch?.text || preview.preview,
          message_count: preview.messageCount,
          type: preview.conversationType
        }));

        console.log(`📋 Found ${formattedResults.length} past conversations matching "${functionArgs.query}"`);
        
        // Return formatted results as JSON string for AI to process
        return JSON.stringify({
          success: true,
          results: formattedResults,
          total_found: formattedResults.length,
          search_query: functionArgs.query
        });
      }

      // Handle save to memory function
      if (functionName === 'save_to_memory') {
        if (!agentId) {
          throw new Error('No agent ID available for saving memory');
        }

        // Validate required arguments
        if (!functionArgs.information || typeof functionArgs.information !== 'string') {
          throw new Error('Information parameter is required and must be a string');
        }

        // Save memory using memory service
        await memoryService.saveMemoryFromAI(agentId, {
          information: functionArgs.information,
          topic: functionArgs.topic || 'General',
          importance: functionArgs.importance || 'medium',
          type: functionArgs.type || 'insight'
        });

        console.log(`🧠 Saved memory for agent ${agentId}: "${functionArgs.information.substring(0, 50)}..."`);
        
        return JSON.stringify({
          success: true,
          message: 'Memory saved successfully',
          topic: functionArgs.topic || 'General'
        });
      }

      throw new Error(`Unknown function: ${functionName}`);
      
    } catch (error) {
      console.error(`❌ Function call failed:`, error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const enhancedAiService = new EnhancedAiService();