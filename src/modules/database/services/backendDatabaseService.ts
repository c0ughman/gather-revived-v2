import { AIContact } from '../../../core/types/types'
import { DocumentInfo } from '../../fileManagement/types/documents'

export class BackendDatabaseService {
  private baseUrl: string

  constructor() {
    // Use environment variable to determine backend URL
    this.baseUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000'
    console.log('🗄️ Backend Database Service initialized:', this.baseUrl)
  }

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

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const authToken = this.getAuthToken()
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/database${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          ...options.headers
        }
      })

      if (!response.ok) {
        let errorMessage = `Request failed: ${response.status}`
        try {
          const errorData = await response.json()
          console.error(`❌ Backend request failed with ${response.status}:`, errorData)
          errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData) || errorMessage
        } catch (e) {
          // If we can't parse the error response, use the status
          console.error(`❌ Backend request failed (couldn't parse response):`, e)
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      return result
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`❌ Backend not available at ${this.baseUrl}`)
        throw new Error('Backend database service is not available. Please ensure the Python backend is running.')
      }
      throw error
    }
  }

  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing backend database connection...');

      // Use direct fetch for health check (not through makeRequest which adds /api/v1/database prefix)
      const authToken = this.getAuthToken()
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      })

      if (!response.ok) {
        console.error('❌ Backend health check failed:', response.status);
        return false;
      }

      const result = await response.json()

      if (result.status === 'healthy') {
        console.log('✅ Backend database connection test successful');
        return true;
      } else {
        console.error('❌ Backend database connection test failed:', result);
        return false;
      }
    } catch (error) {
      console.error('❌ Backend database connection test error:', error);
      return false;
    }
  }

  // User Agents
  async getUserAgents(userId: string) {
    try {
      console.log('📊 Fetching user agents for:', userId);
      
      const result = await this.makeRequest('/agents')
      
      if (result.success) {
        console.log(`✅ Fetched ${result.data?.length || 0} user agents`);
        return result.data || [];
      } else {
        throw new Error(result.error || 'Failed to fetch user agents');
      }
    } catch (error) {
      console.error('❌ getUserAgents error:', error);
      throw error;
    }
  }

  async createUserAgent(userId: string, agent: Partial<AIContact>) {
    try {
      console.log('➕ Creating user agent:', agent.name);
      
      const agentData = {
        name: agent.name!,
        description: agent.description,
        initials: agent.initials!,
        color: agent.color!,
        voice: agent.voice,
        avatar: agent.avatar,
        status: agent.status || 'online'
      }
      
      const result = await this.makeRequest('/agents', {
        method: 'POST',
        body: JSON.stringify(agentData)
      })

      if (result.success) {
        console.log('✅ Created user agent with ID:', result.data.id);
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to create user agent');
      }
    } catch (error) {
      console.error('❌ createUserAgent error:', error);
      throw error;
    }
  }

  async updateUserAgent(agentId: string, updates: any) {
    try {
      console.log('📝 Updating user agent:', agentId);
      
      const result = await this.makeRequest(`/agents/${agentId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      })

      if (result.success) {
        console.log('✅ Updated user agent');
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to update user agent');
      }
    } catch (error) {
      console.error('❌ updateUserAgent error:', error);
      throw error;
    }
  }

  async deleteUserAgent(agentId: string) {
    try {
      console.log('🗑️ Deleting user agent:', agentId);
      
      const result = await this.makeRequest(`/agents/${agentId}`, {
        method: 'DELETE'
      })

      if (result.success) {
        console.log('✅ Deleted user agent');
        return;
      } else {
        throw new Error(result.error || 'Failed to delete user agent');
      }
    } catch (error) {
      console.error('❌ deleteUserAgent error:', error);
      throw error;
    }
  }

  // Agent Integrations
  async createAgentIntegration(agentId: string, integration: any) {
    try {
      console.log('➕ Creating agent integration for:', agentId);
      
      const integrationData = {
        integrationId: integration.integrationId,
        name: integration.name,
        description: integration.description,
        config: integration.config
      }
      
      const result = await this.makeRequest(`/agents/${agentId}/integrations`, {
        method: 'POST',
        body: JSON.stringify(integrationData)
      })

      if (result.success) {
        console.log('✅ Created agent integration');
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to create agent integration');
      }
    } catch (error) {
      console.error('❌ createAgentIntegration error:', error);
      throw error;
    }
  }

  async deleteAgentIntegration(integrationId: string) {
    try {
      console.log('🗑️ Deleting agent integration:', integrationId);
      
      const result = await this.makeRequest(`/integrations/${integrationId}`, {
        method: 'DELETE'
      })

      if (result.success) {
        console.log('✅ Deleted agent integration');
        return;
      } else {
        throw new Error(result.error || 'Failed to delete agent integration');
      }
    } catch (error) {
      console.error('❌ deleteAgentIntegration error:', error);
      throw error;
    }
  }

  // Agent Documents
  async createAgentDocument(agentId: string, document: DocumentInfo) {
    try {
      console.log('📄 Creating agent document:', document.name);
      
      const documentData = {
        name: document.name,
        type: document.type,
        size: document.size,
        content: document.content,
        summary: document.summary,
        extractedText: document.extractedText,
        metadata: document.metadata
      }
      
      const result = await this.makeRequest(`/agents/${agentId}/documents`, {
        method: 'POST',
        body: JSON.stringify(documentData)
      })

      if (result.success) {
        console.log('✅ Created agent document');
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to create agent document');
      }
    } catch (error) {
      console.error('❌ createAgentDocument error:', error);
      throw error;
    }
  }

  async deleteAgentDocument(documentId: string) {
    try {
      console.log('🗑️ Deleting agent document:', documentId);
      
      const result = await this.makeRequest(`/documents/${documentId}`, {
        method: 'DELETE'
      })

      if (result.success) {
        console.log('✅ Deleted agent document');
        return;
      } else {
        throw new Error(result.error || 'Failed to delete agent document');
      }
    } catch (error) {
      console.error('❌ deleteAgentDocument error:', error);
      throw error;
    }
  }

  // Document Retrieval Methods for Chat and Voice
  async getAgentDocuments(agentId: string): Promise<DocumentInfo[]> {
    try {
      const result = await this.makeRequest(`/agents/${agentId}/documents`)
      
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.error || 'Failed to get agent documents');
      }
    } catch (error) {
      console.error('❌ getAgentDocuments error:', error);
      return [];
    }
  }

  async getDocumentById(documentId: string): Promise<DocumentInfo | null> {
    try {
      const result = await this.makeRequest(`/documents/${documentId}`)
      
      if (result.success) {
        return result.data;
      } else {
        return null;
      }
    } catch (error) {
      console.error('❌ getDocumentById error:', error);
      return null;
    }
  }

  // Conversation Documents Management
  async saveConversationDocument(agentId: string, document: DocumentInfo): Promise<string> {
    try {
      console.log('💬 Saving conversation document:', document.name);
      
      const documentData = {
        name: document.name,
        type: document.type,
        size: document.size,
        content: document.content,
        summary: document.summary,
        extractedText: document.extractedText,
        metadata: document.metadata
      }
      
      const result = await this.makeRequest(`/agents/${agentId}/conversation-documents`, {
        method: 'POST',
        body: JSON.stringify(documentData)
      })

      if (result.success) {
        console.log('✅ Saved conversation document');
        return result.data.id;
      } else {
        throw new Error(result.error || 'Failed to save conversation document');
      }
    } catch (error) {
      console.error('❌ saveConversationDocument error:', error);
      throw error;
    }
  }

  async getConversationDocuments(agentId: string): Promise<DocumentInfo[]> {
    try {
      const result = await this.makeRequest(`/agents/${agentId}/conversation-documents`)
      
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.error || 'Failed to get conversation documents');
      }
    } catch (error) {
      console.error('❌ getConversationDocuments error:', error);
      return [];
    }
  }

  // Paper Notes Management
  async getPaperNotesWithTokenInfo(agentId: string): Promise<{
    allNotes: any[]
    includedNotes: any[]
    excludedNotes: any[]
    totalTokens: number
    maxTokens: number
  }> {
    try {
      console.log('📝 Getting paper notes with token info for:', agentId);
      
      const result = await this.makeRequest(`/agents/${agentId}/paper-notes`)
      
      if (result.success) {
        const data = result.data;
        console.log(`✅ Retrieved ${data.allNotes?.length || 0} notes (${data.includedNotes?.length || 0} included, ${data.excludedNotes?.length || 0} excluded)`);
        
        return {
          allNotes: data.all_notes || [],
          includedNotes: data.included_notes || [],
          excludedNotes: data.excluded_notes || [],
          totalTokens: data.total_tokens || 0,
          maxTokens: data.max_tokens || 4000
        };
      } else {
        throw new Error(result.error || 'Failed to get paper notes with token info');
      }
    } catch (error) {
      console.error('❌ getPaperNotesWithTokenInfo error:', error);
      return {
        allNotes: [],
        includedNotes: [],
        excludedNotes: [],
        totalTokens: 0,
        maxTokens: 4000
      };
    }
  }

  // Medium-term Memory Management
  async getMediumTermMemoryWithTokenInfo(agentId: string): Promise<{
    allMemory: any[]
    includedMemory: any[]
    excludedMemory: any[]
    totalTokens: number
    maxTokens: number
  }> {
    try {
      console.log('🧠 Getting medium-term memory with token info for:', agentId);
      
      const result = await this.makeRequest(`/agents/${agentId}/medium-term-memory`)
      
      if (result.success) {
        const data = result.data;
        console.log(`✅ Retrieved ${data.allMemory?.length || 0} memory items (${data.includedMemory?.length || 0} included, ${data.excludedMemory?.length || 0} excluded)`);
        
        return {
          allMemory: data.all_memory || [],
          includedMemory: data.included_memory || [],
          excludedMemory: data.excluded_memory || [],
          totalTokens: data.total_tokens || 0,
          maxTokens: data.max_tokens || 4000
        };
      } else {
        throw new Error(result.error || 'Failed to get medium-term memory with token info');
      }
    } catch (error) {
      console.error('❌ getMediumTermMemoryWithTokenInfo error:', error);
      return {
        allMemory: [],
        includedMemory: [],
        excludedMemory: [],
        totalTokens: 0,
        maxTokens: 4000
      };
    }
  }

  // Enhanced method to get all relevant documents for context building
  async getAllAgentContext(agentId: string): Promise<{
    permanentDocuments: DocumentInfo[]
    conversationDocuments: DocumentInfo[]
    paperNotes?: any[]
  }> {
    try {
      console.log('📚 Getting all agent context for:', agentId);
      
      const result = await this.makeRequest(`/agents/${agentId}/context`)
      
      if (result.success) {
        const data = result.data;
        console.log(`✅ Retrieved ${data.permanentDocuments?.length || 0} permanent + ${data.conversationDocuments?.length || 0} conversation documents + ${data.paperNotes?.length || 0} paper notes`);
        
        return {
          permanentDocuments: data.permanentDocuments || [],
          conversationDocuments: data.conversationDocuments || [],
          paperNotes: data.paperNotes || []
        };
      } else {
        throw new Error(result.error || 'Failed to get agent context');
      }
    } catch (error) {
      console.error('❌ getAllAgentContext error:', error);
      return {
        permanentDocuments: [],
        conversationDocuments: [],
        paperNotes: []
      };
    }
  }

  // User Profile Management
  async getUserProfile(userId: string) {
    try {
      const result = await this.makeRequest('/profile')
      
      if (result.success) {
        return result.data;
      } else if (result.error && result.error.includes('not found')) {
        return null;
      } else {
        throw new Error(result.error || 'Failed to get user profile');
      }
    } catch (error) {
      console.error('❌ getUserProfile error:', error);
      return null;
    }
  }

  async createUserProfile(userId: string, profileData: any) {
    try {
      const result = await this.makeRequest('/profile', {
        method: 'POST',
        body: JSON.stringify(profileData)
      })

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to create user profile');
      }
    } catch (error) {
      console.error('❌ createUserProfile error:', error);
      throw error;
    }
  }
}

export const backendDatabaseService = new BackendDatabaseService()