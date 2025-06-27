/**
 * Notion Data Formatter - Convert raw Notion API responses into human-friendly format
 * while preserving the technical IDs needed for operations
 */

export interface HumanFriendlyPage {
  // Human-readable info (for AI conversation)
  title: string;
  summary: string;
  lastModified: string;
  type: 'page' | 'database_entry';
  icon?: string;
  
  // Technical info (hidden from AI, used for operations)
  _internal: {
    id: string;
    url: string;
    parent: any;
    properties: any;
    rawData: any;
  };
}

export interface HumanFriendlyDatabase {
  // Human-readable info
  name: string;
  description: string;
  entryCount?: number;
  lastModified: string;
  
  // Technical info
  _internal: {
    id: string;
    url: string;
    properties: any;
    rawData: any;
  };
}

export interface NotionWorkspaceSummary {
  workspaceName: string;
  totalPages: number;
  totalDatabases: number;
  recentPages: HumanFriendlyPage[];
  databases: HumanFriendlyDatabase[];
  summary: string;
}

class NotionDataFormatter {
  
  /**
   * Format a single Notion page for human conversation
   */
  formatPage(rawPage: any): HumanFriendlyPage {
    const title = this.extractPageTitle(rawPage);
    const isDbEntry = rawPage.parent?.type === 'database_id';
    
    // Create a meaningful summary
    let summary = '';
    if (isDbEntry) {
      summary = this.createDatabaseEntryDescription(rawPage);
    } else {
      summary = `A ${rawPage.parent?.type === 'workspace' ? 'workspace' : 'nested'} page`;
      if (rawPage.icon?.emoji) summary += ` ${rawPage.icon.emoji}`;
    }
    
    // Format last modified time
    const lastModified = this.formatDate(rawPage.last_edited_time);
    
    return {
      title: title || 'Untitled',
      summary,
      lastModified,
      type: isDbEntry ? 'database_entry' : 'page',
      icon: rawPage.icon?.emoji,
      _internal: {
        id: rawPage.id,
        url: rawPage.url,
        parent: rawPage.parent,
        properties: rawPage.properties,
        rawData: rawPage
      }
    };
  }

  /**
   * Format database entries into a meaningful description
   */
  private createDatabaseEntryDescription(rawPage: any): string {
    const parts: string[] = [];
    
    // Look for meaningful properties
    Object.entries(rawPage.properties || {}).forEach(([key, value]: [string, any]) => {
      if (key.toLowerCase() === 'title') return; // Skip title as it's already extracted
      
      if (value?.type === 'select' && value.select?.name) {
        parts.push(`${key}: ${value.select.name}`);
      } else if (value?.type === 'multi_select' && value.multi_select?.length > 0) {
        const tags = value.multi_select.map((tag: any) => tag.name).join(', ');
        parts.push(`${key}: ${tags}`);
      } else if (value?.type === 'date' && value.date?.start) {
        parts.push(`${key}: ${this.formatDate(value.date.start)}`);
      } else if (value?.type === 'number' && value.number !== null) {
        parts.push(`${key}: ${value.number}`);
      }
    });
    
    return parts.length > 0 
      ? `Database entry with ${parts.join(', ')}` 
      : 'A database entry';
  }

  /**
   * Format a collection of pages into a workspace summary
   */
  formatWorkspaceSummary(
    rawData: any, 
    workspaceName: string,
    includeDbEntries: boolean = false
  ): NotionWorkspaceSummary {
    const allPages = rawData.results || [];
    
    // Separate actual pages from database entries
    const actualPages = allPages.filter((page: any) => 
      page.parent?.type === 'workspace' || 
      (page.parent?.type === 'page_id')
    );
    
    const databaseEntries = allPages.filter((page: any) => 
      page.parent?.type === 'database_id'
    );
    
    // Format the pages we want to show
    const pagesToShow = includeDbEntries ? allPages : actualPages;
    const formattedPages = pagesToShow
      .map((page: any) => this.formatPage(page))
      .filter((page: any) => page.title !== '.' && page.title.trim().length > 0) // Filter out empty/dot pages
      .slice(0, 10); // Limit to 10 most relevant
    
    // Create summary
    const summary = this.createWorkspaceSummary(
      actualPages.length, 
      databaseEntries.length, 
      rawData.has_more,
      workspaceName
    );
    
    return {
      workspaceName,
      totalPages: actualPages.length,
      totalDatabases: this.countUniqueDatabases(databaseEntries),
      recentPages: formattedPages,
      databases: [], // Will be populated when we fetch databases separately
      summary
    };
  }

  /**
   * Count unique databases from database entries
   */
  private countUniqueDatabases(databaseEntries: any[]): number {
    const uniqueDbIds = new Set(
      databaseEntries.map(entry => entry.parent?.database_id).filter(Boolean)
    );
    return uniqueDbIds.size;
  }

  /**
   * Create a human-friendly workspace summary
   */
  private createWorkspaceSummary(
    actualPages: number, 
    dbEntries: number, 
    hasMore: boolean,
    workspaceName: string
  ): string {
    const parts = [];
    
    if (actualPages > 0) {
      parts.push(`${actualPages} page${actualPages === 1 ? '' : 's'}`);
    }
    
    if (dbEntries > 0) {
      const uniqueDbs = this.countUniqueDatabases([]);
      parts.push(`${dbEntries} database entr${dbEntries === 1 ? 'y' : 'ies'}`);
    }
    
    let summary = `Your Notion workspace "${workspaceName}" contains ${parts.join(' and ')}.`;
    
    if (hasMore) {
      summary += ' This is a partial view - there may be more content available.';
    }
    
    return summary;
  }

  /**
   * Format database information
   */
  formatDatabase(rawDb: any): HumanFriendlyDatabase {
    const name = this.extractDatabaseTitle(rawDb);
    const lastModified = this.formatDate(rawDb.last_edited_time);
    
    // Create description based on database properties
    const propertyCount = Object.keys(rawDb.properties || {}).length;
    const description = `Database with ${propertyCount} field${propertyCount === 1 ? '' : 's'}`;
    
    return {
      name: name || 'Untitled Database',
      description,
      lastModified,
      _internal: {
        id: rawDb.id,
        url: rawDb.url,
        properties: rawDb.properties,
        rawData: rawDb
      }
    };
  }

  /**
   * Extract clean page title from Notion page object
   */
  private extractPageTitle(page: any): string {
    if (page.properties?.title?.title?.[0]?.plain_text) {
      return page.properties.title.title[0].plain_text;
    }
    
    if (page.properties?.Task?.title?.[0]?.plain_text) {
      return page.properties.Task.title[0].plain_text;
    }
    
    if (page.properties?.Name?.title?.[0]?.plain_text) {
      return page.properties.Name.title[0].plain_text;
    }
    
    // Try to find any title-type property
    for (const [key, value] of Object.entries(page.properties || {})) {
      if ((value as any)?.type === 'title' && (value as any)?.title?.[0]?.plain_text) {
        return (value as any).title[0].plain_text;
      }
    }
    
    return 'Untitled';
  }

  /**
   * Extract database title
   */
  private extractDatabaseTitle(database: any): string {
    if (database.title?.[0]?.plain_text) {
      return database.title[0].plain_text;
    }
    return 'Untitled Database';
  }

  /**
   * Format date for human reading
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Create a response specifically for AI conversation
   * This hides all technical details and presents data naturally
   */
  formatForAIConversation(workspaceSummary: NotionWorkspaceSummary): string {
    let response = workspaceSummary.summary + '\n\n';
    
    if (workspaceSummary.recentPages.length > 0) {
      response += 'Here are your pages:\n';
      workspaceSummary.recentPages.forEach((page, index) => {
        const icon = page.icon ? `${page.icon} ` : '';
        response += `${index + 1}. ${icon}${page.title}`;
        if (page.type === 'database_entry') {
          response += ` (${page.summary})`;
        }
        response += ` - last edited ${page.lastModified}\n`;
      });
    }
    
    return response.trim();
  }

  /**
   * Get page ID by title from workspace summary
   */
  getPageIdByTitle(workspaceSummary: NotionWorkspaceSummary, title: string): string | null {
    const page = workspaceSummary.recentPages.find(
      p => p.title.toLowerCase().includes(title.toLowerCase())
    );
    return page?._internal.id || null;
  }

  /**
   * Format a single Notion property for human readability
   */
  formatProperty(property: any): any {
    if (!property || !property.type) {
      return property;
    }

    switch (property.type) {
      case 'title':
        return property.title?.map((t: any) => t.plain_text).join('') || '';
      
      case 'rich_text':
        return property.rich_text?.map((t: any) => t.plain_text).join('') || '';
      
      case 'select':
        return property.select?.name || null;
      
      case 'multi_select':
        return property.multi_select?.map((s: any) => s.name) || [];
      
      case 'date':
        if (property.date?.start) {
          const start = this.formatDate(property.date.start);
          if (property.date.end) {
            const end = this.formatDate(property.date.end);
            return `${start} - ${end}`;
          }
          return start;
        }
        return null;
      
      case 'number':
        return property.number;
      
      case 'checkbox':
        return property.checkbox;
      
      case 'url':
        return property.url;
      
      case 'email':
        return property.email;
      
      case 'phone_number':
        return property.phone_number;
      
      case 'formula':
        return this.formatProperty(property.formula);
      
      case 'relation':
        return property.relation?.map((r: any) => r.id) || [];
      
      case 'people':
        return property.people?.map((p: any) => p.name || p.id) || [];
      
      case 'files':
        return property.files?.map((f: any) => f.name || f.file?.url || f.external?.url) || [];
      
      case 'created_time':
        return this.formatDate(property.created_time);
      
      case 'last_edited_time':
        return this.formatDate(property.last_edited_time);
      
      case 'created_by':
        return property.created_by?.name || property.created_by?.id;
      
      case 'last_edited_by':
        return property.last_edited_by?.name || property.last_edited_by?.id;
      
      default:
        return property;
    }
  }

  /**
   * Format database query results for human readability
   */
  formatDatabaseQueryResults(results: any[], databaseId: string): string {
    if (!results || results.length === 0) {
      return `The database appears to be empty.`;
    }

    // Group properties to understand the structure
    const allProperties = new Set<string>();
    results.forEach(item => {
      if (item.properties) {
        Object.keys(item.properties).forEach(key => allProperties.add(key));
      }
    });

    const propertyNames = Array.from(allProperties);
    
    // Create a human-readable summary
    const itemsText = results.length === 1 ? 'entry' : 'entries';
    let summary = `Found ${results.length} ${itemsText} in the database:\n\n`;

    // Format each entry
    results.slice(0, 10).forEach((item, index) => { // Limit to 10 for readability
      summary += `**Entry ${index + 1}:**\n`;
      
      // Show the most important properties first (title, name, etc.)
      const priorityKeys = ['Name', 'Title', 'name', 'title'];
      const displayedKeys = new Set<string>();
      
      // First, show priority properties
      priorityKeys.forEach(key => {
        if (item.properties[key] && !displayedKeys.has(key)) {
          const value = item.properties[key];
          if (value && value !== '' && value !== null) {
            summary += `- **${key}:** ${value}\n`;
            displayedKeys.add(key);
          }
        }
      });
      
      // Then show other properties
      Object.entries(item.properties).forEach(([key, value]) => {
        if (!displayedKeys.has(key) && value && value !== '' && value !== null) {
          // Skip showing arrays if they're empty
          if (Array.isArray(value) && value.length === 0) return;
          
          summary += `- **${key}:** ${Array.isArray(value) ? value.join(', ') : value}\n`;
          displayedKeys.add(key);
        }
      });
      
      summary += `- **Last edited:** ${this.formatDate(item.last_edited_time)}\n\n`;
    });

    if (results.length > 10) {
      summary += `... and ${results.length - 10} more entries.\n`;
    }

    return summary;
  }
}

export const notionDataFormatter = new NotionDataFormatter(); 