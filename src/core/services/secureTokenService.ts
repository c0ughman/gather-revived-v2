/**
 * Secure Token Service
 * Manages OAuth tokens securely without localStorage exposure
 */

import { supabase } from '../../modules/database/lib/supabase';

interface TokenInfo {
  access_token: string;
  workspace_name?: string;
  workspace_id?: string;
  bot_id?: string;
  refresh_token?: string;
  expires_at?: number;
  provider: string;
}

class SecureTokenService {
  // In-memory cache for current session only (not persistent)
  private sessionCache = new Map<string, TokenInfo>();
  
  /**
   * Store token securely in database only
   */
  async storeToken(userId: string, provider: string, tokenInfo: Omit<TokenInfo, 'provider'>): Promise<void> {
    console.log(`🔐 Securely storing ${provider} token for user:`, userId);
    
    try {
      const tokenData = {
        ...tokenInfo,
        provider,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('oauth_tokens')
        .upsert(tokenData, {
          onConflict: 'user_id,provider'
        });

      if (error) {
        throw new Error(`Failed to store token: ${error.message}`);
      }

      // Cache in memory for current session only
      const cacheKey = `${userId}_${provider}`;
      this.sessionCache.set(cacheKey, { ...tokenInfo, provider });
      
      console.log(`✅ Token stored securely for ${provider}`);
    } catch (error) {
      console.error(`❌ Failed to store ${provider} token:`, error);
      throw error;
    }
  }

  /**
   * Retrieve token securely from database
   */
  async getToken(userId: string, provider: string): Promise<string | null> {
    console.log(`🔍 Retrieving ${provider} token for user:`, userId);
    
    const cacheKey = `${userId}_${provider}`;
    
    // Check session cache first (fast)
    if (this.sessionCache.has(cacheKey)) {
      const cached = this.sessionCache.get(cacheKey)!;
      
      // Check if token is expired
      if (cached.expires_at && cached.expires_at < Date.now()) {
        console.log('⚠️ Cached token expired, removing from cache');
        this.sessionCache.delete(cacheKey);
      } else {
        console.log('✅ Using cached token');
        return cached.access_token;
      }
    }

    try {
      const { data, error } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error || !data) {
        console.log(`ℹ️ No ${provider} token found for user`);
        return null;
      }

      // Check if token is expired
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        console.log('⚠️ Database token expired');
        await this.removeToken(userId, provider);
        return null;
      }

      // Cache in memory for current session
      this.sessionCache.set(cacheKey, {
        access_token: data.access_token,
        workspace_name: data.workspace_name,
        workspace_id: data.workspace_id,
        bot_id: data.bot_id,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at ? new Date(data.expires_at).getTime() : undefined,
        provider: data.provider
      });

      console.log(`✅ Retrieved ${provider} token from database`);
      return data.access_token;
    } catch (error) {
      console.error(`❌ Failed to retrieve ${provider} token:`, error);
      return null;
    }
  }

  /**
   * Remove token securely
   */
  async removeToken(userId: string, provider: string): Promise<void> {
    console.log(`🗑️ Removing ${provider} token for user:`, userId);
    
    try {
      const { error } = await supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider);

      if (error) {
        throw new Error(`Failed to remove token: ${error.message}`);
      }

      // Remove from session cache
      const cacheKey = `${userId}_${provider}`;
      this.sessionCache.delete(cacheKey);
      
      console.log(`✅ Token removed securely for ${provider}`);
    } catch (error) {
      console.error(`❌ Failed to remove ${provider} token:`, error);
      throw error;
    }
  }

  /**
   * Clear all cached tokens for user (call on logout)
   */
  clearUserTokens(userId: string): void {
    console.log('🧹 Clearing cached tokens for user:', userId);
    
    for (const [key] of this.sessionCache) {
      if (key.startsWith(`${userId}_`)) {
        this.sessionCache.delete(key);
      }
    }
  }

  /**
   * Clear all session cache (call on app shutdown)
   */
  clearAllCache(): void {
    console.log('🧹 Clearing all token cache');
    this.sessionCache.clear();
  }
}

export const secureTokenService = new SecureTokenService();