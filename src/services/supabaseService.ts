import { supabase } from '../lib/supabase'
import { AIContact, DocumentInfo } from '../types'

export class SupabaseService {
  // User Agents
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
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
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
        status: agent.status || 'online'
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

  async deleteAgentIntegration(integrationId: string) {
    const { error } = await supabase
      .from('agent_integrations')
      .delete()
      .eq('id', integrationId)

    if (error) throw error
  }

  // Agent Documents
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
        metadata: document.metadata || {}
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
}

export const supabaseService = new SupabaseService()