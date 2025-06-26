import { supabase } from '../lib/supabase';
import { AgentIntegration } from '../types';

interface IntegrationExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  summary?: string;
}

export class IntegrationsService {
  // Execute webhook integration
  static async executeWebhook(integration: AgentIntegration, payload?: any): Promise<IntegrationExecutionResult> {
    try {
      const config = integration.config;
      const method = config.method || 'POST';
      const headers = {
        'Content-Type': 'application/json',
        ...config.headers
      };

      const requestOptions: RequestInit = {
        method,
        headers
      };

      if (method !== 'GET' && payload) {
        requestOptions.body = JSON.stringify(payload);
      }

      const response = await fetch(config.webhook_url, requestOptions);
      const data = await response.text();

      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch {
        parsedData = data;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        data: parsedData,
        summary: `Webhook executed successfully. Status: ${response.status}`
      };
    } catch (error) {
      console.error('Webhook execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Webhook execution failed'
      };
    }
  }

  // Execute n8n workflow integration
  static async executeN8N(integration: AgentIntegration, payload?: any): Promise<IntegrationExecutionResult> {
    try {
      const config = integration.config;
      const method = config.method || 'POST';
      const headers = {
        'Content-Type': 'application/json',
        ...config.headers
      };

      const requestOptions: RequestInit = {
        method,
        headers
      };

      if (method !== 'GET' && payload) {
        requestOptions.body = JSON.stringify(payload);
      }

      const response = await fetch(config.webhook_url, requestOptions);
      const data = await response.text();

      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch {
        parsedData = data;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const workflowName = config.workflow_name || 'n8n workflow';
      return {
        success: true,
        data: parsedData,
        summary: `n8n workflow "${workflowName}" executed successfully. Status: ${response.status}`
      };
    } catch (error) {
      console.error('n8n execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'n8n workflow execution failed'
      };
    }
  }

  // Execute Zapier webhook integration
  static async executeZapier(integration: AgentIntegration, payload?: any): Promise<IntegrationExecutionResult> {
    try {
      const config = integration.config;
      const method = config.method || 'POST';
      const headers = {
        'Content-Type': 'application/json',
        ...config.headers
      };

      const requestOptions: RequestInit = {
        method,
        headers
      };

      if (method !== 'GET' && payload) {
        requestOptions.body = JSON.stringify(payload);
      }

      const response = await fetch(config.webhook_url, requestOptions);
      const data = await response.text();

      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch {
        parsedData = data;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const zapName = config.zap_name || 'Zapier Zap';
      return {
        success: true,
        data: parsedData,
        summary: `Zapier Zap "${zapName}" triggered successfully. Status: ${response.status}`
      };
    } catch (error) {
      console.error('Zapier execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Zapier Zap execution failed'
      };
    }
  }

  // Execute Google Sheets integration
  static async executeGoogleSheets(integration: AgentIntegration): Promise<IntegrationExecutionResult> {
    try {
      const config = integration.config;
      const { spreadsheet_id, sheet_name = 'Sheet1', range = 'A1:Z1000', api_key } = config;

      const sheetRange = sheet_name ? `${sheet_name}!${range}` : range;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${sheetRange}?key=${api_key}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return {
        success: true,
        data: data.values || [],
        summary: `Retrieved ${data.values?.length || 0} rows from Google Sheets`
      };
    } catch (error) {
      console.error('Google Sheets execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Google Sheets data retrieval failed'
      };
    }
  }

  // Execute API request integration
  static async executeApiRequest(integration: AgentIntegration, endpoint?: string, payload?: any): Promise<IntegrationExecutionResult> {
    try {
      const config = integration.config;
      const baseUrl = config.base_url;
      const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers
      };

      // Add authentication headers based on auth_type
      if (config.auth_type === 'bearer' && config.bearer_token) {
        headers['Authorization'] = `Bearer ${config.bearer_token}`;
      } else if (config.auth_type === 'api_key' && config.api_key) {
        headers['X-API-Key'] = config.api_key;
      }

      const requestOptions: RequestInit = {
        method: 'GET',
        headers
      };

      if (payload) {
        requestOptions.method = 'POST';
        requestOptions.body = JSON.stringify(payload);
      }

      const response = await fetch(url, requestOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        data,
        summary: `API request completed successfully. Status: ${response.status}`
      };
    } catch (error) {
      console.error('API request execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'API request failed'
      };
    }
  }

  // Main execution method that routes to the appropriate handler
  static async executeIntegration(integration: AgentIntegration, payload?: any): Promise<IntegrationExecutionResult> {
    try {
      let result: IntegrationExecutionResult;

      switch (integration.template_id) {
        case 'webhook':
          result = await this.executeWebhook(integration, payload);
          break;
        case 'n8n':
          result = await this.executeN8N(integration, payload);
          break;
        case 'zapier':
          result = await this.executeZapier(integration, payload);
          break;
        case 'google-sheets':
          result = await this.executeGoogleSheets(integration);
          break;
        case 'api-request':
          result = await this.executeApiRequest(integration, payload?.endpoint, payload?.data);
          break;
        default:
          throw new Error(`Unknown integration type: ${integration.template_id}`);
      }

      // Update integration status and execution data
      await this.updateIntegrationExecution(integration.id, result);

      return result;
    } catch (error) {
      console.error('Integration execution error:', error);
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Integration execution failed'
      };

      await this.updateIntegrationExecution(integration.id, errorResult);
      return errorResult;
    }
  }

  // Update integration execution status in database
  private static async updateIntegrationExecution(
    integrationId: string,
    result: IntegrationExecutionResult
  ): Promise<void> {
    try {
      const updateData: any = {
        last_executed_at: new Date().toISOString(),
        execution_count: supabase.raw('execution_count + 1'),
        last_data: result.data,
        data_summary: result.summary
      };

      if (result.success) {
        updateData.last_success_at = new Date().toISOString();
        updateData.status = 'active';
        updateData.error_message = null;
        updateData.last_error_at = null;
      } else {
        updateData.status = 'error';
        updateData.error_message = result.error;
        updateData.last_error_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('agent_integrations')
        .update(updateData)
        .eq('id', integrationId);

      if (error) {
        console.error('Failed to update integration execution status:', error);
      }
    } catch (error) {
      console.error('Error updating integration execution:', error);
    }
  }

  // Get integrations for an agent
  static async getAgentIntegrations(agentId: string): Promise<AgentIntegration[]> {
    try {
      const { data, error } = await supabase
        .from('agent_integrations')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching agent integrations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAgentIntegrations:', error);
      return [];
    }
  }

  // Execute periodic integrations
  static async executePeriodicIntegrations(): Promise<void> {
    try {
      const { data: integrations, error } = await supabase
        .from('agent_integrations')
        .select('*')
        .in('trigger_type', ['periodic', 'both'])
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching periodic integrations:', error);
        return;
      }

      for (const integration of integrations || []) {
        // Check if it's time to execute based on interval
        const lastExecuted = integration.last_executed_at ? new Date(integration.last_executed_at) : null;
        const now = new Date();
        const intervalMs = (integration.interval_minutes || 60) * 60 * 1000;

        if (!lastExecuted || (now.getTime() - lastExecuted.getTime()) >= intervalMs) {
          await this.executeIntegration(integration);
        }
      }
    } catch (error) {
      console.error('Error executing periodic integrations:', error);
    }
  }

  // Execute chat-start integrations
  static async executeChatStartIntegrations(agentId: string): Promise<void> {
    try {
      const { data: integrations, error } = await supabase
        .from('agent_integrations')
        .select('*')
        .eq('agent_id', agentId)
        .in('trigger_type', ['chat-start', 'both'])
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching chat-start integrations:', error);
        return;
      }

      for (const integration of integrations || []) {
        await this.executeIntegration(integration);
      }
    } catch (error) {
      console.error('Error executing chat-start integrations:', error);
    }
  }
}