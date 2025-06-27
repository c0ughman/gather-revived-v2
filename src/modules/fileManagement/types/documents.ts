export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  content: string;
  summary?: string;
  extractedText?: string; // For binary files like PDF, DOCX
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