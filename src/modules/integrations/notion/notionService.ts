import { supabase } from '../../database/lib/supabase';
import { secureTokenService } from '../../../core/services/secureTokenService';

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
  createdTime: string;
  properties?: any;
  content?: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
  createdTime: string;
  properties: any;
}

class NotionService {
  private readonly functionUrl: string;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is required');
    }
    this.functionUrl = `${supabaseUrl}/functions/v1/notion-oauth`;
  }

  /**
   * Get stored authorization data for a user
   */
  private getNotionAuthData(userId: string): any | null {
    const connectionKey = `oauth_connected_notion_${userId}`;
    const isConnected = localStorage.getItem(connectionKey) === 'true';
    
    if (!isConnected) {
      throw new Error('Notion not connected. Please connect your Notion account first.');
    }
    
    const authKey = `oauth_auth_notion_${userId}`;
    const authData = localStorage.getItem(authKey);
    
    if (authData) {
      try {
        return JSON.parse(authData);
      } catch (error) {
        console.error('Failed to parse auth data:', error);
        throw new Error('Invalid Notion authorization data. Please reconnect your account.');
      }
    }
    
    throw new Error('No Notion authorization data found. Please reconnect your account.');
  }

  /**
   * Call Supabase Edge Function
   */
  private async callEdgeFunction(payload: any): Promise<any> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Edge function failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Edge function returned error');
      }

      return result;
    } catch (error) {
      console.error('❌ Edge function call failed:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token via Supabase Edge Function
   */
  private async exchangeCodeForToken(code: string, userId: string): Promise<string> {
    console.log('🔄 Exchanging code for token via Supabase Edge Function...');
    
    try {
      const result = await this.callEdgeFunction({
        action: 'exchange_token',
        code: code,
        user_id: userId
      });

      console.log('✅ Token exchange successful via Supabase');
      console.log(`🏢 Workspace: ${result.workspace_name}`);
      
      // Store token securely (no localStorage)
      await secureTokenService.storeToken(userId, 'notion', {
        access_token: result.access_token,
        workspace_name: result.workspace_name,
        workspace_id: result.workspace_id,
        bot_id: result.bot_id
      });
      
      return result.access_token;
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      throw new Error(`Token exchange failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get stored access token securely
   */
  private async getAccessToken(userId: string): Promise<string> {
    console.log('🔍 Getting access token for user:', userId);
    
    const token = await secureTokenService.getToken(userId, 'notion');
    
    if (!token) {
      // Fallback: try to exchange the authorization code if we have it
      try {
        console.log('🔄 No stored token, attempting to exchange authorization code...');
        const authData = this.getNotionAuthData(userId);
        
        if (authData.code) {
          console.log('📝 Found authorization code, exchanging for token...');
          return await this.exchangeCodeForToken(authData.code, userId);
        } else {
          throw new Error('No authorization code found');
        }
      } catch (exchangeError) {
        console.error('❌ Token exchange failed:', exchangeError);
        throw new Error('Unable to get access token. Please reconnect your Notion account.');
      }
    }
    
    return token;
  }

  /**
   * Make authenticated request to Notion API via Supabase Edge Function
   */
  async makeNotionRequest(userId: string, url: string, method: string = 'GET', body?: any): Promise<any> {
    console.log(`🌐 Making Notion API request via Supabase: ${method} ${url}`);
    
    const accessToken = await this.getAccessToken(userId);
    
    try {
      const result = await this.callEdgeFunction({
        action: 'api_request',
        url,
        method,
        body,
        access_token: accessToken,
        user_id: userId
      });

      console.log('🔍 Edge function result:', result);
      console.log('🔍 Edge function result.data:', result.data);
      
      if (!result.data) {
        console.error('❌ No data in Edge function response:', result);
        throw new Error('Invalid response from Edge function: missing data field');
      }

      return result.data;
    } catch (error) {
      console.error('❌ Notion API request failed:', error);
      throw error;
    }
  }

  /**
   * Get user's Notion pages - REAL API CALLS via Supabase
   */
  async getPages(userId: string, clientId: string, clientSecret: string): Promise<NotionPage[]> {
    const response = await this.makeNotionRequest(userId, 'https://api.notion.com/v1/search', 'POST', {
      filter: {
        property: 'object',
        value: 'page'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    });

    console.log('🔍 getPages response:', response);
    
    if (!response || !response.results) {
      console.error('❌ Invalid response structure for getPages:', response);
      throw new Error('Invalid response from Notion API: missing results array');
    }

    return response.results.map((page: any) => ({
      id: page.id,
      title: this.extractPageTitle(page),
      url: page.url,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      properties: page.properties
    }));
  }

  /**
   * Get user's Notion databases - REAL API CALLS via Supabase
   */
  async getDatabases(userId: string, clientId: string, clientSecret: string): Promise<NotionDatabase[]> {
    const response = await this.makeNotionRequest(userId, 'https://api.notion.com/v1/search', 'POST', {
      filter: {
        property: 'object',
        value: 'database'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    });

    console.log('🔍 getDatabases response:', response);
    
    if (!response || !response.results) {
      console.error('❌ Invalid response structure for getDatabases:', response);
      throw new Error('Invalid response from Notion API: missing results array');
    }

    return response.results.map((db: any) => ({
      id: db.id,
      title: this.extractDatabaseTitle(db),
      url: db.url,
      lastEditedTime: db.last_edited_time,
      createdTime: db.created_time,
      properties: db.properties
    }));
  }

  /**
   * Get page content - REAL API CALLS via Supabase
   */
  async getPageContent(userId: string, clientId: string, clientSecret: string, pageId: string): Promise<string> {
    const response = await this.makeNotionRequest(userId, `https://api.notion.com/v1/blocks/${pageId}/children`);
    return this.extractTextFromBlocks(response.results);
  }

  /**
   * Create a new page - REAL API CALLS via Supabase
   */
  async createPage(
    userId: string, 
    clientId: string, 
    clientSecret: string, 
    parentId: string, 
    title: string, 
    content?: string
  ): Promise<NotionPage> {
    const pageData: any = {
      parent: {
        page_id: parentId
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title
              }
            }
          ]
        }
      }
    };

    if (content) {
      pageData.children = this.textToBlocks(content);
    }

    const response = await this.makeNotionRequest(userId, 'https://api.notion.com/v1/pages', 'POST', pageData);
    
    return {
      id: response.id,
      title: this.extractPageTitle(response),
      url: response.url,
      lastEditedTime: response.last_edited_time,
      createdTime: response.created_time,
      properties: response.properties
    };
  }

  /**
   * Update page properties - REAL API CALLS via Supabase
   */
  async updatePage(
    userId: string, 
    clientId: string, 
    clientSecret: string, 
    pageId: string, 
    properties: any
  ): Promise<NotionPage> {
    const response = await this.makeNotionRequest(
      userId,
      `https://api.notion.com/v1/pages/${pageId}`, 
      'PATCH', 
      { properties }
    );
    
    return {
      id: response.id,
      title: this.extractPageTitle(response),
      url: response.url,
      lastEditedTime: response.last_edited_time,
      createdTime: response.created_time,
      properties: response.properties
    };
  }

  /**
   * Query database - REAL API CALLS via Supabase
   */
  async queryDatabase(
    userId: string, 
    clientId: string, 
    clientSecret: string, 
    databaseId: string, 
    filter?: any,
    sorts?: any[]
  ): Promise<any[]> {
    const queryData: any = {};
    if (filter) queryData.filter = filter;
    if (sorts) queryData.sorts = sorts;

    const response = await this.makeNotionRequest(
      userId,
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      'POST',
      queryData
    );
    
    return response.results;
  }

  /**
   * Search for pages with query - REAL API CALLS via Supabase
   */
  async searchPages(userId: string, clientId: string, clientSecret: string, query: string): Promise<NotionPage[]> {
    const response = await this.makeNotionRequest(userId, 'https://api.notion.com/v1/search', 'POST', {
      query: query,
      filter: {
        property: 'object',
        value: 'page'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: this.extractPageTitle(page),
      url: page.url,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      properties: page.properties
    }));
  }

  /**
   * Search for databases with query - REAL API CALLS via Supabase
   */
  async searchDatabases(userId: string, clientId: string, clientSecret: string, query: string): Promise<NotionDatabase[]> {
    const response = await this.makeNotionRequest(userId, 'https://api.notion.com/v1/search', 'POST', {
      query: query,
      filter: {
        property: 'object',
        value: 'database'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    });

    return response.results.map((db: any) => ({
      id: db.id,
      title: this.extractDatabaseTitle(db),
      url: db.url,
      lastEditedTime: db.last_edited_time,
      createdTime: db.created_time,
      properties: db.properties
    }));
  }

  /**
   * Append blocks to a page - REAL API CALLS via Supabase
   */
  async appendBlocks(userId: string, clientId: string, clientSecret: string, pageId: string, blocks: any[]): Promise<any> {
    const response = await this.makeNotionRequest(
      userId,
      `https://api.notion.com/v1/blocks/${pageId}/children`,
      'PATCH',
      { children: blocks }
    );
    
    return response;
  }

  /**
   * Revoke stored token
   */
  async revokeToken(userId: string): Promise<void> {
    console.log('🗑️ Revoking Notion token...');
    
    try {
      await this.callEdgeFunction({
        action: 'revoke_token',
        user_id: userId
      });

      // Clear localStorage cache
      await secureTokenService.removeToken(userId, 'notion');
      localStorage.removeItem(`oauth_connected_notion_${userId}`);
      localStorage.removeItem(`oauth_auth_notion_${userId}`);

      console.log('✅ Token revoked successfully');
    } catch (error) {
      console.error('❌ Failed to revoke token:', error);
      throw error;
    }
  }

  /**
   * Convert text content to Notion blocks
   */
  textToBlocks(content: string): any[] {
    const lines = content.split('\n');
    const blocks = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      if (trimmedLine.startsWith('# ')) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.substring(2) } }]
          }
        });
      } else if (trimmedLine.startsWith('## ')) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.substring(3) } }]
          }
        });
      } else if (trimmedLine.startsWith('### ')) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.substring(4) } }]
          }
        });
      } else if (trimmedLine.startsWith('• ') || trimmedLine.startsWith('- ')) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.substring(2) } }]
          }
        });
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        blocks.push({
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.replace(/^\d+\.\s/, '') } }]
          }
        });
      } else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: trimmedLine } }]
          }
        });
      }
    }
    
    return blocks;
  }

  /**
   * Extract page title from Notion page object
   */
  private extractPageTitle(page: any): string {
    if (page.properties?.title?.title?.[0]?.text?.content) {
      return page.properties.title.title[0].text.content;
    }
    if (page.properties?.Name?.title?.[0]?.text?.content) {
      return page.properties.Name.title[0].text.content;
    }
    return page.id || 'Untitled';
  }

  /**
   * Extract database title from Notion database object
   */
  private extractDatabaseTitle(database: any): string {
    if (database.title?.[0]?.text?.content) {
      return database.title[0].text.content;
    }
    return database.id || 'Untitled Database';
  }

  /**
   * Extract text content from Notion blocks
   */
  private extractTextFromBlocks(blocks: any[]): string {
    let content = '';
    
    for (const block of blocks) {
      if (block.type === 'paragraph' && block.paragraph?.rich_text) {
        const text = block.paragraph.rich_text
          .map((rt: any) => rt.text?.content || '')
          .join('');
        content += text + '\n\n';
      } else if (block.type === 'heading_1' && block.heading_1?.rich_text) {
        const text = block.heading_1.rich_text
          .map((rt: any) => rt.text?.content || '')
          .join('');
        content += `# ${text}\n\n`;
      } else if (block.type === 'heading_2' && block.heading_2?.rich_text) {
        const text = block.heading_2.rich_text
          .map((rt: any) => rt.text?.content || '')
          .join('');
        content += `## ${text}\n\n`;
      } else if (block.type === 'heading_3' && block.heading_3?.rich_text) {
        const text = block.heading_3.rich_text
          .map((rt: any) => rt.text?.content || '')
          .join('');
        content += `### ${text}\n\n`;
      } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
        const text = block.bulleted_list_item.rich_text
          .map((rt: any) => rt.text?.content || '')
          .join('');
        content += `• ${text}\n`;
      } else if (block.type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
        const text = block.numbered_list_item.rich_text
          .map((rt: any) => rt.text?.content || '')
          .join('');
        content += `1. ${text}\n`;
      }
    }
    
    return content.trim();
  }
}

export const notionService = new NotionService();