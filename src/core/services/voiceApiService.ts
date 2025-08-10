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

interface VoiceSession {
  session_id: string;
  ephemeral_token: string;
  function_declarations: any[];
  system_prompt: string;
  expires_in: number;
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

      const requestBody = {
        id: contact.id,
        name: contact.name,
        description: contact.description,
        integrations: contact.integrations,
        documents: contact.documents
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
}

export const voiceApiService = new VoiceApiService();