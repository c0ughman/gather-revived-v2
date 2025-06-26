import { oauthService } from './oauthService';
import { getOAuthConfig } from '../data/oauthConfigs';

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
  /**
   * Get user's Notion pages
   */
  async getPages(userId: string, clientId: string, clientSecret: string): Promise<NotionPage[]> {
    const config = getOAuthConfig('notion', clientId, clientSecret, '');
    const token = await oauthService.getToken(userId, 'notion');
    
    if (!token) {
      throw new Error('Notion not connected. Please connect your Notion account first.');
    }

    const validToken = await oauthService.ensureValidToken(config, token);

    const response = await oauthService.makeAuthenticatedRequest(
      config,
      validToken,
      'https://api.notion.com/v1/search',
      {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            property: 'object',
            value: 'page'
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time'
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Notion pages: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.results.map((page: any) => ({
      id: page.id,
      title: this.extractPageTitle(page),
      url: page.url,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      properties: page.properties
    }));
  }

  /**
   * Get user's Notion databases
   */
  async getDatabases(userId: string, clientId: string, clientSecret: string): Promise<NotionDatabase[]> {
    const config = getOAuthConfig('notion', clientId, clientSecret, '');
    const token = await oauthService.getToken(userId, 'notion');
    
    if (!token) {
      throw new Error('Notion not connected. Please connect your Notion account first.');
    }

    const validToken = await oauthService.ensureValidToken(config, token);

    const response = await oauthService.makeAuthenticatedRequest(
      config,
      validToken,
      'https://api.notion.com/v1/search',
      {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            property: 'object',
            value: 'database'
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time'
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Notion databases: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.results.map((db: any) => ({
      id: db.id,
      title: this.extractDatabaseTitle(db),
      url: db.url,
      lastEditedTime: db.last_edited_time,
      createdTime: db.created_time,
      properties: db.properties
    }));
  }

  /**
   * Get page content
   */
  async getPageContent(userId: string, clientId: string, clientSecret: string, pageId: string): Promise<string> {
    const config = getOAuthConfig('notion', clientId, clientSecret, '');
    const token = await oauthService.getToken(userId, 'notion');
    
    if (!token) {
      throw new Error('Notion not connected. Please connect your Notion account first.');
    }

    const validToken = await oauthService.ensureValidToken(config, token);

    // Get page blocks
    const response = await oauthService.makeAuthenticatedRequest(
      config,
      validToken,
      `https://api.notion.com/v1/blocks/${pageId}/children`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch page content: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract text content from blocks
    return this.extractTextFromBlocks(data.results);
  }

  /**
   * Create a new page
   */
  async createPage(
    userId: string, 
    clientId: string, 
    clientSecret: string, 
    parentId: string, 
    title: string, 
    content?: string
  ): Promise<NotionPage> {
    const config = getOAuthConfig('notion', clientId, clientSecret, '');
    const token = await oauthService.getToken(userId, 'notion');
    
    if (!token) {
      throw new Error('Notion not connected. Please connect your Notion account first.');
    }

    const validToken = await oauthService.ensureValidToken(config, token);

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

    // Add content blocks if provided
    if (content) {
      pageData.children = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: content
                }
              }
            ]
          }
        }
      ];
    }

    const response = await oauthService.makeAuthenticatedRequest(
      config,
      validToken,
      'https://api.notion.com/v1/pages',
      {
        method: 'POST',
        body: JSON.stringify(pageData)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create page: ${response.status} ${response.statusText}`);
    }

    const page = await response.json();
    
    return {
      id: page.id,
      title: this.extractPageTitle(page),
      url: page.url,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      properties: page.properties
    };
  }

  /**
   * Update page properties
   */
  async updatePage(
    userId: string, 
    clientId: string, 
    clientSecret: string, 
    pageId: string, 
    properties: any
  ): Promise<NotionPage> {
    const config = getOAuthConfig('notion', clientId, clientSecret, '');
    const token = await oauthService.getToken(userId, 'notion');
    
    if (!token) {
      throw new Error('Notion not connected. Please connect your Notion account first.');
    }

    const validToken = await oauthService.ensureValidToken(config, token);

    const response = await oauthService.makeAuthenticatedRequest(
      config,
      validToken,
      `https://api.notion.com/v1/pages/${pageId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          properties
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update page: ${response.status} ${response.statusText}`);
    }

    const page = await response.json();
    
    return {
      id: page.id,
      title: this.extractPageTitle(page),
      url: page.url,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      properties: page.properties
    };
  }

  /**
   * Query database
   */
  async queryDatabase(
    userId: string, 
    clientId: string, 
    clientSecret: string, 
    databaseId: string, 
    filter?: any,
    sorts?: any[]
  ): Promise<any[]> {
    const config = getOAuthConfig('notion', clientId, clientSecret, '');
    const token = await oauthService.getToken(userId, 'notion');
    
    if (!token) {
      throw new Error('Notion not connected. Please connect your Notion account first.');
    }

    const validToken = await oauthService.ensureValidToken(config, token);

    const queryData: any = {};
    if (filter) queryData.filter = filter;
    if (sorts) queryData.sorts = sorts;

    const response = await oauthService.makeAuthenticatedRequest(
      config,
      validToken,
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: 'POST',
        body: JSON.stringify(queryData)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to query database: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.results;
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
    return 'Untitled';
  }

  /**
   * Extract database title from Notion database object
   */
  private extractDatabaseTitle(database: any): string {
    if (database.title?.[0]?.text?.content) {
      return database.title[0].text.content;
    }
    return 'Untitled Database';
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