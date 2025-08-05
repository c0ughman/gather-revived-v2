/**
 * Enhanced Document Service
 * 
 * This service provides a unified interface for document processing that can use either:
 * 1. Frontend processing (original TypeScript implementation)
 * 2. Python backend processing (new FastAPI implementation)
 * 
 * The service automatically chooses the best option based on configuration and availability.
 */

import { DocumentInfo } from '../types/documents';
import { documentService } from './documentService';
import { pythonApiService } from '../../../core/services/pythonApiService';

class EnhancedDocumentService {
  private usePythonBackend: boolean;
  private pythonBackendAvailable: boolean = false;

  constructor() {
    this.usePythonBackend = import.meta.env.VITE_USE_PYTHON_BACKEND === 'true';
    
    // Check Python backend availability on initialization
    this.checkPythonBackendAvailability();
    
    console.log('📄 Enhanced Document Service initialized');
    console.log(`🔧 Use Python Backend: ${this.usePythonBackend}`);
  }

  /**
   * Process a single document with automatic backend selection
   */
  async processFile(file: File): Promise<DocumentInfo> {
    const backend = await this.selectBackend();
    
    console.log(`🔍 Processing ${file.name} using ${backend} backend`);

    try {
      if (backend === 'python') {
        return await pythonApiService.processDocument(file);
      } else {
        return await documentService.processFile(file);
      }
    } catch (error) {
      console.error(`❌ ${backend} backend failed, trying fallback`);
      
      // Fallback to other backend if available
      if (backend === 'python' && this.canUseFrontend()) {
        console.log('🔄 Falling back to frontend processing');
        return await documentService.processFile(file);
      } else if (backend === 'frontend' && this.pythonBackendAvailable) {
        console.log('🔄 Falling back to Python backend');
        return await pythonApiService.processDocument(file);
      }
      
      throw error;
    }
  }

  /**
   * Process multiple documents with optimized backend selection
   */
  async processMultipleFiles(files: File[]): Promise<{
    results: Array<{ filename: string; success: boolean; document?: DocumentInfo; error?: string }>;
    errors: string[];
  }> {
    const backend = await this.selectBackend();
    
    console.log(`🔍 Processing ${files.length} files using ${backend} backend`);

    if (backend === 'python' && files.length > 1) {
      // Use Python backend's bulk processing for multiple files
      try {
        return await pythonApiService.processMultipleDocuments(files);
      } catch (error) {
        console.error('❌ Python bulk processing failed, falling back to individual processing');
      }
    }

    // Process files individually (frontend or as fallback)
    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const document = await this.processFile(file);
        results.push({
          filename: file.name,
          success: true,
          document
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`${file.name}: ${errorMessage}`);
        results.push({
          filename: file.name,
          success: false,
          error: errorMessage
        });
      }
    }

    return { results, errors };
  }

  /**
   * Get supported file types (combines both backends)
   */
  async getSupportedTypes(): Promise<{
    extensions: string[];
    maxFileSize: number;
    backends: string[];
  }> {
    let extensions = documentService.getSupportedExtensions();
    let maxFileSize = documentService.getMaxFileSize();
    const backends = ['frontend'];

    // If Python backend is available, get its supported types too
    if (this.pythonBackendAvailable) {
      try {
        const pythonTypes = await pythonApiService.getSupportedTypes();
        
        // Combine extensions (remove duplicates)
        const combinedExtensions = [...new Set([...extensions, ...pythonTypes.supported_extensions])];
        extensions = combinedExtensions;
        
        // Use the larger max file size
        maxFileSize = Math.max(maxFileSize, pythonTypes.max_file_size_mb * 1024 * 1024);
        
        backends.push('python');
      } catch (error) {
        console.warn('Failed to get Python backend supported types:', error);
      }
    }

    return {
      extensions,
      maxFileSize,
      backends
    };
  }

  /**
   * Format document for AI consumption
   */
  formatDocumentForAI(document: DocumentInfo): string {
    return documentService.formatDocumentForAI(document);
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
          'PDF text extraction (PDF.js)',
          'Word document processing (Mammoth.js)',
          'PowerPoint extraction (PizZip)',
          'Excel processing (XLSX)',
          'Text file processing'
        ]
      },
      python: {
        available: this.pythonBackendAvailable,
        features: [
          'PDF text extraction (PyPDF2)',
          'Word document processing (python-docx)',
          'PowerPoint extraction (python-pptx)',
          'Excel processing (openpyxl)',
          'Text file processing',
          'Bulk document processing',
          'Better performance for large files'
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
    console.log(`🔄 Backend status refreshed - Python available: ${this.pythonBackendAvailable}`);
  }

  /**
   * Select the best backend for processing
   */
  private async selectBackend(): Promise<'python' | 'frontend'> {
    // If Python backend is preferred and available, use it
    if (this.usePythonBackend && this.pythonBackendAvailable) {
      return 'python';
    }
    
    // If Python backend is available but not preferred, still use it for large operations
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
}

export const enhancedDocumentService = new EnhancedDocumentService();