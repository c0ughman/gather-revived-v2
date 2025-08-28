/**
 * Python API Service
 * 
 * Service for interacting with the Python FastAPI backend for performance-heavy operations.
 * This service handles document processing and AI generation that was moved from frontend to backend.
 */

import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { AIContact, Message } from '../types/types';

class PythonApiService {
  private baseUrl: string;

  constructor() {
    // Use environment variable to determine Python backend URL
    this.baseUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';
    console.log('🐍 Python API Service initialized:', this.baseUrl);
  }

  /**
   * Check if Python backend is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.warn('Python backend not available:', error);
      return false;
    }
  }

  /**
   * Process document using Python backend
   * This replaces the frontend documentService.processFile() for better performance
   */
  async processDocument(file: File): Promise<DocumentInfo> {
    try {
      console.log(`🔍 Processing document via Python backend: ${file.name}`);

      const formData = new FormData();
      formData.append('file', file);

      const authToken = this.getAuthToken();
      let response: Response;

      // Try authenticated endpoint first
      if (authToken) {
        response = await fetch(`${this.baseUrl}/api/v1/documents/process`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      } else {
        // Fallback to development endpoint (no auth required)
        console.log('🧪 Using development endpoint (no auth token available)');
        response = await fetch(`${this.baseUrl}/api/v1/documents/dev/process`, {
          method: 'POST',
          body: formData
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Document processing failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Document processing failed');
      }

      // Convert Python response to DocumentInfo format
      const documentInfo = this.convertToDocumentInfo(result.document);
      
      console.log(`✅ Document processed successfully: ${file.name}`);
      return documentInfo;

    } catch (error) {
      console.error(`❌ Error processing document ${file.name}:`, error);
      throw error;
    }
  }

  /**
   * Process multiple documents at once
   */
  async processMultipleDocuments(files: File[]): Promise<{
    results: Array<{ filename: string; success: boolean; document?: DocumentInfo; error?: string }>;
    errors: string[];
  }> {
    try {
      console.log(`🔍 Processing ${files.length} documents via Python backend`);

      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const authToken = this.getAuthToken();
      let response: Response;

      // Try authenticated endpoint first
      if (authToken) {
        response = await fetch(`${this.baseUrl}/api/v1/documents/bulk-process`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      } else {
        // Fallback to development endpoint (no auth required)
        console.log('🧪 Using development bulk endpoint (no auth token available)');
        response = await fetch(`${this.baseUrl}/api/v1/documents/dev/bulk-process`, {
          method: 'POST',
          body: formData
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Bulk processing failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Convert results to DocumentInfo format
      const convertedResults = result.results.map((item: any) => ({
        filename: item.filename,
        success: item.success,
        document: item.document ? this.convertToDocumentInfo(item.document) : undefined,
        error: item.error
      }));

      console.log(`✅ Processed ${result.processed_count}/${result.total_count} documents`);
      
      return {
        results: convertedResults,
        errors: result.errors || []
      };

    } catch (error) {
      console.error('❌ Error in bulk document processing:', error);
      throw error;
    }
  }

  /**
   * Generate AI response using Python backend
   * This replaces the frontend geminiService.generateResponse() for better performance
   */
  async generateAIResponse(
    contact: AIContact,
    userMessage: string,
    chatHistory: Message[],
    conversationDocuments: DocumentInfo[] = []
  ): Promise<{
    response: string;
    compactedChatHistory?: Message[];
    wasCompacted?: boolean;
  }> {
    try {
      console.log(`🤖 Generating AI response via Python backend for ${contact.name}`);

      const requestBody = {
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

      const response = await fetch(`${this.baseUrl}/api/v1/ai/generate-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `AI generation failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'AI response generation failed');
      }

      // Log token analysis to frontend console for visibility
      const tokenAnalysis = result.metadata?.token_analysis;
      const compactingInfo = result.metadata?.conversation_compacting;
      
      if (tokenAnalysis) {
        const compactingEmoji = compactingInfo?.was_compacted ? '🗜️' : '📊';
        console.log(`${compactingEmoji} Conversation Token Analysis:`, {
          'Total Tokens': tokenAnalysis.total_tokens || 0,
          'Max Tokens': tokenAnalysis.max_tokens || 0,
          'Usage': `${Math.round(tokenAnalysis.usage_percentage || 0)}%`,
          'Messages': tokenAnalysis.message_count || 0,
          'Compacted': compactingInfo?.was_compacted || false,
          'Messages After Compacting': compactingInfo?.compacted_message_count || tokenAnalysis.message_count || 0
        });

        // Add token breakdown for summary vs chat messages
        if (result.compacted_chat_history) {
          this.logTokenBreakdown(result.compacted_chat_history);
        } else {
          // Use the original chat history for breakdown
          this.logTokenBreakdown(chatHistory);
        }

        // Additional log for compacting events
        if (compactingInfo?.was_compacted) {
          console.log(`🗜️ Conversation was compacted: ${compactingInfo.original_message_count} → ${compactingInfo.compacted_message_count} messages`);
        }
      }

      console.log(`✅ AI response generated (${result.metadata.response_length} characters)`);
      
      // Return both response and compacted chat history if available
      const wasCompacted = compactingInfo?.was_compacted || false;
      let compactedChatHistory: Message[] | undefined;
      
      if (wasCompacted && result.compacted_chat_history) {
        // Convert backend format to frontend Message format
        compactedChatHistory = result.compacted_chat_history.map((msg: any) => ({
          id: msg.id || Date.now() + Math.random(), // Generate ID if not present
          sender: msg.sender,
          content: msg.content,
          timestamp: msg.timestamp || new Date().toISOString()
        }));
        
        console.log(`🗜️ Using compacted chat history: ${compactedChatHistory?.length} messages`);
      }
      
      return {
        response: result.response,
        compactedChatHistory,
        wasCompacted
      };

    } catch (error) {
      console.error('❌ Error generating AI response:', error);
      throw error;
    }
  }

  /**
   * Summarize document using AI
   */
  async summarizeDocument(documentContent: string, filename: string): Promise<string> {
    try {
      console.log(`📄 Summarizing document via Python backend: ${filename}`);

      const response = await fetch(`${this.baseUrl}/api/v1/ai/summarize-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          document_content: documentContent,
          filename: filename
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Document summarization failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Document summarization failed');
      }

      console.log(`✅ Document summarized: ${filename}`);
      return result.summary;

    } catch (error) {
      console.error(`❌ Error summarizing document ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Get supported document types from Python backend
   */
  async getSupportedTypes(): Promise<{
    supported_extensions: string[];
    text_file_types: string[];
    binary_file_types: string[];
    max_file_size_mb: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/documents/supported-types`);

      if (!response.ok) {
        throw new Error(`Failed to get supported types: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Error getting supported types:', error);
      throw error;
    }
  }

  /**
   * Get Python backend health status
   */
  async getHealthStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/test/stage2-status`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Python backend health check failed:', error);
      throw error;
    }
  }

  /**
   * Get memory context for an agent from backend database service
   */
  async getAgentMemoryContext(agentId: string): Promise<string | null> {
    try {
      console.log(`🧠 Getting memory context from backend for agent: ${agentId}`);

      const response = await fetch(`${this.baseUrl}/api/v1/database/agents/${agentId}/memory-context`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Memory context fetch failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Memory context fetch failed');
      }

      const memoryContext = result.data?.memory_context || null;
      console.log(`✅ Memory context retrieved: ${memoryContext ? 'has content' : 'empty'}`);
      
      return memoryContext;

    } catch (error) {
      console.error(`❌ Error getting memory context for ${agentId}:`, error);
      // Return null instead of throwing to gracefully handle memory fetch failures
      return null;
    }
  }

  /**
   * Log token breakdown between summary and chat messages
   */
  private logTokenBreakdown(chatHistory: any[]): void {
    try {
      let summaryTokens = 0;
      let chatTokens = 0;
      
      chatHistory.forEach(msg => {
        const content = msg.content || '';
        // Rough token estimation: ~4 characters per token
        const estimatedTokens = Math.ceil(content.length / 4);
        
        if (msg.sender === 'summary' && content.startsWith('[SUMMARY]')) {
          summaryTokens += estimatedTokens;
        } else {
          chatTokens += estimatedTokens;
        }
      });
      
      const totalTokens = summaryTokens + chatTokens;
      if (totalTokens > 0) {
        const summaryPercentage = (summaryTokens / totalTokens) * 100;
        const chatPercentage = (chatTokens / totalTokens) * 100;
        console.log(`📊 Token breakdown: ${summaryTokens} summary tokens (${summaryPercentage.toFixed(1)}%) + ${chatTokens} chat tokens (${chatPercentage.toFixed(1)}%)`);
      } else {
        console.log(`📊 Token breakdown: 0 summary tokens + ${chatTokens} chat tokens (100.0%)`);
      }
    } catch (error) {
      console.debug('Token breakdown calculation failed:', error);
    }
  }

  /**
   * Convert Python backend document format to frontend DocumentInfo format
   */
  private convertToDocumentInfo(pythonDoc: any): DocumentInfo {
    return {
      id: pythonDoc.id,
      name: pythonDoc.name,
      type: pythonDoc.type,
      size: pythonDoc.size,
      uploadedAt: new Date(pythonDoc.uploaded_at),
      content: pythonDoc.content,
      extractedText: pythonDoc.extracted_text,
      summary: pythonDoc.summary,
      metadata: pythonDoc.metadata
    };
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

  /**
   * Update base URL if needed
   */
  updateBaseUrl(newUrl: string): void {
    this.baseUrl = newUrl;
    console.log('🔄 Python API Service URL updated:', this.baseUrl);
  }
}

export const pythonApiService = new PythonApiService();