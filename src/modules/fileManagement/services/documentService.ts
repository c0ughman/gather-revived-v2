import { DocumentInfo } from '../types/documents';

// LEGACY DOCUMENT SERVICE
// Heavy processing has been moved to Python backend
// This service now only provides utility methods for other services

class DocumentService {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly TEXT_FILE_TYPES = [
    'text/plain',
    'text/csv',
    'application/json',
    'text/markdown',
    'text/html',
    'application/javascript',
    'text/css',
    'application/xml',
    'text/xml',
    'application/yaml',
    'text/yaml'
  ];
  
  private static readonly BINARY_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];

  async processFile(file: File): Promise<DocumentInfo> {
    // ⚠️ LEGACY METHOD - Heavy processing moved to Python backend
    // Use enhancedDocumentService instead for actual document processing
    console.error('❌ Using legacy documentService.processFile() - should use enhancedDocumentService.processFile()');
    throw new Error(
      `⚠️ LEGACY SERVICE: Document processing has been moved to Python backend.\n` +
      `Please use 'enhancedDocumentService.processFile()' instead of 'documentService.processFile()'.\n` +
      `This ensures better performance through the Python backend with fallback support.`
    );
  }

  // ⚠️ REMOVED: Heavy processing methods moved to Python backend
  // The following methods have been moved to backend/app/services/document_service.py:
  // - extractTextContent() → Direct text reading with encoding detection
  // - extractBinaryContent() → Binary file processing coordination  
  // - extractPDFContent() → PyPDF2 processing (replaces PDF.js)
  // - extractWordContent() → python-docx processing (replaces mammoth.js)
  // - extractPowerPointContent() → python-pptx processing (replaces pizzip)
  // - extractExcelContent() → openpyxl processing (replaces xlsx library)
  // - All heavy file processing logic and npm dependencies

  // UTILITY METHODS - Still used by other services
  
  private isTextFile(mimeType: string, fileName: string): boolean {
    if (DocumentService.TEXT_FILE_TYPES.includes(mimeType)) {
      return true;
    }
    
    // Check by extension as fallback
    const extension = fileName.toLowerCase().split('.').pop();
    const textExtensions = ['txt', 'md', 'json', 'csv', 'html', 'htm', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'xml', 'yaml', 'yml'];
    return textExtensions.includes(extension || '');
  }

  private isBinaryFile(mimeType: string, fileName: string): boolean {
    if (DocumentService.BINARY_FILE_TYPES.includes(mimeType)) {
      return true;
    }
    
    // Check by extension as fallback
    const extension = fileName.toLowerCase().split('.').pop();
    const binaryExtensions = ['pdf', 'docx', 'pptx', 'xlsx', 'xls'];
    return binaryExtensions.includes(extension || '');
  }

  private isSupportedType(mimeType: string, fileName: string): boolean {
    return this.isTextFile(mimeType, fileName) || this.isBinaryFile(mimeType, fileName);
  }

  private getTypeFromExtension(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    const typeMap: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'csv': 'text/csv'
    };
    return typeMap[extension || ''] || 'application/octet-stream';
  }

  formatDocumentForAI(document: DocumentInfo): string {
    let formattedDoc = `📄 DOCUMENT: ${document.name}
📋 Type: ${document.type}
📅 Uploaded: ${document.uploadedAt.toLocaleString()}
📊 Summary: ${document.summary}`;

    formattedDoc += `\n\n📖 CONTENT:\n${'-'.repeat(80)}\n${document.extractedText || document.content}`;
    formattedDoc += `\n${'-'.repeat(80)}\n📄 END OF DOCUMENT: ${document.name}`;

    return formattedDoc;
  }

  getSupportedTypes(): string[] {
    return [...DocumentService.TEXT_FILE_TYPES, ...DocumentService.BINARY_FILE_TYPES];
  }

  getMaxFileSize(): number {
    return DocumentService.MAX_FILE_SIZE;
  }

  getSupportedExtensions(): string[] {
    return [
      // Text files
      'txt', 'md', 'json', 'csv', 'html', 'htm', 'js', 'ts', 'jsx', 'tsx',
      'css', 'scss', 'sass', 'xml', 'yaml', 'yml', 'log', 'sql', 'py', 'java',
      'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'sh', 'bat', 'ps1', 'r',
      // Binary files  
      'pdf', 'docx', 'pptx', 'xlsx', 'xls'
    ];
  }
}

export const documentService = new DocumentService();