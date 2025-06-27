import { supabase } from '../lib/supabase'
import { AIContact } from '../../../core/types/types'
import { DocumentInfo } from '../../fileManagement/types/documents'

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

  // Document Retrieval Methods for Chat and Voice
  async getAgentDocuments(agentId: string): Promise<DocumentInfo[]> {
    const { data, error } = await supabase
      .from('agent_documents')
      .select('*')
      .eq('agent_id', agentId)
      .order('uploaded_at', { ascending: false })

    if (error) throw error

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
    }))
  }

  async getDocumentById(documentId: string): Promise<DocumentInfo | null> {
    const { data, error } = await supabase
      .from('agent_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (error) {
      console.error('Error fetching document:', error)
      return null
    }

    if (!data) return null

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
    }
  }

  // Conversation Documents Management
  async saveConversationDocument(agentId: string, document: DocumentInfo): Promise<string> {
    // Save conversation documents temporarily (could be in a separate table)
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
          conversation_document: true, // Mark as conversation document
          uploaded_in_conversation: true
        }
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  }

  async getConversationDocuments(agentId: string): Promise<DocumentInfo[]> {
    const { data, error } = await supabase
      .from('agent_documents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('metadata->conversation_document', true)
      .order('uploaded_at', { ascending: false })

    if (error) throw error

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
    }))
  }

  // Enhanced method to get all relevant documents for context building
  async getAllAgentContext(agentId: string): Promise<{
    permanentDocuments: DocumentInfo[]
    conversationDocuments: DocumentInfo[]
  }> {
    const [permanent, conversation] = await Promise.all([
      this.getAgentDocuments(agentId),
      this.getConversationDocuments(agentId)
    ])

    const permanentDocuments = permanent.filter(doc => !doc.metadata?.conversation_document)
    const conversationDocuments = conversation

    return {
      permanentDocuments,
      conversationDocuments
    }
  }
}

export const supabaseService = new SupabaseService()