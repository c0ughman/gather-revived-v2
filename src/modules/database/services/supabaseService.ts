import { supabase } from '../lib/supabase'
import { AIContact } from '../../../core/types/types'
import { DocumentInfo } from '../../fileManagement/types/documents'

export class SupabaseService {
  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing Supabase connection...');
      
      // Simple query to test connection
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(1);

      if (error) {
        console.error('❌ Database connection test failed:', error);
        return false;
      }

      console.log('✅ Database connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection test error:', error);
      return false;
    }
  }

  // User Agents
  async getUserAgents(userId: string) {
    try {
      console.log('📊 Fetching user agents for:', userId);
      
      const { data, error } = await supabase
        .from('user_agents')
        .select(`
          *,
          agent_integrations (
            id,
            template_id,
            name,
            description,
            config,
            status
          ),
          agent_documents (
            id,
            name,
            original_filename,
            file_type,
            file_size,
            content,
            summary,
            extracted_text,
            metadata,
            uploaded_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching user agents:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} user agents`);
      return data || [];
    } catch (error) {
      console.error('❌ getUserAgents error:', error);
      throw error;
    }
  }

  async createUserAgent(userId: string, agent: Partial<AIContact>) {
    try {
      console.log('➕ Creating user agent:', agent.name);
      
      const { data, error } = await supabase
        .from('user_agents')
        .insert({
          user_id: userId,
          name: agent.name,
          description: agent.description,
          initials: agent.initials,
          color: agent.color,
          voice: agent.voice,
          avatar_url: agent.avatar,
          status: agent.status || 'online',
          last_seen: 'now'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user agent:', error);
        throw error;
      }

      console.log('✅ Created user agent with ID:', data.id);
      return data;
    } catch (error) {
      console.error('❌ createUserAgent error:', error);
      throw error;
    }
  }

  async updateUserAgent(agentId: string, updates: any) {
    try {
      console.log('📝 Updating user agent:', agentId);
      
      const { data, error } = await supabase
        .from('user_agents')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating user agent:', error);
        throw error;
      }

      console.log('✅ Updated user agent');
      return data;
    } catch (error) {
      console.error('❌ updateUserAgent error:', error);
      throw error;
    }
  }

  async deleteUserAgent(agentId: string) {
    try {
      console.log('🗑️ Deleting user agent:', agentId);
      
      const { error } = await supabase
        .from('user_agents')
        .delete()
        .eq('id', agentId);

      if (error) {
        console.error('❌ Error deleting user agent:', error);
        throw error;
      }

      console.log('✅ Deleted user agent');
    } catch (error) {
      console.error('❌ deleteUserAgent error:', error);
      throw error;
    }
  }

  // Agent Integrations
  async createAgentIntegration(agentId: string, integration: any) {
    try {
      console.log('➕ Creating agent integration for:', agentId);
      
      const { data, error } = await supabase
        .from('agent_integrations')
        .insert({
          agent_id: agentId,
          template_id: integration.integrationId,
          name: integration.name,
          description: integration.description,
          config: integration.config,
          trigger_type: integration.config.trigger,
          interval_minutes: integration.config.intervalMinutes,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating agent integration:', error);
        throw error;
      }

      console.log('✅ Created agent integration');
      return data;
    } catch (error) {
      console.error('❌ createAgentIntegration error:', error);
      throw error;
    }
  }

  async deleteAgentIntegration(integrationId: string) {
    try {
      console.log('🗑️ Deleting agent integration:', integrationId);
      
      const { error } = await supabase
        .from('agent_integrations')
        .delete()
        .eq('id', integrationId);

      if (error) {
        console.error('❌ Error deleting agent integration:', error);
        throw error;
      }

      console.log('✅ Deleted agent integration');
    } catch (error) {
      console.error('❌ deleteAgentIntegration error:', error);
      throw error;
    }
  }

  // Agent Documents
  async createAgentDocument(agentId: string, document: DocumentInfo) {
    try {
      console.log('📄 Creating agent document:', document.name);
      
      const { data, error } = await supabase
        .from('agent_documents')
        .insert({
          agent_id: agentId,
          name: document.name,
          original_filename: document.name,
          file_type: document.type,
          file_size: document.size,
          content: document.content,
          summary: document.summary,
          extracted_text: document.extractedText,
          processing_status: 'completed',
          metadata: document.metadata || {}
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating agent document:', error);
        throw error;
      }

      console.log('✅ Created agent document');
      return data;
    } catch (error) {
      console.error('❌ createAgentDocument error:', error);
      throw error;
    }
  }

  async deleteAgentDocument(documentId: string) {
    try {
      console.log('🗑️ Deleting agent document:', documentId);
      
      const { error } = await supabase
        .from('agent_documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        console.error('❌ Error deleting agent document:', error);
        throw error;
      }

      console.log('✅ Deleted agent document');
    } catch (error) {
      console.error('❌ deleteAgentDocument error:', error);
      throw error;
    }
  }

  // Document Retrieval Methods for Chat and Voice
  async getAgentDocuments(agentId: string): Promise<DocumentInfo[]> {
    try {
      const { data, error } = await supabase
        .from('agent_documents')
        .select('*')
        .eq('agent_id', agentId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching agent documents:', error);
        throw error;
      }

      return (data || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.file_type,
        size: doc.file_size,
        uploadedAt: new Date(doc.uploaded_at),
        content: doc.content || '',
        summary: doc.summary,
        extractedText: doc.extracted_text,
        metadata: doc.metadata || {}
      }));
    } catch (error) {
      console.error('❌ getAgentDocuments error:', error);
      return [];
    }
  }

  async getDocumentById(documentId: string): Promise<DocumentInfo | null> {
    try {
      const { data, error } = await supabase
        .from('agent_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        console.error('❌ Error fetching document:', error);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        type: data.file_type,
        size: data.file_size,
        uploadedAt: new Date(data.uploaded_at),
        content: data.content || '',
        summary: data.summary,
        extractedText: data.extracted_text,
        metadata: data.metadata || {}
      };
    } catch (error) {
      console.error('❌ getDocumentById error:', error);
      return null;
    }
  }

  // Conversation Documents Management
  async saveConversationDocument(agentId: string, document: DocumentInfo): Promise<string> {
    try {
      console.log('💬 Saving conversation document:', document.name);
      
      const { data, error } = await supabase
        .from('agent_documents')
        .insert({
          agent_id: agentId,
          name: document.name,
          original_filename: document.name,
          file_type: document.type,
          file_size: document.size,
          content: document.content,
          summary: document.summary,
          extracted_text: document.extractedText,
          processing_status: 'completed',
          metadata: {
            ...document.metadata,
            conversation_document: true,
            uploaded_in_conversation: true
          }
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error saving conversation document:', error);
        throw error;
      }

      console.log('✅ Saved conversation document');
      return data.id;
    } catch (error) {
      console.error('❌ saveConversationDocument error:', error);
      throw error;
    }
  }

  async getConversationDocuments(agentId: string): Promise<DocumentInfo[]> {
    try {
      const { data, error } = await supabase
        .from('agent_documents')
        .select('*')
        .eq('agent_id', agentId)
        .eq('metadata->conversation_document', true)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching conversation documents:', error);
        throw error;
      }

      return (data || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.file_type,
        size: doc.file_size,
        uploadedAt: new Date(doc.uploaded_at),
        content: doc.content || '',
        summary: doc.summary,
        extractedText: doc.extracted_text,
        metadata: doc.metadata || {}
      }));
    } catch (error) {
      console.error('❌ getConversationDocuments error:', error);
      return [];
    }
  }

  // Enhanced method to get all relevant documents for context building
  async getAllAgentContext(agentId: string): Promise<{
    permanentDocuments: DocumentInfo[]
    conversationDocuments: DocumentInfo[]
  }> {
    try {
      console.log('📚 Getting all agent context for:', agentId);
      
      const [permanent, conversation] = await Promise.all([
        this.getAgentDocuments(agentId),
        this.getConversationDocuments(agentId)
      ]);

      const permanentDocuments = permanent.filter(doc => !doc.metadata?.conversation_document);
      const conversationDocuments = conversation;

      console.log(`✅ Retrieved ${permanentDocuments.length} permanent + ${conversationDocuments.length} conversation documents`);

      return {
        permanentDocuments,
        conversationDocuments
      };
    } catch (error) {
      console.error('❌ getAllAgentContext error:', error);
      return {
        permanentDocuments: [],
        conversationDocuments: []
      };
    }
  }

  // User Profile Management
  async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching user profile:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ getUserProfile error:', error);
      return null;
    }
  }

  async createUserProfile(userId: string, profileData: any) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          display_name: profileData.display_name || profileData.email,
          subscription_plan: 'free',
          ...profileData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user profile:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ createUserProfile error:', error);
      throw error;
    }
  }
}

export const supabaseService = new SupabaseService()