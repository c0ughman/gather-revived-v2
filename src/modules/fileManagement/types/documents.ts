export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  content: string;
  summary?: string;
  extractedText?: string; // For binary files like PDF, DOCX
  // Layered context fields
  layer1_summary?: string; // ~500 tokens - gestalt overview
  layer1_word_bank?: string; // ~200 tokens - entities, keywords
  layer2_summary?: string; // ~2000 tokens - comprehensive facts OR full content if ≤2000 tokens
  layer3_full_text?: string; // Full document text (only for >2000 token docs)
  layered_processing_complete?: boolean; // Track if layered processing is done
  estimated_tokens?: number; // Estimated token count for processing decisions
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    slideCount?: number;
    author?: string;
    title?: string;
    extractionQuality?: 'excellent' | 'good' | 'partial' | 'poor';
    extractionSuccess?: boolean;
    conversation_document?: boolean; // Mark as conversation document
    uploaded_in_conversation?: boolean;
    [key: string]: any; // Allow additional metadata properties
  };
}

export interface FileProcessingResult {
  text: string;
  metadata: any;
}

export interface FileUploadConfig {
  maxFileSize: number;
  supportedTypes: string[];
  supportedExtensions: string[];
} 