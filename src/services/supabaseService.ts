import { supabase } from '../lib/supabase'
import { AIContact, DocumentInfo, Message } from '../types'

export class SupabaseService {
  // User Profile Management
  async createUserProfile(userId: string, displayName?: string) {
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

    if (error) throw error
    return data
  }

  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async updateUserProfile(userId: string, updates: any) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Agent Management
  async getUserAgents(userId: string) {
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

    if (error) throw error
    return data
  }

  async createUserAgent(userId: string, agent: Partial<AIContact>) {
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

    if (error) throw error
    return data
  }

  async updateUserAgent(agentId: string, updates: any) {
    const { data, error } = await supabase
      .from('user_agents')
      .update(updates)
      .eq('id', agentId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteUserAgent(agentId: string) {
    const { error } = await supabase
      .from('user_agents')
      .delete()
      .eq('id', agentId)

    if (error) throw error
  }

  // Agent Templates (Global)
  async getAgentTemplates() {
    const { data, error } = await supabase
      .from('agent_templates')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data
  }

  // Integration Templates (Global)
  async getIntegrationTemplates() {
    const { data, error } = await supabase
      .from('integration_templates')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data
  }

  // Agent Integrations
  async createAgentIntegration(agentId: string, integration: any) {
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

    if (error) throw error
    return data
  }

  async updateAgentIntegration(integrationId: string, updates: any) {
    const { data, error } = await supabase
      .from('agent_integrations')
      .update(updates)
      .eq('id', integrationId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteAgentIntegration(integrationId: string) {
    const { error } = await supabase
      .from('agent_integrations')
      .delete()
      .eq('id', integrationId)

    if (error) throw error
  }

  // Document Management
  async createAgentDocument(agentId: string, document: DocumentInfo) {
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

    if (error) throw error
    return data
  }

  async deleteAgentDocument(documentId: string) {
    const { error } = await supabase
      .from('agent_documents')
      .delete()
      .eq('id', documentId)

    if (error) throw error
  }

  // Conversation Management
  async createConversation(userId: string, agentId: string) {
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

    if (error) throw error
    return data
  }

  async getConversations(userId: string, agentId?: string) {
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
    if (error) throw error
    return data
  }

  // Message Management
  async createMessage(conversationId: string, content: string, sender: 'user' | 'ai', attachments?: string[]) {
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

    if (error) throw error

    // Create message attachments if provided
    if (attachments && attachments.length > 0) {
      const attachmentData = attachments.map(docId => ({
        message_id: data.id,
        document_id: docId,
        attachment_type: 'reference'
      }))

      await supabase
        .from('message_attachments')
        .insert(attachmentData)
    }

    return data
  }

  async getMessages(conversationId: string) {
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

    if (error) throw error
    return data
  }
}

export const supabaseService = new SupabaseService()