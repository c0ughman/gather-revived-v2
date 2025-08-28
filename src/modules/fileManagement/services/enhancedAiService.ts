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
import { APP_CONFIG } from '../../../core/config';

class EnhancedAiService {
  private backendAvailable: boolean = false;

  constructor() {
    // Check Python backend availability on initialization
    this.checkBackendAvailability();
    
    // Log context testing mode status
    if (APP_CONFIG.debugging.contextTesting.enabled) {
      console.log('🔬 Frontend context testing mode ENABLED - webhook:', APP_CONFIG.debugging.contextTesting.webhookUrl);
    } else {
      console.log('🔬 Frontend context testing mode DISABLED');
    }
    
    console.log('🤖 AI Service initialized (Backend-only)');
  }

  /**
   * Send request data to context testing webhook for debugging (non-blocking)
   */
  private async sendToContextTestingWebhook(testData: any): Promise<void> {
    if (!APP_CONFIG.debugging.contextTesting.enabled) {
      return;
    }

    try {
      // Add metadata
      const payload = {
        ...testData,
        _metadata: {
          timestamp: new Date().toISOString(),
          source: 'gather_frontend_ai_service',
          testing_mode: 'context_testing',
          version: '1.0.0'
        }
      };

      // Send asynchronously without blocking - use no-cors mode for webhook.site
      fetch(APP_CONFIG.debugging.contextTesting.webhookUrl, {
        method: 'POST',
        mode: 'no-cors', // Allow cross-origin requests to webhook.site
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).then(() => {
        // Note: with no-cors mode, we can't check response status
        console.log('🔬 Frontend context testing data sent to webhook');
      }).catch(error => {
        // Silently ignore CORS and network errors for debugging webhook
        console.debug('🔬 Frontend context testing webhook error (ignored):', error);
      });

    } catch (error) {
      // Never let testing mode break the main flow
      console.debug('Frontend context testing failed (non-blocking):', error);
    }
  }

  /**
   * Generate AI response using Python backend with function calling support
   */
  async generateResponse(
    contact: AIContact,
    userMessage: string,
    chatHistory: Message[],
    conversationDocuments: DocumentInfo[] = []
  ): Promise<{
    response: string;
    updatedChatHistory: Message[];
  }> {
    console.log(`🤖 Generating response using Python backend for ${contact.name}`);

    if (!this.backendAvailable) {
      await this.checkBackendAvailability();
      if (!this.backendAvailable) {
        throw new Error('Python backend is not available. Please ensure the backend server is running.');
      }
    }

    try {
      // Send to context testing webhook if enabled (non-blocking)
      if (APP_CONFIG.debugging.contextTesting.enabled) {
        // Create the complete request payload that gets sent to the backend
        const completeRequestPayload = {
          contact: {
            id: contact.id,
            name: contact.name,
            description: contact.description,
            integrations: contact.integrations
          },
          user_message: userMessage,
          chat_history: chatHistory.map(msg => ({
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp
          })),
          conversation_documents: conversationDocuments.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: doc.type,
            content: doc.content,
            extracted_text: doc.extractedText,
            summary: doc.summary,
            metadata: doc.metadata
          }))
        };

        const testData = {
          request_type: 'frontend_generate_response',
          contact_info: {
            name: contact.name,
            id: contact.id,
            description_length: contact.description?.length || 0,
            integrations_count: contact.integrations?.length || 0,
            documents_count: contact.documents?.length || 0
          },
          user_message: userMessage,
          chat_history_length: chatHistory.length,
          conversation_documents_count: conversationDocuments.length,
          backend_available: this.backendAvailable,
          // Include the complete request payload that gets sent to Gemini API
          complete_request_payload: completeRequestPayload,
          // Include the actual chat history content
          chat_history_content: chatHistory.map(msg => ({
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp
          })),
          // Include the actual document content
          conversation_documents_content: conversationDocuments.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: doc.type,
            content: doc.content,
            extracted_text: doc.extractedText,
            summary: doc.summary,
            metadata: doc.metadata
          }))
        };
        this.sendToContextTestingWebhook(testData);
      }

      // Get the AI response (no compacting)
      const result = await pythonApiService.generateAIResponse(
        contact,
        userMessage,
        chatHistory,
        conversationDocuments
      );

      // Return original chat history unchanged (no compacting)
      return {
        response: result.response,
        updatedChatHistory: chatHistory
      };
    } catch (error) {
      console.error(`❌ Backend failed for AI generation:`, error);
      // Mark backend as unavailable and re-throw error
      this.backendAvailable = false;
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * DEPRECATED - Backend now handles all context detection
   */
  private detectContextualSearchNeeds(): string | null {
    console.log('⚠️ detectContextualSearchNeeds is deprecated - backend handles context detection');
    return null;
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