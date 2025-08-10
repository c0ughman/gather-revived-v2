import { AIContact } from '../../../core/types/types';
import { DocumentInfo } from '../types/documents';
import { supabaseService } from '../../database';

export interface AgentDocumentContext {
  permanentDocuments: DocumentInfo[];
  conversationDocuments: DocumentInfo[];
  allDocuments: DocumentInfo[];
  formattedContext: string;
}

class DocumentContextService {
  /**
   * Get all document context for an agent from Supabase
   */
  async getAgentDocumentContext(contact: AIContact): Promise<AgentDocumentContext> {
    try {
      console.log(`📚 Loading document context for agent: ${contact.name}`);
      
      // Get documents from Supabase
      const { permanentDocuments, conversationDocuments } = await supabaseService.getAllAgentContext(contact.id);
      
      // Combine all documents
      const allDocuments = [...permanentDocuments, ...conversationDocuments];
      
      // Build formatted context for AI
      const formattedContext = this.buildDocumentContext(contact, allDocuments);
      
      console.log(`✅ Loaded ${permanentDocuments.length} permanent + ${conversationDocuments.length} conversation documents`);
      
      return {
        permanentDocuments,
        conversationDocuments,
        allDocuments,
        formattedContext
      };
    } catch (error) {
      console.error(`❌ Failed to load document context for ${contact.name}:`, error);
      
      // Fallback to contact.documents if Supabase fails
      const fallbackDocuments = contact.documents || [];
      const formattedContext = this.buildDocumentContext(contact, fallbackDocuments);
      
      return {
        permanentDocuments: fallbackDocuments,
        conversationDocuments: [],
        allDocuments: fallbackDocuments,
        formattedContext
      };
    }
  }

  /**
   * Save a conversation document to Supabase
   */
  async saveConversationDocument(contact: AIContact, document: DocumentInfo): Promise<string> {
    try {
      console.log(`💾 Saving conversation document: ${document.name} for ${contact.name}`);
      const documentId = await supabaseService.saveConversationDocument(contact.id, document);
      console.log(`✅ Saved conversation document with ID: ${documentId}`);
      return documentId;
    } catch (error) {
      console.error(`❌ Failed to save conversation document:`, error);
      throw error;
    }
  }

  /**
   * Build formatted document context for AI
   */
  private buildDocumentContext(contact: AIContact, documents: DocumentInfo[]): string {
    let context = `You are ${contact.name}. ${contact.description}`;
    
    if (documents.length > 0) {
      context += '\n\n=== YOUR KNOWLEDGE BASE ===\n';
      context += 'You have access to the following documents. Use this information to provide accurate and detailed responses:\n\n';
      
      // Separate permanent and conversation documents
      const permanentDocs = documents.filter(doc => !doc.metadata?.conversation_document);
      const conversationDocs = documents.filter(doc => doc.metadata?.conversation_document);
      
      if (permanentDocs.length > 0) {
        context += '📚 PERMANENT KNOWLEDGE:\n';
        permanentDocs.forEach(doc => {
          context += this.formatDocumentForAI(doc) + '\n\n';
        });
      }
      
      if (conversationDocs.length > 0) {
        context += '💬 CONVERSATION DOCUMENTS:\n';
        conversationDocs.forEach(doc => {
          context += this.formatDocumentForAI(doc) + '\n\n';
        });
      }
      
      context += 'This is your knowledge base. Reference this information throughout conversations to provide accurate responses.';
    }

    return context;
  }

  /**
   * Get real-time document updates for a contact
   */
  async refreshDocumentContext(contact: AIContact): Promise<AgentDocumentContext> {
    console.log(`🔄 Refreshing document context for ${contact.name}`);
    return this.getAgentDocumentContext(contact);
  }

  /**
   * Format documents for display in UI
   */
  formatDocumentsForDisplay(documents: DocumentInfo[]): string {
    if (documents.length === 0) return 'No documents available';
    
    const permanent = documents.filter(doc => !doc.metadata?.conversation_document);
    const conversation = documents.filter(doc => doc.metadata?.conversation_document);
    
    let display = '';
    
    if (permanent.length > 0) {
      display += `📚 ${permanent.length} Knowledge Document${permanent.length > 1 ? 's' : ''}`;
    }
    
    if (conversation.length > 0) {
      if (display) display += ' • ';
      display += `💬 ${conversation.length} Conversation Document${conversation.length > 1 ? 's' : ''}`;
    }
    
    return display;
  }

  /**
   * Get document summary for UI
   */
  getDocumentSummary(documents: DocumentInfo[]): {
    permanentCount: number;
    conversationCount: number;
    totalSize: number;
  } {
    const permanent = documents.filter(doc => !doc.metadata?.conversation_document);
    const conversation = documents.filter(doc => doc.metadata?.conversation_document);
    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
    
    return {
      permanentCount: permanent.length,
      conversationCount: conversation.length,
      totalSize
    };
  }

  /**
   * Format document for AI context
   */
  private formatDocumentForAI(document: DocumentInfo): string {
    let formatted = `📄 Document: ${document.name}\n`;
    formatted += `📊 Type: ${document.type}, Size: ${this.formatFileSize(document.size)}\n`;
    
    if (document.summary) {
      formatted += `📝 Summary: ${document.summary}\n`;
    }
    
    if (document.extractedText) {
      // Include up to 2000 characters of content
      const content = document.extractedText.substring(0, 2000);
      formatted += `📖 Content:\n${content}`;
      
      if (document.extractedText.length > 2000) {
        formatted += '\n[Content truncated...]';
      }
    } else if (document.content) {
      // Fallback to content field
      const content = document.content.substring(0, 2000);
      formatted += `📖 Content:\n${content}`;
      
      if (document.content.length > 2000) {
        formatted += '\n[Content truncated...]';
      }
    }
    
    return formatted;
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const documentContextService = new DocumentContextService(); 