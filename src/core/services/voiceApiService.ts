/**
 * Voice API Service
 * 
 * Service for integrating Gemini Live voice calls with Python backend
 * as recommended by the Live API docs.
 * 
 * Frontend handles:
 * - Real-time audio streaming
 * - Audio playback  
 * - Voice Activity Detection
 * - UI updates
 * - Direct WebSocket connection to Live API
 * 
 * Backend handles:
 * - Authentication and ephemeral tokens
 * - Tool use and function calling (paper tool)
 * - Session management and context
 */

import { AIContact } from '../types/types';
import { documentContextService } from '../../modules/fileManagement/services/documentContextService';
import { memoryService } from './memoryService';

interface VoiceSession {
  session_id: string;
  ephemeral_token: string;
  function_declarations: any[];
  system_prompt: string;
  expires_in: number;
  agent_id?: string; // Store agent ID for memory saving
}

interface FunctionCallResult {
  success: boolean;
  function: string;
  result?: any;
  error?: string;
}

class VoiceApiService {
  private baseUrl: string;
  private currentSession: VoiceSession | null = null;

  constructor() {
    // Use environment variable to determine Python backend URL
    this.baseUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';
    console.log('🎤 Voice API Service initialized:', this.baseUrl);
  }

  /**
   * Check if Python voice backend is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.warn('Voice backend not available:', error);
      return false;
    }
  }

  /**
   * Create a new voice session with backend
   * This handles ephemeral token generation and session setup
   */
  async createSession(contact: AIContact): Promise<VoiceSession> {
    try {
      console.log(`🎤 Creating voice session for ${contact.name} via Python backend`);

      // Get full document context including memory
      const documentContext = await documentContextService.getAgentDocumentContext(contact);
      
      console.log('🧠 Voice: Including memory context in backend session:', !!documentContext.memoryContext);
      
      const requestBody = {
        id: contact.id,
        name: contact.name,
        description: contact.description,
        full_context: documentContext.formattedContext, // Include complete context with memory
        integrations: contact.integrations,
        documents: contact.documents,
        memory_context: documentContext.memoryContext // Explicit memory context for backend
      };

      const authToken = this.getAuthToken();
      let response: Response;

      // Try authenticated endpoint first
      if (authToken) {
        response = await fetch(`${this.baseUrl}/api/v1/voice/session/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(requestBody)
        });
      } else {
        // Fallback to development endpoint (no auth required)
        console.log('🧪 Using development voice endpoint (no auth token available)');
        response = await fetch(`${this.baseUrl}/api/v1/voice/dev/session/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Session creation failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Voice session creation failed');
      }

      // Store session for future function calls
      this.currentSession = result.session;
      this.currentSession.agent_id = contact.id; // Store agent ID for memory saving
      
      console.log(`✅ Voice session created: ${this.currentSession.session_id}`);
      return this.currentSession;

    } catch (error) {
      console.error(`❌ Error creating voice session:`, error);
      throw error;
    }
  }

  /**
   * Handle function calls from Gemini Live
   * This is where the paper tool and other functions are processed
   */
  async handleFunctionCall(functionName: string, functionArgs: any): Promise<FunctionCallResult> {
    try {
      if (!this.currentSession) {
        throw new Error('No active voice session - create session first');
      }

      // Handle memory functions locally (don't require backend)
      if (functionName === 'save_to_memory') {
        return await this.handleMemorySaving(functionArgs);
      }
      
      // Handle paper to notes saving locally
      if (functionName === 'save_paper_to_notes') {
        return await this.handlePaperToNotesSaving(functionArgs);
      }

      // Handle past conversations search locally  
      if (functionName === 'search_past_conversations') {
        return await this.handlePastConversationsSearch(functionArgs);
      }
      

      console.log(`🔧 Processing function call ${functionName} via Python backend`);

      const requestBody = {
        name: functionName,
        args: functionArgs
      };

      const authToken = this.getAuthToken();
      let response: Response;

      // Try authenticated endpoint first
      if (authToken) {
        response = await fetch(`${this.baseUrl}/api/v1/voice/session/${this.currentSession.session_id}/function-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(requestBody)
        });
      } else {
        // Fallback to development endpoint
        response = await fetch(`${this.baseUrl}/api/v1/voice/dev/session/${this.currentSession.session_id}/function-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Function call failed: ${response.status}`);
      }

      const result = await response.json();
      
      console.log(`✅ Function call ${functionName} completed:`, result.success ? 'success' : 'failed');
      return result;

    } catch (error) {
      console.error(`❌ Error in function call ${functionName}:`, error);
      return {
        success: false,
        function: functionName,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get session context from backend
   */
  async getSessionContext(): Promise<any> {
    try {
      if (!this.currentSession) {
        throw new Error('No active voice session');
      }

      const authToken = this.getAuthToken();
      let response: Response;

      if (authToken) {
        response = await fetch(`${this.baseUrl}/api/v1/voice/session/${this.currentSession.session_id}/context`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      } else {
        response = await fetch(`${this.baseUrl}/api/v1/voice/dev/session/${this.currentSession.session_id}/context`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to get session context: ${response.status}`);
      }

      const result = await response.json();
      return result.context;

    } catch (error) {
      console.error('❌ Error getting session context:', error);
      throw error;
    }
  }

  /**
   * End the current voice session
   */
  async endSession(): Promise<void> {
    try {
      if (!this.currentSession) {
        return; // No session to end
      }

      console.log(`🎤 Ending voice session ${this.currentSession.session_id}`);

      const authToken = this.getAuthToken();
      let response: Response;

      if (authToken) {
        response = await fetch(`${this.baseUrl}/api/v1/voice/session/${this.currentSession.session_id}/end`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      } else {
        // Development endpoint - for now just clear local session
        console.log('🧪 Ending development session locally');
        this.currentSession = null;
        return;
      }

      if (response.ok) {
        console.log('✅ Voice session ended successfully');
      } else {
        console.warn('⚠️ Session end request failed, clearing locally');
      }

      this.currentSession = null;

    } catch (error) {
      console.error('❌ Error ending voice session:', error);
      // Clear session anyway
      this.currentSession = null;
    }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): VoiceSession | null {
    return this.currentSession;
  }

  /**
   * Get function declarations for Gemini Live API
   */
  getFunctionDeclarations(): any[] {
    return this.currentSession?.function_declarations || [];
  }

  /**
   * Get system prompt for Gemini Live API
   */
  getSystemPrompt(): string {
    return this.currentSession?.system_prompt || '';
  }

  /**
   * Get authentication token from Supabase
   */
  /**
   * Handle memory saving function call locally
   */
  private async handleMemorySaving(args: any): Promise<FunctionCallResult> {
    try {
      console.log('🧠 Voice: AI is saving memory:', args);

      if (!this.currentSession?.agent_id) {
        throw new Error('No agent ID available for memory saving');
      }

      // Validate required arguments
      if (!args.information || typeof args.information !== 'string') {
        throw new Error('Information parameter is required and must be a string');
      }

      // Save the memory using the memory service
      const memoryData = {
        information: args.information,
        topic: args.topic || undefined,
        importance: args.importance || 'medium',
        type: args.type || 'insight'
      };

      await memoryService.saveMemoryFromAI(this.currentSession.agent_id, memoryData);

      return {
        success: true,
        function: 'save_to_memory',
        result: `Successfully saved to memory: "${args.information.substring(0, 50)}${args.information.length > 50 ? '...' : ''}"`
      };
    } catch (error) {
      console.error('❌ Error saving memory:', error);
      return {
        success: false,
        function: 'save_to_memory',
        error: `Failed to save memory: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle paper to notes saving function call locally
   */
  private async handlePaperToNotesSaving(args: any): Promise<FunctionCallResult> {
    try {
      console.log('📝 Voice: AI is saving paper to notes:', args);

      if (!this.currentSession?.agent_id) {
        throw new Error('No agent ID available for saving paper to notes');
      }

      // Validate required arguments
      if (!args.title || typeof args.title !== 'string') {
        throw new Error('Title parameter is required and must be a string');
      }

      if (!args.content || typeof args.content !== 'string') {
        throw new Error('Content parameter is required and must be a string');
      }

      // Save the paper as a note using the memory service
      const noteData = {
        agent_id: this.currentSession.agent_id,
        title: args.title,
        content: args.content,
        note_type: 'voice_call' as const
      };

      const savedNote = await memoryService.createPaperNote(noteData);

      // Trigger UI refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent('paperSavedToNotes', { 
        detail: { note: savedNote } 
      }));

      return {
        success: true,
        function: 'save_paper_to_notes',
        result: `Successfully saved paper "${args.title}" to notes`
      };
    } catch (error) {
      console.error('❌ Error saving paper to notes:', error);
      return {
        success: false,
        function: 'save_paper_to_notes',
        error: `Failed to save paper to notes: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle past conversations search function call locally
   */
  private async handlePastConversationsSearch(args: any): Promise<FunctionCallResult> {
    try {
      console.log('🔍 Voice: AI is searching past conversations:', args);

      if (!this.currentSession?.agent_id) {
        throw new Error('No agent ID available for searching past conversations');
      }

      // Validate required arguments
      if (!args.query || typeof args.query !== 'string') {
        throw new Error('Query parameter is required and must be a string');
      }

      const limit = Math.max(1, Math.min(10, args.limit || 5));

      // Import conversation history service dynamically to avoid circular dependencies
      const { conversationHistoryService } = await import('../services/conversationHistoryService');

      // Search for past conversations
      const sessions = await conversationHistoryService.searchAgentMessages(this.currentSession.agent_id, args.query);

      // Limit results
      const limitedSessions = sessions.slice(0, limit);

      // Create conversation previews
      const previews = await conversationHistoryService.createConversationPreviews(limitedSessions, args.query);

      // Format results for AI consumption
      const formattedResults = previews.map(preview => ({
        conversation_id: preview.id,
        title: preview.title,
        date: preview.lastMessageAt.toISOString(),
        summary: preview.preview,
        relevant_excerpt: preview.searchMatch?.text || preview.preview,
        message_count: preview.messageCount,
        conversation_type: preview.conversationType
      }));

      const result = {
        query: args.query,
        results_count: formattedResults.length,
        conversations: formattedResults,
        message: formattedResults.length > 0 
          ? `Found ${formattedResults.length} relevant past conversation${formattedResults.length !== 1 ? 's' : ''}.`
          : 'No relevant past conversations found for this query.'
      };

      return {
        success: true,
        function: 'search_past_conversations',
        result
      };
    } catch (error) {
      console.error('❌ Error searching past conversations:', error);
      return {
        success: false,
        function: 'search_past_conversations',
        error: `Failed to search past conversations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }


  private getAuthToken(): string {
    try {
      // Get the Supabase session from localStorage
      const supabaseAuth = localStorage.getItem('sb-lixfceaaekvltvroqxqj-auth-token');
      if (supabaseAuth) {
        const authData = JSON.parse(supabaseAuth);
        if (authData?.access_token) {
          return authData.access_token;
        }
      }
      
      // Fallback: try to get from other possible storage locations
      const authToken = localStorage.getItem('supabase.auth.token') || 
                       sessionStorage.getItem('supabase.auth.token');
      
      if (authToken) {
        const parsed = JSON.parse(authToken);
        return parsed?.access_token || '';
      }
      
      return '';
    } catch (error) {
      console.warn('Error getting auth token:', error);
      return '';
    }
  }

  /**
   * Get conversation transcript from backend session for memory extraction
   */
  async getConversationTranscript(): Promise<{ messages: any[], metadata: any }> {
    try {
      if (!this.currentSession) {
        throw new Error('No active voice session');
      }

      console.log(`📝 Getting conversation transcript for session: ${this.currentSession.session_id}`);

      const authToken = this.getAuthToken();
      let response: Response;

      if (authToken) {
        response = await fetch(`${this.baseUrl}/api/v1/voice/session/${this.currentSession.session_id}/transcript`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      } else {
        // Fallback to development endpoint
        response = await fetch(`${this.baseUrl}/api/v1/voice/dev/session/${this.currentSession.session_id}/transcript`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to get conversation transcript: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to get conversation transcript');
      }

      console.log(`📋 Retrieved ${result.messages?.length || 0} messages from voice session`);
      return {
        messages: result.messages || [],
        metadata: result.metadata || {}
      };

    } catch (error) {
      console.error('❌ Error getting conversation transcript:', error);
      // Return empty transcript rather than failing completely
      return { messages: [], metadata: {} };
    }
  }
}

export const voiceApiService = new VoiceApiService();