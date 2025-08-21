/**
 * Conversation History Service
 * 
 * Manages conversation sessions and messages using database storage
 * Agent-specific past chats with search functionality
 */

import { supabase } from '../../modules/database/lib/supabase';

export interface ConversationSession {
  id: string;
  agent_id: string;
  user_id: string;
  title: string | null;
  conversation_type: 'chat' | 'voice' | 'mixed';
  message_count: number;
  total_tokens: number;
  duration_seconds: number;
  started_at: string;
  last_message_at: string;
  ended_at: string | null;
  is_starred: boolean;
  is_archived: boolean;
  tags: string[] | null;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  message_type: 'text' | 'voice' | 'system' | 'function_call' | 'function_result';
  token_count: number;
  word_count: number;
  function_name: string | null;
  function_args: any;
  function_result: any;
  audio_duration_seconds: number | null;
  transcription_confidence: number | null;
  attachments: any[];
  context_used: any;
  created_at: string;
}

export interface ConversationPreview {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  lastMessageAt: Date;
  conversationType: 'chat' | 'voice' | 'mixed';
  isStarred: boolean;
  searchMatch?: {
    text: string;
    highlighted: string;
  };
}

class ConversationHistoryService {
  
  /**
   * Get all conversation sessions for a specific agent
   */
  async getAgentConversations(agentId: string, limit = 50): Promise<ConversationSession[]> {
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching agent conversations:', error);
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return data as ConversationSession[];
  }

  /**
   * Search conversations for a specific agent
   */
  async searchAgentConversations(agentId: string, query: string): Promise<ConversationSession[]> {
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_archived', false)
      .or(`title.ilike.%${query}%`)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error searching agent conversations:', error);
      throw new Error(`Failed to search conversations: ${error.message}`);
    }

    return data as ConversationSession[];
  }

  /**
   * Get messages for a specific conversation session
   */
  async getSessionMessages(sessionId: string): Promise<ConversationMessage[]> {
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching session messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data as ConversationMessage[];
  }

  /**
   * Search messages within an agent's conversations
   */
  async searchAgentMessages(agentId: string, query: string): Promise<ConversationSession[]> {
    try {
      // Use ilike for case-insensitive search instead of textSearch to avoid PostgreSQL syntax issues
      const { data: sessionsWithMatches, error } = await supabase
        .from('conversation_messages')
        .select(`
          session_id,
          conversation_sessions!inner(*)
        `)
        .ilike('content', `%${query}%`)
        .eq('conversation_sessions.agent_id', agentId)
        .eq('conversation_sessions.is_archived', false);

      if (error) {
        console.error('Error searching agent messages:', error);
        return [];
      }

      // Extract unique sessions and format
      const uniqueSessions = new Map();
      sessionsWithMatches?.forEach((item: any) => {
        const session = item.conversation_sessions;
        if (!uniqueSessions.has(session.id)) {
          uniqueSessions.set(session.id, session);
        }
      });

      return Array.from(uniqueSessions.values()) as ConversationSession[];
    } catch (error) {
      console.error('Error in searchAgentMessages:', error);
      return [];
    }
  }

  /**
   * Create conversation previews from sessions
   */
  async createConversationPreviews(sessions: ConversationSession[], searchQuery?: string): Promise<ConversationPreview[]> {
    const previews: ConversationPreview[] = [];

    for (const session of sessions) {
      // Get first few messages for preview
      const { data: messages, error: messagesError } = await supabase
        .from('conversation_messages')
        .select('content, role, created_at')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })
        .limit(4);

      if (messagesError) {
        console.error(`❌ Error loading messages for session ${session.id}:`, messagesError);
        continue; // Skip this session but continue with others
      }

      const preview = this.generatePreviewText(messages || []);
      let searchMatch: ConversationPreview['searchMatch'] = undefined;

      // If searching, find matches in messages
      if (searchQuery && messages) {
        searchMatch = this.findSearchMatch(messages, searchQuery);
      }

      previews.push({
        id: session.id,
        title: session.title || 'Untitled Conversation',
        preview,
        messageCount: session.message_count,
        lastMessageAt: new Date(session.last_message_at),
        conversationType: session.conversation_type,
        isStarred: session.is_starred,
        searchMatch
      });
    }

    return previews;
  }

  /**
   * Generate preview text from messages
   */
  private generatePreviewText(messages: any[]): string {
    if (!messages || messages.length === 0) return 'No messages';

    const previews = messages.slice(0, 4).map(msg => {
      const sender = msg.role === 'user' ? 'You' : 'AI';
      const content = msg.content.substring(0, 100);
      return `${sender}: ${content}${msg.content.length > 100 ? '...' : ''}`;
    });

    return previews.join(' | ');
  }

  /**
   * Find search matches in messages
   */
  private findSearchMatch(messages: any[], searchQuery: string): ConversationPreview['searchMatch'] | undefined {
    const searchTerm = searchQuery.toLowerCase();
    
    for (const message of messages) {
      const content = message.content.toLowerCase();
      const index = content.indexOf(searchTerm);
      
      if (index !== -1) {
        // Extract context around the match
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + searchTerm.length + 50);
        
        let contextText = message.content.substring(start, end);
        
        // Add ellipsis if truncated
        if (start > 0) contextText = '...' + contextText;
        if (end < content.length) contextText = contextText + '...';
        
        // Create highlighted version
        const highlightedText = this.highlightSearchTerm(contextText, searchQuery);
        
        return {
          text: contextText,
          highlighted: highlightedText
        };
      }
    }
    
    return undefined;
  }

  /**
   * Highlight search terms in text
   */
  private highlightSearchTerm(text: string, searchQuery: string): string {
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>');
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(date: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Star/unstar a conversation
   */
  async toggleConversationStar(sessionId: string, isStarred: boolean): Promise<void> {
    const { error } = await supabase
      .from('conversation_sessions')
      .update({ is_starred: isStarred })
      .eq('id', sessionId);

    if (error) {
      console.error('Error toggling conversation star:', error);
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_sessions')
      .update({ is_archived: true })
      .eq('id', sessionId);

    if (error) {
      console.error('Error archiving conversation:', error);
      throw new Error(`Failed to archive conversation: ${error.message}`);
    }
  }
}

export const conversationHistoryService = new ConversationHistoryService();