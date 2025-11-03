/**
 * Document API Service
 * 
 * Handles document operations through the Python backend instead of direct Supabase calls
 */

import { DocumentInfo } from '../../modules/fileManagement/types/documents';

interface DocumentApiService {
  saveAgentDocument(agentId: string, document: DocumentInfo): Promise<{ success: boolean; document_id: string }>;
  deleteDocument(documentId: string): Promise<{ success: boolean; message: string }>;
  deleteIntegration(integrationId: string): Promise<{ success: boolean; message: string }>;
}

class DocumentApiServiceImpl implements DocumentApiService {
  private baseUrl: string;

  constructor() {
    // Use same backend URL as voice service
    this.baseUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';
    console.log('📄 Document API Service initialized:', this.baseUrl);
  }

  async saveAgentDocument(agentId: string, document: DocumentInfo): Promise<{ success: boolean; document_id: string }> {
    try {
      console.log(`💾 Saving document "${document.name}" to agent ${agentId} via backend database API`);

      const authToken = this.getAuthToken();
      
      // Prepare document data for backend (match DocumentCreate model)
      const documentData = {
        name: document.name,
        type: document.type,
        size: document.size,
        content: document.content,
        summary: document.summary,
        extractedText: document.extractedText,
        metadata: document.metadata || {}
      };
      
      // Use the database endpoint to save agent document
      const response = await fetch(`${this.baseUrl}/api/v1/database/agents/${agentId}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify(documentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Save failed: ${response.status}`);
      }

      const result = await response.json();
      
      console.log(`✅ Document "${document.name}" saved successfully with ID: ${result.document_id}`);
      return result;

    } catch (error) {
      console.error(`❌ Error saving document "${document.name}" to agent ${agentId}:`, error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🗑️ Deleting document ${documentId} via backend database API`);

      const authToken = this.getAuthToken();
      console.log(`🔐 Auth token length: ${authToken.length}, first 20 chars: ${authToken.substring(0, 20)}`);
      
      // Use the new database endpoint
      const response = await fetch(`${this.baseUrl}/api/v1/database/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Delete failed: ${response.status}`);
      }

      const result = await response.json();
      
      console.log(`✅ Document ${documentId} deleted successfully`);
      return result;

    } catch (error) {
      console.error(`❌ Error deleting document ${documentId}:`, error);
      throw error;
    }
  }

  async deleteIntegration(integrationId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🗑️ Deleting integration ${integrationId} via backend API`);

      const authToken = this.getAuthToken();
      
      const response = await fetch(`${this.baseUrl}/api/v1/integrations/${integrationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      });

      if (!response.ok) {
        // For now, fall back to Supabase if backend endpoint doesn't exist
        console.warn(`Backend integration deletion not available, falling back to direct Supabase`);
        
        // Import here to avoid circular dependency
        const { supabaseService } = await import('../../modules/database');
        await supabaseService.deleteAgentIntegration(integrationId);
        
        return { success: true, message: `Integration ${integrationId} deleted via fallback` };
      }

      const result = await response.json();
      
      console.log(`✅ Integration ${integrationId} deleted successfully`);
      return result;

    } catch (error) {
      console.error(`❌ Error deleting integration ${integrationId}:`, error);
      throw error;
    }
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
}

export const documentApiService = new DocumentApiServiceImpl();