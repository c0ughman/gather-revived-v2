import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient;

  private constructor() {
    this.client = supabase;
  }

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Auth methods
  async signUp(email: string, password: string) {
    try {
      console.log('🔐 Attempting to sign up user:', email);
      
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('❌ Supabase signup error:', error);
        throw error;
      }

      console.log('✅ User signed up successfully:', data.user?.email);
      return data;
    } catch (error) {
      console.error('❌ Sign up error:', error);
      throw error;
    }
  }

  async signIn(email: string, password: string) {
    try {
      console.log('🔐 Attempting to sign in user:', email);
      
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ Supabase signin error:', error);
        throw error;
      }

      console.log('✅ User signed in successfully:', data.user?.email);
      return data;
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      console.log('🔐 Signing out user...');
      
      const { error } = await this.client.auth.signOut();
      
      if (error) {
        console.error('❌ Sign out error:', error);
        throw error;
      }

      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await this.client.auth.getUser();
      
      if (error) {
        console.error('❌ Error getting current user:', error);
        return null;
      }

      return user;
    } catch (error) {
      console.error('❌ Error getting current user:', error);
      return null;
    }
  }

  // User profile methods
  async getUserProfile(userId: string) {
    try {
      console.log('👤 Fetching user profile for:', userId);
      
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        throw error;
      }

      console.log('✅ User profile fetched successfully');
      return data;
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      throw error;
    }
  }

  async createUserProfile(userId: string, profileData: any) {
    try {
      console.log('👤 Creating user profile for:', userId);
      
      const { data, error } = await this.client
        .from('user_profiles')
        .insert({
          id: userId,
          ...profileData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user profile:', error);
        throw error;
      }

      console.log('✅ User profile created successfully');
      return data;
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw error;
    }
  }

  // User agents methods
  async getUserAgents(userId: string) {
    try {
      console.log('🤖 Fetching user agents for:', userId);
      
      const { data, error } = await this.client
        .rpc('get_user_agents', { p_user_id: userId });

      if (error) {
        console.error('❌ Error fetching user agents:', error);
        // Fallback to direct query if RPC fails
        const { data: fallbackData, error: fallbackError } = await this.client
          .from('user_agents')
          .select('*')
          .eq('user_id', userId)
          .order('is_favorite', { ascending: false })
          .order('last_used_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          throw fallbackError;
        }

        console.log('✅ User agents fetched successfully (fallback)');
        return fallbackData || [];
      }

      console.log('✅ User agents fetched successfully');
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching user agents:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async createUserAgent(agentData: any) {
    try {
      console.log('🤖 Creating user agent:', agentData.name);
      
      const { data, error } = await this.client
        .from('user_agents')
        .insert({
          ...agentData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user agent:', error);
        throw error;
      }

      console.log('✅ User agent created successfully');
      return data;
    } catch (error) {
      console.error('❌ Error creating user agent:', error);
      throw error;
    }
  }

  async updateUserAgent(agentId: string, updates: any) {
    try {
      console.log('🤖 Updating user agent:', agentId);
      
      const { data, error } = await this.client
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

      console.log('✅ User agent updated successfully');
      return data;
    } catch (error) {
      console.error('❌ Error updating user agent:', error);
      throw error;
    }
  }

  async deleteUserAgent(agentId: string) {
    try {
      console.log('🤖 Deleting user agent:', agentId);
      
      const { error } = await this.client
        .from('user_agents')
        .delete()
        .eq('id', agentId);

      if (error) {
        console.error('❌ Error deleting user agent:', error);
        throw error;
      }

      console.log('✅ User agent deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting user agent:', error);
      throw error;
    }
  }

  // Usage and subscription methods
  async getUserUsage(userId: string) {
    try {
      console.log('📊 Fetching user usage for:', userId);
      
      const { data, error } = await this.client
        .from('user_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching user usage:', error);
        throw error;
      }

      console.log('✅ User usage fetched successfully');
      return data;
    } catch (error) {
      console.error('❌ Error fetching user usage:', error);
      throw error;
    }
  }

  async getUserSubscription(userId: string) {
    try {
      console.log('💳 Fetching user subscription for:', userId);
      
      const { data, error } = await this.client
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching user subscription:', error);
        throw error;
      }

      console.log('✅ User subscription fetched successfully');
      return data;
    } catch (error) {
      console.error('❌ Error fetching user subscription:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('count')
        .limit(1);

      if (error) {
        console.error('❌ Database health check failed:', error);
        return false;
      }

      console.log('✅ Database health check passed');
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }

  // Get the Supabase client for direct access
  getClient() {
    return this.client;
  }
}

export const supabaseService = SupabaseService.getInstance();