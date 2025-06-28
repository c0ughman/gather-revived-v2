import { supabase } from '../lib/supabase';
import { AIContact } from '../../../core/types/types';

export class SupabaseService {
  private static instance: SupabaseService;

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // User Profile Methods
  async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user profile:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
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
          subscription_plan: 'free', // Default to free plan
          ...profileData
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in createUserProfile:', error);
      throw error;
    }
  }

  async updateUserProfilePlan(userId: string, plan: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          subscription_plan: plan,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile plan:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in updateUserProfilePlan:', error);
      throw error;
    }
  }

  // User Agents Methods
  async getUserAgents(userId: string): Promise<AIContact[]> {
    try {
      console.log('Fetching agents for user:', userId);
      
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
            metadata,
            uploaded_at
          )
        `)
        .eq('user_id', userId)
        .order('is_favorite', { ascending: false })
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user agents:', error);
        throw error;
      }

      console.log('Raw agents data:', data);

      // Transform the data to match AIContact interface
      const agents: AIContact[] = (data || []).map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        initials: agent.initials,
        color: agent.color,
        voice: agent.voice,
        avatar: agent.avatar_url,
        status: agent.status as 'online' | 'busy' | 'offline',
        lastSeen: this.formatLastSeen(agent.last_seen, agent.last_used_at),
        integrations: agent.agent_integrations?.map((integration: any) => ({
          id: integration.id,
          integrationId: integration.template_id,
          name: integration.name,
          config: integration.config,
          status: integration.status
        })),
        documents: agent.agent_documents?.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          originalFilename: doc.original_filename,
          type: doc.file_type,
          size: doc.file_size,
          content: doc.content,
          summary: doc.summary,
          metadata: doc.metadata,
          uploadedAt: new Date(doc.uploaded_at)
        }))
      }));

      console.log('Transformed agents:', agents);
      return agents;
    } catch (error) {
      console.error('Error in getUserAgents:', error);
      return [];
    }
  }

  async createUserAgent(userId: string, agentData: Partial<AIContact>) {
    try {
      const { data, error } = await supabase
        .from('user_agents')
        .insert({
          user_id: userId,
          name: agentData.name,
          description: agentData.description,
          initials: agentData.initials,
          color: agentData.color,
          voice: agentData.voice,
          avatar_url: agentData.avatar,
          status: agentData.status || 'online',
          last_seen: 'now'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user agent:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in createUserAgent:', error);
      throw error;
    }
  }

  async updateUserAgent(agentId: string, updates: Partial<AIContact>) {
    try {
      const { data, error } = await supabase
        .from('user_agents')
        .update({
          name: updates.name,
          description: updates.description,
          initials: updates.initials,
          color: updates.color,
          voice: updates.voice,
          avatar_url: updates.avatar,
          status: updates.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user agent:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in updateUserAgent:', error);
      throw error;
    }
  }

  async deleteUserAgent(agentId: string) {
    try {
      const { error } = await supabase
        .from('user_agents')
        .delete()
        .eq('id', agentId);

      if (error) {
        console.error('Error deleting user agent:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteUserAgent:', error);
      throw error;
    }
  }

  // Helper Methods
  private formatLastSeen(lastSeen: string, lastUsedAt: string | null): string {
    if (lastSeen === 'now') return 'now';
    
    if (lastUsedAt) {
      const lastUsed = new Date(lastUsedAt);
      const now = new Date();
      const diffMs = now.getTime() - lastUsed.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return lastUsed.toLocaleDateString();
    }

    return lastSeen;
  }

  // Test connection
  async testConnection() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Database connection test failed:', error);
        return false;
      }

      console.log('Database connection test successful');
      return true;
    } catch (error) {
      console.error('Database connection test error:', error);
      return false;
    }
  }

  // Create a subscription record
  async createUserSubscription(userId: string, planId: string) {
    try {
      // First update the user profile
      await this.updateUserProfilePlan(userId, planId);
      
      // Then create a subscription record
      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user subscription:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in createUserSubscription:', error);
      throw error;
    }
  }

  // Get user subscription
  async getUserSubscription(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user subscription:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      return null;
    }
  }

  // Get all agent context
  async getAllAgentContext(agentId: string): Promise<{
    permanentDocuments: any[];
    conversationDocuments: any[];
  }> {
    // This is a placeholder implementation
    return {
      permanentDocuments: [],
      conversationDocuments: []
    };
  }
}

export const supabaseService = new SupabaseService.getInstance();