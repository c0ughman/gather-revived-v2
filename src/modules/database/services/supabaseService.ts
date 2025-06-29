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
      
      // Update user_usage to increment agents_created
      await this.incrementUsageStat(userId, 'agents_created', 1);
      
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
      
      // Get user_id before deleting
      const { data: agent, error: getError } = await supabase
        .from('user_agents')
        .select('user_id')
        .eq('id', agentId)
        .single();
        
      if (getError) {
        console.error('❌ Error getting user agent:', getError);
        throw getError;
      }
      
      const userId = agent.user_id;
      
      const { error } = await supabase
        .from('user_agents')
        .delete()
        .eq('id', agentId);

      if (error) {
        console.error('❌ Error deleting user agent:', error);
        throw error;
      }

      console.log('✅ Deleted user agent');
      
      // Update user_usage to decrement agents_created
      await this.incrementUsageStat(userId, 'agents_created', -1);
    } catch (error) {
      console.error('❌ deleteUserAgent error:', error);
      throw error;
    }
  }

  // Agent Integrations
  async createAgentIntegration(agentId: string, integration: any) {
    try {
      console.log('➕ Creating agent integration for:', agentId);
      
      // Get user_id for the agent
      const { data: agent, error: agentError } = await supabase
        .from('user_agents')
        .select('user_id')
        .eq('id', agentId)
        .single();
        
      if (agentError) {
        console.error('❌ Error getting agent:', agentError);
        throw agentError;
      }
      
      const userId = agent.user_id;
      
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
      
      // Update user_usage to increment integrations_active
      await this.incrementUsageStat(userId, 'integrations_active', 1);
      
      return data;
    } catch (error) {
      console.error('❌ createAgentIntegration error:', error);
      throw error;
    }
  }

  async deleteAgentIntegration(integrationId: string) {
    try {
      console.log('🗑️ Deleting agent integration:', integrationId);
      
      // Get agent_id and user_id before deleting
      const { data: integration, error: getError } = await supabase
        .from('agent_integrations')
        .select('agent_id')
        .eq('id', integrationId)
        .single();
        
      if (getError) {
        console.error('❌ Error getting integration:', getError);
        throw getError;
      }
      
      const agentId = integration.agent_id;
      
      // Get user_id for the agent
      const { data: agent, error: agentError } = await supabase
        .from('user_agents')
        .select('user_id')
        .eq('id', agentId)
        .single();
        
      if (agentError) {
        console.error('❌ Error getting agent:', agentError);
        throw agentError;
      }
      
      const userId = agent.user_id;
      
      const { error } = await supabase
        .from('agent_integrations')
        .delete()
        .eq('id', integrationId);

      if (error) {
        console.error('❌ Error deleting agent integration:', error);
        throw error;
      }

      console.log('✅ Deleted agent integration');
      
      // Update user_usage to decrement integrations_active
      await this.incrementUsageStat(userId, 'integrations_active', -1);
    } catch (error) {
      console.error('❌ deleteAgentIntegration error:', error);
      throw error;
    }
  }

  // Agent Documents
  async createAgentDocument(agentId: string, document: DocumentInfo) {
    try {
      console.log('📄 Creating agent document:', document.name);
      
      // Get user_id for the agent
      const { data: agent, error: agentError } = await supabase
        .from('user_agents')
        .select('user_id')
        .eq('id', agentId)
        .single();
        
      if (agentError) {
        console.error('❌ Error getting agent:', agentError);
        throw agentError;
      }
      
      const userId = agent.user_id;
      
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
      
      // Update user_usage to increment storage_used (in MB)
      const sizeMB = Math.ceil(document.size / (1024 * 1024));
      await this.incrementUsageStat(userId, 'storage_used', sizeMB);
      
      return data;
    } catch (error) {
      console.error('❌ createAgentDocument error:', error);
      throw error;
    }
  }

  async deleteAgentDocument(documentId: string) {
    try {
      console.log('🗑️ Deleting agent document:', documentId);
      
      // Get document details before deleting
      const { data: document, error: getError } = await supabase
        .from('agent_documents')
        .select('agent_id, file_size')
        .eq('id', documentId)
        .single();
        
      if (getError) {
        console.error('❌ Error getting document:', getError);
        throw getError;
      }
      
      const agentId = document.agent_id;
      const fileSize = document.file_size;
      
      // Get user_id for the agent
      const { data: agent, error: agentError } = await supabase
        .from('user_agents')
        .select('user_id')
        .eq('id', agentId)
        .single();
        
      if (agentError) {
        console.error('❌ Error getting agent:', agentError);
        throw agentError;
      }
      
      const userId = agent.user_id;
      
      const { error } = await supabase
        .from('agent_documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        console.error('❌ Error deleting agent document:', error);
        throw error;
      }

      console.log('✅ Deleted agent document');
      
      // Update user_usage to decrement storage_used (in MB)
      const sizeMB = Math.ceil(fileSize / (1024 * 1024));
      await this.incrementUsageStat(userId, 'storage_used', -sizeMB);
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
      
      // Get user_id for the agent
      const { data: agent, error: agentError } = await supabase
        .from('user_agents')
        .select('user_id')
        .eq('id', agentId)
        .single();
        
      if (agentError) {
        console.error('❌ Error getting agent:', agentError);
        throw agentError;
      }
      
      const userId = agent.user_id;
      
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
      
      // Update user_usage to increment storage_used (in MB)
      const sizeMB = Math.ceil(document.size / (1024 * 1024));
      await this.incrementUsageStat(userId, 'storage_used', sizeMB);
      
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
          preferences: {
            plan: 'free',
            ...profileData.preferences
          },
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

  // Usage tracking methods
  async incrementCallTimeUsed(userId: string, seconds: number) {
    try {
      console.log(`⏱️ Incrementing call time for user ${userId} by ${seconds} seconds`);
      
      const { data, error } = await supabase
        .from('user_usage')
        .select('call_time_used')
        .eq('user_id', userId)
        .single();
        
      if (error) {
        console.error('❌ Error fetching call time usage:', error);
        
        // Try to create a new record if it doesn't exist
        if (error.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('user_usage')
            .insert({
              user_id: userId,
              call_time_used: seconds,
              last_reset_date: new Date().toISOString()
            });
            
          if (insertError) {
            console.error('❌ Error creating usage record:', insertError);
            throw insertError;
          }
          
          return seconds;
        }
        
        throw error;
      }
      
      const currentUsage = data.call_time_used || 0;
      const newUsage = currentUsage + seconds;
      
      const { error: updateError } = await supabase
        .from('user_usage')
        .update({
          call_time_used: newUsage,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
        
      if (updateError) {
        console.error('❌ Error updating call time usage:', updateError);
        throw updateError;
      }
      
      console.log(`✅ Updated call time usage to ${newUsage} seconds`);
      return newUsage;
    } catch (error) {
      console.error('❌ incrementCallTimeUsed error:', error);
      throw error;
    }
  }

  async getCallTimeUsage(userId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
    isLimitReached: boolean;
    plan: string;
  }> {
    try {
      console.log(`⏱️ Getting call time usage for user ${userId}`);
      
      // Get user's usage data and plan
      const [usageResult, profileResult] = await Promise.all([
        supabase
          .from('user_usage')
          .select('call_time_used, plan_id, last_reset_date')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('user_profiles')
          .select('preferences')
          .eq('id', userId)
          .single()
      ]);
      
      if (usageResult.error && usageResult.error.code !== 'PGRST116') {
        console.error('❌ Error fetching call time usage:', usageResult.error);
        throw usageResult.error;
      }
      
      // Get plan from profile preferences
      const plan = profileResult.data?.preferences?.plan || 
                  usageResult.data?.plan_id || 
                  'free';
      
      // Get plan limits
      const planLimits = {
        free: 600, // 10 minutes in seconds
        standard: 1200, // 20 minutes in seconds
        premium: 6000, // 100 minutes in seconds
        pro: 86400 // 24 hours in seconds (unlimited)
      };
      
      const limit = planLimits[plan] || planLimits.free;
      const used = usageResult.data?.call_time_used || 0;
      const remaining = Math.max(0, limit - used);
      
      return {
        used,
        limit,
        remaining,
        isLimitReached: remaining <= 0,
        plan
      };
    } catch (error) {
      console.error('❌ getCallTimeUsage error:', error);
      throw error;
    }
  }

  // Generic method to increment any usage stat
  async incrementUsageStat(userId: string, statName: string, amount: number) {
    try {
      console.log(`📊 Incrementing ${statName} for user ${userId} by ${amount}`);
      
      const { data, error } = await supabase
        .from('user_usage')
        .select(statName)
        .eq('user_id', userId)
        .single();
        
      if (error) {
        console.error(`❌ Error fetching ${statName}:`, error);
        
        // Try to create a new record if it doesn't exist
        if (error.code === 'PGRST116') {
          const insertData = {
            user_id: userId,
            [statName]: amount > 0 ? amount : 0, // Ensure we don't go negative for a new record
            last_reset_date: new Date().toISOString()
          };
          
          const { error: insertError } = await supabase
            .from('user_usage')
            .insert(insertData);
            
          if (insertError) {
            console.error('❌ Error creating usage record:', insertError);
            throw insertError;
          }
          
          return amount > 0 ? amount : 0;
        }
        
        throw error;
      }
      
      const currentValue = data[statName] || 0;
      const newValue = Math.max(0, currentValue + amount); // Ensure we don't go negative
      
      const { error: updateError } = await supabase
        .from('user_usage')
        .update({
          [statName]: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
        
      if (updateError) {
        console.error(`❌ Error updating ${statName}:`, updateError);
        throw updateError;
      }
      
      console.log(`✅ Updated ${statName} to ${newValue}`);
      return newValue;
    } catch (error) {
      console.error(`❌ incrementUsageStat error for ${statName}:`, error);
      throw error;
    }
  }
}

export const supabaseService = new SupabaseService()