import { DocumentInfo } from '../types/documents';

class DocumentContextService {
  /**
   * Prepare context from documents for AI
   */
  async prepareContext(documents: DocumentInfo[]): Promise<string> {
    if (!documents || documents.length === 0) {
      return '';
    }

    let context = 'Here is relevant information from documents:\n\n';
    
    // Process each document and add to context
    for (const doc of documents) {
      context += this.formatDocumentForContext(doc);
      context += '\n\n';
    }

    return context;
  }

  /**
   * Format a document for AI context
   */
  private formatDocumentForContext(doc: DocumentInfo): string {
    let formattedDoc = `--- DOCUMENT: ${doc.name} ---\n`;
    
    // Add metadata if available
    if (doc.metadata) {
      if (doc.metadata.type) {
        formattedDoc += `Type: ${doc.metadata.type}\n`;
      }
      
      if (doc.metadata.pageCount) {
        formattedDoc += `Pages: ${doc.metadata.pageCount}\n`;
      }
      
      if (doc.metadata.wordCount) {
        formattedDoc += `Words: ${doc.metadata.wordCount}\n`;
      }
    }
    
    // Add content
    formattedDoc += '\nContent:\n';
    formattedDoc += doc.extractedText || doc.content || 'No content available';
    
    return formattedDoc;
  }

  /**
   * Get agent document context
   */
  async getAgentDocumentContext(agentId: string): Promise<{
    permanentDocuments: DocumentInfo[];
    conversationDocuments: DocumentInfo[];
    allDocuments: DocumentInfo[];
    formattedContext: string;
  }> {
    // This is a placeholder implementation
    return {
      permanentDocuments: [],
      conversationDocuments: [],
      allDocuments: [],
      formattedContext: ''
    };
  }
}

export const documentContextService = new DocumentContextService();