/**
 * LEGACY INTEGRATION SERVICE 
 * 
 * ⚠️ INTEGRATION LOGIC MOVED TO BACKEND
 * 
 * All integration execution and function calling has been moved to the Python backend
 * for better performance, security, and maintainability.
 * 
 * - HTTP API requests → backend/app/services/integrations_service.py
 * - Domain checking → backend/app/services/integrations_service.py  
 * - Web search → backend/app/services/integrations_service.py
 * - Website scraping → backend/app/services/integrations_service.py
 * - Webhook triggers → backend/app/services/integrations_service.py
 * 
 * OAuth integrations (Google Sheets, Notion) have been REMOVED as they were
 * incorrectly configured and caused issues.
 * 
 * This service now only exists for backwards compatibility and will throw
 * errors directing users to use the backend implementations.
 */

import { Integration, IntegrationConfig } from '../types/integrations';
import { firecrawlService } from '../firecrawl/firecrawlService';
import { AIContact } from '../../../core/types/types';

// In-memory cache for integration data (legacy)
const integrationDataCache: Record<string, {
  data: any;
  timestamp: Date;
  summary: string;
}> = {};

class IntegrationsService {
  /**
   * Execute an integration and return the result
   * ⚠️ MOVED TO BACKEND - This method should no longer be used
   */
  async executeIntegration(integration: Integration, config: IntegrationConfig): Promise<any> {
    console.error(`❌ LEGACY: Integration execution for ${integration.name} has been moved to Python backend`);
    throw new Error(
      `⚠️ INTEGRATION MOVED: ${integration.name} execution has been moved to the Python backend.\n` +
      `Voice calls now route through the backend automatically.\n` +
      `For direct usage, use the backend API endpoints instead.`
    );
  }

  /**
   * Store integration data in cache (legacy - kept for compatibility)
   */
  storeIntegrationData(contactId: string, integrationId: string, data: any, summary: string): void {
    const cacheKey = `${contactId}:${integrationId}`;
    integrationDataCache[cacheKey] = {
      data,
      timestamp: new Date(),
      summary
    };
    console.log(`💾 Stored integration data for ${integrationId} (legacy cache)`);
  }

  /**
   * Get integration data from cache (legacy)
   */
  getIntegrationData(contactId: string, integrationId: string): {
    data: any;
    timestamp: Date;
    summary: string;
  } | null {
    const cacheKey = `${contactId}:${integrationId}`;
    return integrationDataCache[cacheKey] || null;
  }

  /**
   * Clear integration data from cache (legacy)
   */
  clearIntegrationData(contactId: string, integrationId: string): void {
    const cacheKey = `${contactId}:${integrationId}`;
    delete integrationDataCache[cacheKey];
    console.log(`🧹 Cleared integration data for ${integrationId}`);
  }

  /**
   * Start periodic execution for integrations (legacy - now no-op)
   * ⚠️ MOVED TO BACKEND - This functionality is now handled by the Python backend
   */
  startPeriodicExecution(
    contactId: string, 
    integration: Integration, 
    config: IntegrationConfig, 
    callback: (contactId: string, data: any) => void
  ): void {
    console.log(`🔄 LEGACY: Periodic execution for ${integration.name} has been moved to Python backend`);
    console.log(`✅ Contact ${contactId} integration ${integration.id} setup acknowledged (backend handles execution)`);
  }

  // ============================================================================
  // TOOL OPERATIONS - ALL MOVED TO BACKEND
  // ============================================================================

  /**
   * ⚠️ MOVED TO BACKEND: Execute API request tool operation
   */
  async executeApiRequest(url: string, method: string = 'GET', headers: any = {}, body?: string): Promise<any> {
    console.error('❌ LEGACY: API request execution moved to Python backend');
    throw new Error('⚠️ MOVED: executeApiRequest() has been moved to the Python backend and is handled automatically during voice calls.');
  }

  /**
   * ⚠️ MOVED TO BACKEND: Execute Google Sheets tool operation  
   */
  async executeGoogleSheetsToolOperation(
    operation: string,
    sheetUrl: string,
    accessLevel: string,
    sheetName?: string,
    range?: string,
    data?: any[][],
    searchTerm?: string
  ): Promise<any> {
    console.error('❌ OAUTH REMOVED: Google Sheets integration has been disabled');
    throw new Error('⚠️ DISABLED: Google Sheets integration has been removed due to incorrectly configured OAuth.');
  }

  /**
   * ⚠️ OAUTH REMOVED: Execute Notion tool operation
   */
  async executeNotionToolOperation(
    operation: string,
    query?: string,
    pageId?: string,
    databaseId?: string,
    title?: string,
    content?: string,
    parentId?: string,
    properties?: any,
    filter?: any,
    sorts?: any[],
    contact?: AIContact
  ): Promise<any> {
    console.error('❌ OAUTH REMOVED: Notion integration has been disabled');  
    throw new Error('⚠️ DISABLED: Notion integration has been removed due to incorrectly configured OAuth.');
  }

  /**
   * ⚠️ MOVED TO BACKEND: Execute web search tool
   */
  async executeWebSearchTool(
    query: string,
    searchDepth: string = 'basic',
    maxResults: number = 5,
    includeAnswer: boolean = true
  ): Promise<any> {
    console.error('❌ LEGACY: Web search execution moved to Python backend');
    throw new Error('⚠️ MOVED: executeWebSearchTool() has been moved to the Python backend and is handled automatically during voice calls.');
  }

  /**
   * ⚠️ MOVED TO BACKEND: Execute Firecrawl tool operation  
   */
  async executeFirecrawlToolOperation(
    url: string,
    extractType: string = 'text',
    includeImages: boolean = false,
    maxPages: number = 5,
    contact?: AIContact
  ): Promise<any> {
    console.error('❌ LEGACY: Firecrawl execution moved to Python backend');
    throw new Error('⚠️ MOVED: executeFirecrawlToolOperation() has been moved to the Python backend and is handled automatically during voice calls.');
  }

  // ============================================================================
  // LEGACY METHODS - All moved to backend
  // ============================================================================

  private async executeHttpRequest(config: IntegrationConfig): Promise<any> {
    throw new Error('⚠️ MOVED: HTTP request execution moved to Python backend');
  }

  private async executeWebSearch(config: IntegrationConfig): Promise<any> {
    throw new Error('⚠️ MOVED: Web search execution moved to Python backend');  
  }

  private async executeGoogleNews(config: IntegrationConfig): Promise<any> {
    throw new Error('⚠️ MOVED: Google News execution moved to Python backend');
  }

  private async executeRssFeeds(config: IntegrationConfig): Promise<any> {
    throw new Error('⚠️ MOVED: RSS feed execution moved to Python backend');
  }

  private async executeFinancialMarkets(config: IntegrationConfig): Promise<any> {
    throw new Error('⚠️ MOVED: Financial markets execution moved to Python backend');
  }

  private async executeFirecrawlScraping(config: IntegrationConfig): Promise<any> {
    throw new Error('⚠️ MOVED: Firecrawl scraping execution moved to Python backend');
  }
}

export const integrationsService = new IntegrationsService();