/**
 * AI Service - Backend Only
 * 
 * This service provides AI generation using only the Python backend.
 * All frontend fallbacks have been removed as requested.
 */

import { AIContact, Message } from '../../../core/types/types';
import { DocumentInfo } from '../types/documents';
import { pythonApiService } from '../../../core/services/pythonApiService';

class EnhancedAiService {
  private backendAvailable: boolean = false;

  constructor() {
    // Check Python backend availability on initialization
    this.checkBackendAvailability();
    console.log('🤖 AI Service initialized (Backend-only)');
  }

  /**
   * Generate AI response using Python backend only
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
      return await pythonApiService.generateAIResponse(
        contact,
        userMessage,
        chatHistory,
        conversationDocuments
      );
    } catch (error) {
      console.error(`❌ Backend failed for AI generation:`, error);
      // Mark backend as unavailable and re-throw error
      this.backendAvailable = false;
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
}

export const enhancedAiService = new EnhancedAiService();