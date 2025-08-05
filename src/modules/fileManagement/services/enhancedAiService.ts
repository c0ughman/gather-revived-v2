/**
 * Enhanced AI Service
 * 
 * This service provides a unified interface for AI generation that can use either:
 * 1. Frontend processing (original TypeScript implementation)
 * 2. Python backend processing (new FastAPI implementation)
 * 
 * The service automatically chooses the best option based on configuration and availability.
 */

import { AIContact, Message } from '../../../core/types/types';
import { DocumentInfo } from '../types/documents';
import { geminiService } from './geminiService';
import { pythonApiService } from '../../../core/services/pythonApiService';

class EnhancedAiService {
  private usePythonBackend: boolean;
  private pythonBackendAvailable: boolean = false;

  constructor() {
    this.usePythonBackend = import.meta.env.VITE_USE_PYTHON_BACKEND === 'true';
    
    // Check Python backend availability on initialization
    this.checkPythonBackendAvailability();
    
    console.log('🤖 Enhanced AI Service initialized');
    console.log(`🔧 Use Python Backend: ${this.usePythonBackend}`);
  }

  /**
   * Generate AI response with automatic backend selection
   */
  async generateResponse(
    contact: AIContact,
    userMessage: string,
    chatHistory: Message[],
    conversationDocuments: DocumentInfo[] = []
  ): Promise<string> {
    const backend = await this.selectBackend();
    
    console.log(`🤖 Generating response using ${backend} backend for ${contact.name}`);

    try {
      if (backend === 'python') {
        return await pythonApiService.generateAIResponse(
          contact,
          userMessage,
          chatHistory,
          conversationDocuments
        );
      } else {
        return await geminiService.generateResponse(
          contact,
          userMessage,
          chatHistory,
          conversationDocuments
        );
      }
    } catch (error) {
      console.error(`❌ ${backend} backend failed for AI generation, trying fallback`);
      
      // Fallback to other backend if available
      if (backend === 'python' && this.canUseFrontend()) {
        console.log('🔄 Falling back to frontend AI generation');
        return await geminiService.generateResponse(
          contact,
          userMessage,
          chatHistory,
          conversationDocuments
        );
      } else if (backend === 'frontend' && this.pythonBackendAvailable) {
        console.log('🔄 Falling back to Python backend');
        return await pythonApiService.generateAIResponse(
          contact,
          userMessage,
          chatHistory,
          conversationDocuments
        );
      }
      
      throw error;
    }
  }

  /**
   * Summarize document with automatic backend selection
   */
  async summarizeDocument(documentContent: string, filename: string): Promise<string> {
    const backend = await this.selectBackend();
    
    console.log(`📄 Summarizing document using ${backend} backend: ${filename}`);

    try {
      if (backend === 'python') {
        return await pythonApiService.summarizeDocument(documentContent, filename);
      } else {
        // Fallback: Create a simple summary without external API call
        return this.createSimpleSummary(documentContent, filename);
      }
    } catch (error) {
      console.error(`❌ ${backend} backend failed for document summarization, trying fallback`);
      
      // Fallback to other backend if available
      if (backend === 'python' && this.canUseFrontend()) {
        console.log('🔄 Falling back to simple summarization');
        return this.createSimpleSummary(documentContent, filename);
      } else if (backend === 'frontend' && this.pythonBackendAvailable) {
        console.log('🔄 Falling back to Python backend');
        return await pythonApiService.summarizeDocument(documentContent, filename);
      }
      
      throw error;
    }
  }

  /**
   * Get service status and capabilities
   */
  async getServiceStatus(): Promise<{
    frontend: { available: boolean; features: string[] };
    python: { available: boolean; features: string[] };
    selected: string;
    fallback: boolean;
  }> {
    const frontendAvailable = this.canUseFrontend();
    await this.checkPythonBackendAvailability();

    return {
      frontend: {
        available: frontendAvailable,
        features: [
          'Google Gemini API integration',
          'Response generation',
          'Document summarization',
          'Chat history processing'
        ]
      },
      python: {
        available: this.pythonBackendAvailable,
        features: [
          'Google Gemini API integration',
          'Response generation with better performance',
          'Document summarization',
          'Chat history processing',
          'Advanced prompt optimization',
          'Better error handling'
        ]
      },
      selected: await this.selectBackend(),
      fallback: frontendAvailable && this.pythonBackendAvailable
    };
  }

  /**
   * Force refresh of Python backend availability
   */
  async refreshBackendStatus(): Promise<void> {
    await this.checkPythonBackendAvailability();
    console.log(`🔄 AI backend status refreshed - Python available: ${this.pythonBackendAvailable}`);
  }

  /**
   * Select the best backend for AI processing
   */
  private async selectBackend(): Promise<'python' | 'frontend'> {
    // If Python backend is preferred and available, use it
    if (this.usePythonBackend && this.pythonBackendAvailable) {
      return 'python';
    }
    
    // If Python backend is available but not preferred, still use it for better performance
    if (this.pythonBackendAvailable && !this.canUseFrontend()) {
      return 'python';
    }
    
    // Default to frontend
    return 'frontend';
  }

  /**
   * Check if Python backend is available
   */
  private async checkPythonBackendAvailability(): Promise<void> {
    try {
      this.pythonBackendAvailable = await pythonApiService.isAvailable();
    } catch (error) {
      this.pythonBackendAvailable = false;
    }
  }

  /**
   * Check if frontend processing is available
   */
  private canUseFrontend(): boolean {
    // Frontend is always available (unless we're in a worker context or similar)
    return typeof window !== 'undefined';
  }

  /**
   * Create a simple document summary without external API calls
   * This serves as a fallback when Python backend is unavailable
   */
  private createSimpleSummary(documentContent: string, filename: string): string {
    const wordCount = documentContent.split(/\s+/).filter(word => word.trim()).length;
    const charCount = documentContent.length;
    const lineCount = documentContent.split('\n').length;
    
    // Extract first few sentences as preview
    const sentences = documentContent.match(/[^\.!?]+[\.!?]+/g) || [];
    const preview = sentences.slice(0, 2).join(' ').substring(0, 200);
    
    return `📁 Document: ${filename}\n` +
           `📊 Statistics: ${wordCount} words, ${charCount} characters, ${lineCount} lines\n` +
           `📖 Preview: ${preview}${preview.length === 200 ? '...' : ''}\n` +
           `⚠️ Simple fallback summary (Python backend unavailable)`;
  }
}

export const enhancedAiService = new EnhancedAiService();