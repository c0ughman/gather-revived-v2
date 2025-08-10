/**
 * LEGACY INTEGRATION SERVICE - BACKEND ONLY
 * 
 * ⚠️ ALL INTEGRATION LOGIC MOVED TO BACKEND
 * 
 * All integration execution has been moved to the Python backend
 * for better performance, security, and maintainability.
 * 
 * Backend handles:
 * - HTTP API requests
 * - Domain checking
 * - Web search (Tavily)
 * - Website scraping (Firecrawl)
 * - RSS feeds
 * - Financial data
 * - Webhook triggers
 * 
 * This service now only provides minimal compatibility for existing code.
 */

import { Integration, IntegrationConfig } from '../types/integrations';

// In-memory cache for integration data (minimal legacy support)
const integrationDataCache: Record<string, {
  data: any;
  timestamp: Date;
  summary: string;
}> = {};

class IntegrationsService {
  /**
   * Execute an integration - MOVED TO BACKEND
   */
  async executeIntegration(integration: Integration, config: IntegrationConfig): Promise<any> {
    console.error(`❌ Integration execution for ${integration.name} has been moved to Python backend`);
    throw new Error(
      `Integration "${integration.name}" execution is now handled by the Python backend. ` +
      `Voice calls automatically route through the backend.`
    );
  }

  /**
   * Store integration data in cache (legacy compatibility)
   */
  storeIntegrationData(contactId: string, integrationId: string, data: any, summary: string = ''): void {
    const cacheKey = `${contactId}:${integrationId}`;
    integrationDataCache[cacheKey] = {
      data,
      timestamp: new Date(),
      summary
    };
  }

  /**
   * Get integration data from cache (legacy compatibility)
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
   * Legacy method - integration scheduling has been removed
   */
  startPeriodicExecution(
    contactId: string, 
    integration: Integration, 
    config: IntegrationConfig, 
    callback?: (contactId: string, data: any) => void
  ): void {
    console.log(`✅ Integration ${integration.name} setup acknowledged - backend will handle execution`);
  }

  /**
   * All tool operations have been moved to backend
   */
  async executeApiRequest(): Promise<never> {
    throw new Error('API request execution moved to Python backend');
  }

  async executeWebSearchTool(): Promise<never> {
    throw new Error('Web search execution moved to Python backend');
  }

  async executeFirecrawlToolOperation(): Promise<never> {
    throw new Error('Firecrawl execution moved to Python backend');
  }

  async executeGoogleSheetsToolOperation(): Promise<never> {
    throw new Error('Google Sheets integration has been removed due to OAuth issues');
  }

  async executeNotionToolOperation(): Promise<never> {
    throw new Error('Notion integration has been removed due to OAuth issues');
  }
}

export const integrationsService = new IntegrationsService();