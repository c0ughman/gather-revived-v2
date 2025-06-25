import { supabase } from '../lib/supabase'
import { AIContact, DocumentInfo, Message } from '../types'

export class SupabaseService {
  // User Profile Management
  async createUserProfile(userId: string, displayName?: string) {
    console.log('📝 Creating user profile for:', userId, 'with name:', displayName);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        display_name: displayName,
        preferences: {},
        usage_stats: {}
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating user profile:', error);
      throw error;
    }
    
    console.log('✅ User profile created:', data);
    return data
  }

  async getUserProfile(userId: string) {
    console.log('🔍 Getting user profile for:', userId);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error getting user profile:', error);
      throw error;
    }
    
    console.log('✅ User profile result:', data ? 'Found' : 'Not found');
    return data
  }

  async updateUserProfile(userId: string, updates: any) {
    console.log('📝 Updating user profile for:', userId, 'with:', updates);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating user profile:', error);
      throw error;
    }
    
    console.log('✅ User profile updated:', data);
    return data
  }

  // Agent Management
  async getUserAgents(userId: string) {
    console.log('🤖 Getting user agents for:', userId);
    
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
          status,
          created_at
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
          processing_status,
          metadata,
          uploaded_at
        )
      `)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('❌ Error getting user agents:', error);
      throw error;
    }
    
    console.log('✅ User agents result:', data?.length || 0, 'agents found');
    return data
  }

  async createUserAgent(userId: string, agent: Partial<AIContact>) {
    console.log('📝 Creating user agent for:', userId, 'with name:', agent.name);
    
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
        last_seen: agent.lastSeen || 'now',
        personality_prompt: '',
        system_instructions: '',
        custom_settings: {},
        folder: null,
        tags: [],
        is_favorite: false,
        sort_order: 0
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating user agent:', error);
      throw error;
    }
    
    console.log('✅ User agent created:', data);
    return data
  }

  async updateUserAgent(agentId: string, updates: any) {
    console.log('📝 Updating user agent:', agentId, 'with:', updates);
    
    const { data, error } = await supabase
      .from('user_agents')
      .update(updates)
      .eq('id', agentId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating user agent:', error);
      throw error;
    }
    
    console.log('✅ User agent updated:', data);
    return data
  }

  async deleteUserAgent(agentId: string) {
    console.log('🗑️ Deleting user agent:', agentId);
    
    const { error } = await supabase
      .from('user_agents')
      .delete()
      .eq('id', agentId)

    if (error) {
      console.error('❌ Error deleting user agent:', error);
      throw error;
    }
    
    console.log('✅ User agent deleted');
  }

  // Agent Templates (Global)
  async getAgentTemplates() {
    console.log('🔍 Getting agent templates');
    
    const { data, error } = await supabase
      .from('agent_templates')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('❌ Error getting agent templates:', error);
      throw error;
    }
    
    console.log('✅ Agent templates result:', data?.length || 0, 'templates found');
    return data
  }

  // Integration Templates (Global)
  async getIntegrationTemplates() {
    console.log('🔍 Getting integration templates');
    
    const { data, error } = await supabase
      .from('integration_templates')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('❌ Error getting integration templates:', error);
      throw error;
    }
    
    console.log('✅ Integration templates result:', data?.length || 0, 'templates found');
    return data
  }

  // Agent Integrations
  async createAgentIntegration(agentId: string, integration: any) {
    console.log('📝 Creating agent integration for:', agentId);
    
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
      .single()

    if (error) {
      console.error('❌ Error creating agent integration:', error);
      throw error;
    }
    
    console.log('✅ Agent integration created:', data);
    return data
  }

  async updateAgentIntegration(integrationId: string, updates: any) {
    console.log('📝 Updating agent integration:', integrationId);
    
    const { data, error } = await supabase
      .from('agent_integrations')
      .update(updates)
      .eq('id', integrationId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating agent integration:', error);
      throw error;
    }
    
    console.log('✅ Agent integration updated:', data);
    return data
  }

  async deleteAgentIntegration(integrationId: string) {
    console.log('🗑️ Deleting agent integration:', integrationId);
    
    const { error } = await supabase
      .from('agent_integrations')
      .delete()
      .eq('id', integrationId)

    if (error) {
      console.error('❌ Error deleting agent integration:', error);
      throw error;
    }
    
    console.log('✅ Agent integration deleted');
  }

  // Document Management
  async createAgentDocument(agentId: string, document: DocumentInfo) {
    console.log('📝 Creating agent document for:', agentId, 'document:', document.name);
    
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
        extraction_quality: document.metadata?.extractionQuality || 'good',
        metadata: document.metadata || {},
        folder: null,
        tags: [],
        uploaded_at: document.uploadedAt.toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating agent document:', error);
      throw error;
    }
    
    console.log('✅ Agent document created:', data);
    return data
  }

  async deleteAgentDocument(documentId: string) {
    console.log('🗑️ Deleting agent document:', documentId);
    
    const { error } = await supabase
      .from('agent_documents')
      .delete()
      .eq('id', documentId)

    if (error) {
      console.error('❌ Error deleting agent document:', error);
      throw error;
    }
    
    console.log('✅ Agent document deleted');
  }

  // Conversation Management
  async createConversation(userId: string, agentId: string) {
    console.log('📝 Creating conversation for user:', userId, 'agent:', agentId);
    
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        agent_id: agentId,
        title: null,
        summary: null,
        status: 'active',
        conversation_type: 'chat'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating conversation:', error);
      throw error;
    }
    
    console.log('✅ Conversation created:', data);
    return data
  }

  async getConversations(userId: string, agentId?: string) {
    console.log('🔍 Getting conversations for user:', userId, 'agent:', agentId);
    
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query
    
    if (error) {
      console.error('❌ Error getting conversations:', error);
      throw error;
    }
    
    console.log('✅ Conversations result:', data?.length || 0, 'conversations found');
    return data
  }

  // Message Management
  async createMessage(conversationId: string, content: string, sender: 'user' | 'ai', attachments?: string[]) {
    console.log('📝 Creating message for conversation:', conversationId);
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        sender,
        message_type: 'text',
        timestamp: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating message:', error);
      throw error;
    }

    // Create message attachments if provided
    if (attachments && attachments.length > 0) {
      const attachmentData = attachments.map(docId => ({
        message_id: data.id,
        document_id: docId,
        attachment_type: 'reference'
      }))

      const { error: attachmentError } = await supabase
        .from('message_attachments')
        .insert(attachmentData)
        
      if (attachmentError) {
        console.error('❌ Error creating message attachments:', attachmentError);
      }
    }

    console.log('✅ Message created:', data);
    return data
  }

  async getMessages(conversationId: string) {
    console.log('🔍 Getting messages for conversation:', conversationId);
    
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        message_attachments (
          id,
          document_id,
          attachment_type,
          agent_documents (
            id,
            name,
            file_type,
            file_size,
            summary,
            uploaded_at
          )
        )
      `)
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true })

    if (error) {
      console.error('❌ Error getting messages:', error);
      throw error;
    }
    
    console.log('✅ Messages result:', data?.length || 0, 'messages found');
    return data
  }
}

export const supabaseService = new SupabaseService()