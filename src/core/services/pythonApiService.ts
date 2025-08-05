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
    this.baseUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8001';
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
  ): Promise<string> {
    try {
      console.log(`🤖 Generating AI response via Python backend for ${contact.name}`);

      const requestBody = {
        contact: {
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

      console.log(`✅ AI response generated (${result.metadata.response_length} characters)`);
      return result.response;

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
   * Check if a feature should use Python backend
   */
  shouldUsePythonBackend(feature: 'documents' | 'ai'): boolean {
    const usePython = import.meta.env.VITE_USE_PYTHON_BACKEND === 'true';
    
    // You can customize this logic based on feature flags, user preferences, etc.
    return usePython;
  }
}

export const pythonApiService = new PythonApiService();