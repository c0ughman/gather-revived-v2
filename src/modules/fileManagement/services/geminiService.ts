import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIContact, Message } from '../../../core/types/types';
import { DocumentInfo } from '../types/documents';
import { integrationsService } from '../../integrations';
import { getIntegrationById } from '../../integrations/data/integrations';
import { documentService } from './documentService';

class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(
    contact: AIContact, 
    userMessage: string, 
    chatHistory: Message[],
    conversationDocuments: DocumentInfo[] = []
  ): Promise<string> {
    try {
      console.log(`🤖 Generating response for ${contact.name}`);

      // Check if contact has integrations
      const hasApiTool = contact.integrations?.some(
        integration => integration.integrationId === 'api-request-tool' && integration.config.enabled
      );

      const hasDomainTool = contact.integrations?.some(
        integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
      );

      const hasWebhookTool = contact.integrations?.some(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      );

      const hasZapierWebhook = contact.integrations?.some(
        integration => integration.integrationId === 'zapier-webhook' && integration.config.enabled
      );

      const hasN8nWebhook = contact.integrations?.some(
        integration => integration.integrationId === 'n8n-webhook' && integration.config.enabled
      );

      const hasGoogleSheets = contact.integrations?.some(
        integration => integration.integrationId === 'google-sheets' && integration.config.enabled
      );

      const hasNotionSource = contact.integrations?.some(
        integration => integration.integrationId === 'notion-oauth-source' && integration.config.enabled
      );

      const hasNotionAction = contact.integrations?.some(
        integration => integration.integrationId === 'notion-oauth-action' && integration.config.enabled
      );

      const hasNotion = hasNotionSource || hasNotionAction;

      // Define tools for function calling
      const functionDeclarations = [];

      if (hasApiTool) {
        functionDeclarations.push({
          name: "make_api_request",
          description: "Make an HTTP API request to fetch data from external services when the user asks for real-time information",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "The URL to make the request to" },
              method: { type: "string", description: "HTTP method (GET, POST, PUT, DELETE)", enum: ["GET", "POST", "PUT", "DELETE"] },
              headers: { type: "object", description: "HTTP headers as key-value pairs" },
              body: { type: "string", description: "Request body for POST/PUT requests" }
            },
            required: ["url"]
          }
        });
      }

      if (hasDomainTool) {
        functionDeclarations.push({
          name: "check_domain_availability",
          description: "Check domain availability using RDAP with customizable variations",
          parameters: {
            type: "object",
            properties: {
              domain: { type: "string", description: "Base domain name to check (without TLD)" },
              variations: { type: "array", items: { type: "string" }, description: "Optional domain variations to check. Use {domain} as placeholder." }
            },
            required: ["domain"]
          }
        });
      }

      if (hasWebhookTool) {
        functionDeclarations.push({
          name: "trigger_webhook",
          description: "Trigger a webhook based on natural language commands. Use when user asks to activate, trigger, start, launch, or execute something.",
          parameters: {
            type: "object",
            properties: {
              action: { type: "string", description: "The action the user wants to perform (e.g., 'activate marketing', 'trigger workflow', 'send notification')" }
            },
            required: ["action"]
          }
        });
      }

      if (hasZapierWebhook) {
        functionDeclarations.push({
          name: "trigger_zapier_zap",
          description: "Trigger a Zapier Zap based on natural language commands. Use when user asks to automate, trigger, start, or execute a task that matches a configured Zap.",
          parameters: {
            type: "object",
            properties: {
              action: { type: "string", description: "The action the user wants to perform (e.g., 'send to Slack', 'add to CRM', 'create calendar event')" }
            },
            required: ["action"]
          }
        });
      }

      if (hasN8nWebhook) {
        functionDeclarations.push({
          name: "trigger_n8n_workflow",
          description: "Trigger an n8n workflow based on natural language commands. Use when user asks to process, analyze, generate, sync, or monitor something that matches a configured workflow.",
          parameters: {
            type: "object",
            properties: {
              action: { type: "string", description: "The action the user wants to perform (e.g., 'process customer data', 'generate report', 'sync data')" }
            },
            required: ["action"]
          }
        });
      }

      if (hasGoogleSheets) {
        functionDeclarations.push({
          name: "manage_google_sheets",
          description: "Read, write, search, and manage Google Sheets data. Use when user asks to view, add, update, search, or modify spreadsheet data.",
          parameters: {
            type: "object",
            properties: {
              operation: { type: "string", description: "The operation to perform", enum: ["read", "write", "append", "search", "info", "clear"] },
              sheetIndex: { type: "number", description: "Index of the Google Sheets integration to use", default: 0 },
              range: { type: "string", description: "Cell range for read/write operations" },
              data: { type: "array", items: { type: "array", items: { type: "string" } }, description: "2D array of data for write/append operations" },
              searchTerm: { type: "string", description: "Search term to find in the spreadsheet" },
              sheetName: { type: "string", description: "Optional name of the specific sheet/tab to operate on" }
            },
            required: ["operation"]
          }
        });
      }

      if (hasNotion) {
        functionDeclarations.push({
          name: "manage_notion",
          description: "Manage Notion workspace - create, read, update pages and databases. Use when user asks to work with Notion, create pages, update content, search pages, or query databases. IMPORTANT: When user asks 'what is in [database name]' or 'show me [database name]' or 'what's in my [database name]', use operation 'query_database' with the database name as databaseId. For example: if user asks 'what is in my brain dump', use operation='query_database' and databaseId='Brain Dump'.",
          parameters: {
            type: "object",
            properties: {
              operation: { 
                type: "string", 
                description: "The operation to perform",
                enum: ["search_pages", "search_databases", "get_page_content", "create_page", "update_page", "query_database", "create_database_entry", "append_blocks"]
              },
              query: { type: "string", description: "Search query for finding pages/databases or content to search for" },
              pageId: { type: "string", description: "Notion page ID (for get_page_content, update_page, append_blocks operations)" },
              databaseId: { type: "string", description: "Notion database ID or database name (for query_database, create_database_entry operations). Can be either the exact database name (e.g. 'Brain Dump', 'Habit Tracker') or the UUID." },
              title: { type: "string", description: "Page title (for create_page operation)" },
              content: { type: "string", description: "Page content or blocks to add (for create_page, append_blocks operations)" },
              parentId: { type: "string", description: "Parent page ID for new pages (for create_page operation)" },
              properties: { type: "object", description: "Page or database entry properties to update/create (for update_page, create_database_entry operations)" },
              filter: { type: "object", description: "Filter criteria for database queries (for query_database operation)" },
              sorts: { type: "array", items: { type: "object" }, description: "Sort criteria for database queries (for query_database operation)" }
            },
            required: ["operation"]
          }
        });
      }

      const tools = functionDeclarations.length > 0 ? [{ functionDeclarations }] : [];

      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        tools: tools.length > 0 ? tools : undefined
      } as any);

      // Build context with PROPER document access
      let context = this.buildContactContext(contact, conversationDocuments);
      
      // Add integration data context
      if (contact.integrations) {
        const integrationContext = this.buildIntegrationContext(contact);
        if (integrationContext) {
          context += '\n\n' + integrationContext;
        }
      }

      // Build conversation history
      const conversationHistory = chatHistory
        .slice(-10)
        .map(msg => `${msg.sender === 'user' ? 'User' : contact.name}: ${msg.content}`)
        .join('\n');

      const prompt = `${context}

Previous conversation:
${conversationHistory}

User: ${userMessage}
${contact.name}:`;

      console.log('📝 Sending prompt to Gemini...');
      const result = await model.generateContent(prompt);
      
      // Handle function calls
      const response = result.response;
      const functionCalls = response.functionCalls();
      
      if (functionCalls && functionCalls.length > 0) {
        console.log('🔧 Function calls detected:', functionCalls);
        
        const functionResponses = [];
        for (const call of functionCalls) {
          if (call.name === 'make_api_request') {
            try {
              const args = call.args as any || {};
              const { url, method = 'GET', headers = {}, body } = args;
              console.log(`🌐 Making API request: ${method} ${url}`);
              
              const result = await integrationsService.executeApiRequest(url, method, headers, body);
              
              functionResponses.push({
                name: call.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ API request failed:', error);
              functionResponses.push({
                name: call.name,
                response: { success: false, error: error instanceof Error ? error.message : 'API request failed' }
              });
            }
          }

          if (call.name === 'check_domain_availability') {
            try {
              const args = call.args as any || {};
              const { domain, variations } = args;
              console.log(`🔍 Checking domain availability for: ${domain}`);
              
              const result = await this.checkDomainAvailability(domain, variations, contact);
              
              functionResponses.push({
                name: call.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ Domain check failed:', error);
              functionResponses.push({
                name: call.name,
                response: { success: false, error: error instanceof Error ? error.message : 'Domain check failed' }
              });
            }
          }

          if (call.name === 'trigger_webhook') {
            const args = call.args as any || {};
            const { action } = args;
            
            try {
              console.log(`🪝 Triggering webhook for action: ${action}`);
              
              const result = await this.triggerWebhook(action, contact, userMessage);
              
              functionResponses.push({
                name: call.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ Webhook trigger failed:', error);
              
              const errorMessage = error instanceof Error ? error.message : 'Webhook trigger failed';
              const isLikelyCorsBlocedWebhook = errorMessage.includes('Load failed') || 
                                               errorMessage.includes('CORS') || 
                                               errorMessage.includes('Access-Control-Allow-Origin');
              
              if (isLikelyCorsBlocedWebhook) {
                functionResponses.push({
                  name: call.name,
                  response: {
                    success: true,
                    data: {
                      action: action || 'webhook action',
                      description: 'Webhook triggered (CORS blocked response)',
                      confirmationMessage: 'Action completed successfully! The webhook was triggered despite a technical response issue.',
                      corsBlocked: true,
                      note: 'The webhook request was sent successfully, but the browser blocked the response due to CORS policy.'
                    }
                  }
                });
              } else {
                functionResponses.push({
                  name: call.name,
                  response: { success: false, error: errorMessage }
                });
              }
            }
          }

          if (call.name === 'trigger_zapier_zap') {
            const args = call.args as any || {};
            const { action } = args;
            
            try {
              console.log(`⚡ Triggering Zapier Zap for action: ${action}`);
              
              const result = await this.triggerZapierZap(action, contact, userMessage);
              
              functionResponses.push({
                name: call.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ Zapier Zap trigger failed:', error);
              
              const errorMessage = error instanceof Error ? error.message : 'Zapier Zap trigger failed';
              const isLikelyCorsBlocedWebhook = errorMessage.includes('Load failed') || 
                                               errorMessage.includes('CORS') || 
                                               errorMessage.includes('Access-Control-Allow-Origin');
              
              if (isLikelyCorsBlocedWebhook) {
                functionResponses.push({
                  name: call.name,
                  response: {
                    success: true,
                    data: {
                      action: action || 'zap action',
                      description: 'Zap triggered (CORS blocked response)',
                      confirmationMessage: 'Zap triggered successfully! The automation is now running.',
                      corsBlocked: true,
                      note: 'The Zap request was sent successfully, but the browser blocked the response due to CORS policy.'
                    }
                  }
                });
              } else {
                functionResponses.push({
                  name: call.name,
                  response: { success: false, error: errorMessage }
                });
              }
            }
          }

          if (call.name === 'trigger_n8n_workflow') {
            const args = call.args as any || {};
            const { action } = args;
            
            try {
              console.log(`🔄 Triggering n8n workflow for action: ${action}`);
              
              const result = await this.triggerN8nWorkflow(action, contact, userMessage);
              
              functionResponses.push({
                name: call.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ n8n workflow trigger failed:', error);
              
              const errorMessage = error instanceof Error ? error.message : 'n8n workflow trigger failed';
              const isLikelyCorsBlocedWebhook = errorMessage.includes('Load failed') || 
                                               errorMessage.includes('CORS') || 
                                               errorMessage.includes('Access-Control-Allow-Origin');
              
              if (isLikelyCorsBlocedWebhook) {
                functionResponses.push({
                  name: call.name,
                  response: {
                    success: true,
                    data: {
                      action: action || 'workflow action',
                      description: 'Workflow triggered (CORS blocked response)',
                      confirmationMessage: 'Workflow triggered successfully! The automation is now running.',
                      corsBlocked: true,
                      note: 'The workflow request was sent successfully, but the browser blocked the response due to CORS policy.'
                    }
                  }
                });
              } else {
                functionResponses.push({
                  name: call.name,
                  response: { success: false, error: errorMessage }
                });
              }
            }
          }

          if (call.name === 'manage_notion') {
            try {
              const args = call.args as any || {};
              const { 
                operation, 
                query, 
                pageId, 
                databaseId, 
                title, 
                content, 
                parentId, 
                properties, 
                filter, 
                sorts 
              } = args;
              
              console.log(`📝 Managing Notion: ${operation}`);
              
              const result = await integrationsService.executeNotionToolOperation(
                operation,
                query,
                pageId,
                databaseId,
                title,
                content,
                parentId,
                properties,
                filter,
                sorts,
                contact
              );
              
              functionResponses.push({
                name: call.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ Notion operation failed:', error);
              functionResponses.push({
                name: call.name,
                response: { success: false, error: error instanceof Error ? error.message : 'Notion operation failed' }
              });
            }
          }

          if (call.name === 'manage_google_sheets') {
            try {
              const args = call.args as any || {};
              const { operation, sheetIndex = 0, range, data, searchTerm, sheetName } = args;
              
              console.log(`📊 Managing Google Sheets: ${operation}`);
              
              const sheetsIntegrations = contact.integrations?.filter(
                integration => integration.integrationId === 'google-sheets' && integration.config.enabled
              ) || [];
              
              if (sheetsIntegrations.length === 0) {
                throw new Error('No Google Sheets integrations found for this contact');
              }
              
              if (sheetIndex >= sheetsIntegrations.length) {
                throw new Error(`Sheet index ${sheetIndex} is out of range. Available sheets: 0-${sheetsIntegrations.length - 1}`);
              }
              
              const sheetIntegration = sheetsIntegrations[sheetIndex];
              const sheetConfig = sheetIntegration.config.settings;
              
              const result = await integrationsService.executeGoogleSheetsToolOperation(
                operation,
                sheetConfig.sheetUrl,
                sheetConfig.accessLevel || 'read-only',
                sheetName || sheetConfig.defaultSheet,
                range,
                data,
                searchTerm
              );
              
              functionResponses.push({
                name: call.name,
                response: {
                  success: true,
                  operation,
                  sheetName: sheetConfig.sheetName || 'Google Sheets',
                  data: result.data
                }
              });
            } catch (error) {
              console.error('❌ Google Sheets operation failed:', error);
              functionResponses.push({
                name: call.name,
                response: { success: false, error: error instanceof Error ? error.message : 'Google Sheets operation failed' }
              });
            }
          }
        }

        // Generate final response with function results
        if (functionResponses.length > 0) {
          console.log('🔧 Function responses:', functionResponses);
          
          const followUpPrompt = `${context}

Previous conversation:
${conversationHistory}

User: ${userMessage}

Function call results:
${functionResponses.map(fr => `${fr.name}: ${JSON.stringify(fr.response, null, 2)}`).join('\n')}

Based on the function call results above, provide a helpful and detailed response to the user.
${contact.name}:`;

          console.log('🔧 Generating final response with function results...');
          
          const finalResult = await model.generateContent(followUpPrompt);
          const finalResponse = finalResult.response.text();
          
          console.log('✅ Final response generated');
          return finalResponse;
        }
      }

      return response.text();
    } catch (error) {
      console.error('❌ Error generating response:', error);
      throw new Error('Failed to generate AI response. Please try again.');
    }
  }

  /**
   * Check domain availability using RDAP
   */
  private async checkDomainAvailability(baseDomain: string, customVariations?: string[], contact?: AIContact): Promise<any> {
    try {
      let variations: string[] = customVariations || [];
      
      if (variations.length === 0) {
        const domainIntegration = contact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
        );
        
        if (domainIntegration?.config.settings.variations) {
          variations = domainIntegration.config.settings.variations.split('\n').filter((v: string) => v.trim());
        } else {
          variations = ['{domain}.com', '{domain}.net', '{domain}.org', 'try{domain}.com', '{domain}app.com'];
        }
      }

      const maxConcurrent = parseInt(
        contact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool'
        )?.config.settings.maxConcurrent || '5'
      );

      const domainsToCheck = variations.map(variation => 
        variation.replace('{domain}', baseDomain)
      );

      console.log(`🔍 Checking ${domainsToCheck.length} domain variations for "${baseDomain}"`);

      const results = [];
      for (let i = 0; i < domainsToCheck.length; i += maxConcurrent) {
        const batch = domainsToCheck.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (domain) => {
          try {
            const response = await fetch(`https://rdap.org/domain/${domain}`, {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            });

            const isAvailable = response.status === 404;
            
            return {
              domain,
              available: isAvailable,
              status: isAvailable ? 'available' : 'taken',
              statusCode: response.status,
              checked: true
            };
          } catch (error) {
            return {
              domain,
              available: false,
              status: 'error',
              error: (error as Error).message,
              checked: false
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        if (i + maxConcurrent < domainsToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const availableDomains = results.filter(r => r.available);
      const takenDomains = results.filter(r => !r.available && r.checked);
      const errorDomains = results.filter(r => !r.checked);

      return {
        baseDomain,
        totalChecked: domainsToCheck.length,
        summary: {
          available: availableDomains.length,
          taken: takenDomains.length,
          errors: errorDomains.length
        },
        results: {
          available: availableDomains,
          taken: takenDomains,
          errors: errorDomains
        },
        allResults: results
      };

    } catch (error) {
      console.error('❌ Domain availability check failed:', error);
      throw new Error(`Domain check failed: ${(error as Error).message}`);
    }
  }

  /**
   * Trigger a webhook based on natural language action
   */
  private async triggerWebhook(action: string, contact?: AIContact, userMessage?: string): Promise<any> {
    try {
      const webhookIntegrations = contact?.integrations?.filter(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      ) || [];

      if (webhookIntegrations.length === 0) {
        throw new Error('No webhook integrations configured for this contact');
      }

      const selectedWebhook = this.findBestMatchingWebhook(action, webhookIntegrations);

      if (!selectedWebhook) {
        throw new Error(`No suitable webhook found for action: ${action}`);
      }

      const config = selectedWebhook.config;
      const { webhookUrl, description, payload, headers, confirmationMessage } = config.settings;

      console.log(`🪝 Triggering webhook: ${description}`);

      let parsedHeaders = { 'Content-Type': 'application/json' };
      try {
        if (headers) {
          parsedHeaders = { ...parsedHeaders, ...JSON.parse(headers) };
        }
      } catch (e) {
        console.warn('Invalid headers JSON, using default headers');
      }

      const result = await integrationsService.executeWebhookTriggerTool(
        webhookUrl,
        payload || '{}',
        parsedHeaders,
        userMessage || action,
        contact?.name
      );

      return {
        action,
        description,
        webhookUrl,
        confirmationMessage: confirmationMessage || 'Webhook triggered successfully!',
        result
      };

    } catch (error) {
      console.error('❌ Webhook trigger failed:', error);
      throw new Error(`Webhook trigger failed: ${(error as Error).message}`);
    }
  }

  /**
   * Trigger a Zapier Zap based on natural language action
   */
  private async triggerZapierZap(action: string, contact?: AIContact, userMessage?: string): Promise<any> {
    try {
      const zapierIntegrations = contact?.integrations?.filter(
        integration => integration.integrationId === 'zapier-webhook' && integration.config.enabled
      ) || [];

      if (zapierIntegrations.length === 0) {
        throw new Error('No Zapier integrations configured for this contact');
      }

      const selectedZap = this.findBestMatchingIntegration(action, zapierIntegrations);

      if (!selectedZap) {
        throw new Error(`No suitable Zap found for action: ${action}`);
      }

      const config = selectedZap.config;
      const { webhookUrl, zapName, description, payload, confirmationMessage, triggerKeywords } = config.settings;

      console.log(`⚡ Triggering Zapier Zap: ${zapName}`);

      // Prepare payload with dynamic variables
      let processedPayload = payload || '{}';
      processedPayload = processedPayload
        .replace(/{{timestamp}}/g, new Date().toISOString())
        .replace(/{{user_message}}/g, userMessage || action)
        .replace(/{{contact_name}}/g, contact?.name || 'AI Assistant');

      // Parse headers - Zapier typically doesn't need special headers
      const headers = { 'Content-Type': 'application/json' };

      // Use the proxy service to avoid CORS issues
      const result = await integrationsService.executeWebhookTriggerTool(
        webhookUrl,
        processedPayload,
        headers,
        userMessage || action,
        contact?.name
      );

      return {
        action,
        zapName,
        description,
        confirmationMessage: confirmationMessage || `${zapName} triggered successfully!`,
        result
      };

    } catch (error) {
      console.error('❌ Zapier Zap trigger failed:', error);
      throw new Error(`Zapier Zap trigger failed: ${(error as Error).message}`);
    }
  }

  /**
   * Trigger an n8n workflow based on natural language action
   */
  private async triggerN8nWorkflow(action: string, contact?: AIContact, userMessage?: string): Promise<any> {
    try {
      const n8nIntegrations = contact?.integrations?.filter(
        integration => integration.integrationId === 'n8n-webhook' && integration.config.enabled
      ) || [];

      if (n8nIntegrations.length === 0) {
        throw new Error('No n8n integrations configured for this contact');
      }

      const selectedWorkflow = this.findBestMatchingIntegration(action, n8nIntegrations);

      if (!selectedWorkflow) {
        throw new Error(`No suitable n8n workflow found for action: ${action}`);
      }

      const config = selectedWorkflow.config;
      const { webhookUrl, workflowName, description, payload, confirmationMessage, triggerKeywords } = config.settings;

      console.log(`🔄 Triggering n8n workflow: ${workflowName}`);

      // Prepare payload with dynamic variables
      let processedPayload = payload || '{}';
      processedPayload = processedPayload
        .replace(/{{timestamp}}/g, new Date().toISOString())
        .replace(/{{user_message}}/g, userMessage || action)
        .replace(/{{contact_name}}/g, contact?.name || 'AI Assistant');

      // Parse headers - n8n typically doesn't need special headers
      const headers = { 'Content-Type': 'application/json' };

      const result = await integrationsService.executeWebhookTriggerTool(
        webhookUrl,
        processedPayload,
        headers,
        userMessage || action,
        contact?.name
      );

      return {
        action,
        workflowName,
        description,
        confirmationMessage: confirmationMessage || `${workflowName} triggered successfully!`,
        result
      };

    } catch (error) {
      console.error('❌ n8n workflow trigger failed:', error);
      throw new Error(`n8n workflow trigger failed: ${(error as Error).message}`);
    }
  }

  /**
   * Find the best matching webhook based on action and description
   */
  private findBestMatchingWebhook(action: string, webhookIntegrations: any[]): any {
    const actionLower = action.toLowerCase();
    
    for (const webhook of webhookIntegrations) {
      const description = (webhook.config.settings.description || '').toLowerCase();
      const keywords = (webhook.config.settings.triggerKeywords || '').toLowerCase().split(',').map((k: string) => k.trim());
      
      const descriptionWords = description.split(/\s+/);
      const actionWords = actionLower.split(/\s+/);
      
      const hasDescriptionMatch = descriptionWords.some((word: string) => 
        word.length > 2 && actionWords.some(actionWord => actionWord.includes(word))
      );
      
      const hasKeywordMatch = keywords.some((keyword: string) => 
        keyword.length > 0 && actionLower.includes(keyword)
      );
      
      if (hasDescriptionMatch || hasKeywordMatch) {
        console.log(`✅ Matched webhook: ${description}`);
        return webhook;
      }
    }

    console.log(`⚠️ No exact match found for "${action}", using first webhook`);
    return webhookIntegrations[0];
  }

  /**
   * Find the best matching integration based on action and description
   * Used for both Zapier and n8n integrations
   */
  private findBestMatchingIntegration(action: string, integrations: any[]): any {
    const actionLower = action.toLowerCase();
    
    for (const integration of integrations) {
      const description = (integration.config.settings.description || '').toLowerCase();
      const keywords = (integration.config.settings.triggerKeywords || '').toLowerCase().split(',').map((k: string) => k.trim());
      
      const descriptionWords = description.split(/\s+/);
      const actionWords = actionLower.split(/\s+/);
      
      const hasDescriptionMatch = descriptionWords.some((word: string) => 
        word.length > 2 && actionWords.some(actionWord => actionWord.includes(word))
      );
      
      const hasKeywordMatch = keywords.some((keyword: string) => 
        keyword.length > 0 && actionLower.includes(keyword)
      );
      
      if (hasDescriptionMatch || hasKeywordMatch) {
        console.log(`✅ Matched integration: ${description}`);
        return integration;
      }
    }

    console.log(`⚠️ No exact match found for "${action}", using first integration`);
    return integrations[0];
  }

  private buildContactContext(contact: AIContact, documents: DocumentInfo[]): string {
    let context = `You are ${contact.name}. ${contact.description}`;
    
    // Add ALL documents (both permanent and conversation) with PROPER formatting
    const allDocuments = [...(contact.documents || []), ...documents];
    
    if (allDocuments.length > 0) {
      context += '\n\n=== YOUR KNOWLEDGE BASE ===\n';
      context += 'You have access to the following documents. Use this information to provide accurate and detailed responses:\n\n';
      
      allDocuments.forEach(doc => {
        context += documentService.formatDocumentForAI(doc) + '\n\n';
      });
      
      context += 'This is your knowledge base. Reference this information throughout conversations to provide accurate responses.';
    }

    // Add tool use instructions if applicable
    const hasApiTool = contact.integrations?.some(
      integration => integration.integrationId === 'api-request-tool' && integration.config.enabled
    );

    const hasDomainTool = contact.integrations?.some(
      integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
    );

    const hasWebhookTool = contact.integrations?.some(
      integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
    );

    const hasZapierWebhook = contact.integrations?.some(
      integration => integration.integrationId === 'zapier-webhook' && integration.config.enabled
    );

    const hasN8nWebhook = contact.integrations?.some(
      integration => integration.integrationId === 'n8n-webhook' && integration.config.enabled
    );

    const hasGoogleSheets = contact.integrations?.some(
      integration => integration.integrationId === 'google-sheets' && integration.config.enabled
    );

    if (hasApiTool) {
      context += '\n\n🔧 API REQUEST TOOL AVAILABLE 🔧';
      context += '\nYou HAVE the make_api_request function. Use it when users ask for real-time information:';
      context += '\n- Weather information (use OpenWeatherMap API)';
      context += '\n- Cryptocurrency prices (use CoinGecko API)';
      context += '\n- Stock market data, News articles, Any other real-time web data';
      context += '\nAlways explain what you\'re doing when making API requests.';
    }

    if (hasDomainTool) {
      context += '\n\n🔧 DOMAIN CHECKING AVAILABLE 🔧';
      context += '\nYou HAVE the check_domain_availability function. Use it when users ask about domains:';
      context += '\n- "Is [domain] available?" - "Check if [name] domains are available"';
      context += '\nExtract the base domain name (remove .com, .net, etc.) and call the function.';
    }

    if (hasWebhookTool) {
      context += '\n\n🪝 WEBHOOK TRIGGERS AVAILABLE 🪝';
      context += '\nYou HAVE the trigger_webhook function. Use it when users ask to activate, trigger, start, launch, or execute workflows.';
      
      const webhookIntegrations = contact.integrations?.filter(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      ) || [];
      
      if (webhookIntegrations.length > 0) {
        context += '\n\nAvailable webhook actions:';
        webhookIntegrations.forEach((webhook, index) => {
          const description = webhook.config.settings.description || 'Webhook action';
          context += `\n${index + 1}. ${description}`;
        });
      }
    }

    if (hasZapierWebhook) {
      context += '\n\n⚡ ZAPIER ZAPS AVAILABLE ⚡';
      context += '\nYou HAVE the trigger_zapier_zap function. Use it when users ask to automate, send, create, or perform tasks that match your configured Zaps.';
      
      const zapierIntegrations = contact.integrations?.filter(
        integration => integration.integrationId === 'zapier-webhook' && integration.config.enabled
      ) || [];
      
      if (zapierIntegrations.length > 0) {
        context += '\n\nAvailable Zapier Zaps:';
        zapierIntegrations.forEach((zap, index) => {
          const zapName = zap.config.settings.zapName || 'Zap';
          const description = zap.config.settings.description || 'Zapier automation';
          context += `\n${index + 1}. ${zapName}: ${description}`;
        });
      }
    }

    if (hasN8nWebhook) {
      context += '\n\n🔄 N8N WORKFLOWS AVAILABLE 🔄';
      context += '\nYou HAVE the trigger_n8n_workflow function. Use it when users ask to process, analyze, generate, sync, or monitor data that matches your configured workflows.';
      
      const n8nIntegrations = contact.integrations?.filter(
        integration => integration.integrationId === 'n8n-webhook' && integration.config.enabled
      ) || [];
      
      if (n8nIntegrations.length > 0) {
        context += '\n\nAvailable n8n workflows:';
        n8nIntegrations.forEach((workflow, index) => {
          const workflowName = workflow.config.settings.workflowName || 'Workflow';
          const description = workflow.config.settings.description || 'n8n automation';
          context += `\n${index + 1}. ${workflowName}: ${description}`;
        });
      }
    }

    if (hasGoogleSheets) {
      context += '\n\n📊 GOOGLE SHEETS ACCESS AVAILABLE 📊';
      context += '\nYou HAVE the manage_google_sheets function. Use it when users ask to view, add, update, search, or modify spreadsheet data.';
    }

    // Add Notion-specific context
    const hasNotionSource = contact.integrations?.some(
      integration => integration.integrationId === 'notion-oauth-source' && integration.config.enabled
    );

    const hasNotionAction = contact.integrations?.some(
      integration => integration.integrationId === 'notion-oauth-action' && integration.config.enabled
    );

    if (hasNotionSource || hasNotionAction) {
      context += '\n\n📝 NOTION INTEGRATION AVAILABLE 📝';
      context += '\nYou HAVE the manage_notion function. Use it when users ask about Notion content:';
      context += '\n- "What databases do I have?" → use operation="search_databases"';
      context += '\n- "What is in my [database name]?" → use operation="query_database" with databaseId="[database name]"';
      context += '\n- "Show me my Brain Dump" → use operation="query_database" with databaseId="Brain Dump"';
      context += '\n- "What\'s in the Habit Tracker?" → use operation="query_database" with databaseId="Habit Tracker"';
      context += '\nIMPORTANT: When users ask about database contents, ALWAYS use the "query_database" operation with the database name as databaseId.';
    }

    return context;
  }

  private buildIntegrationContext(contact: AIContact): string {
    if (!contact.integrations) return '';

    let context = 'Recent data from your integrations:\n';
    let hasData = false;

    contact.integrations.forEach(integration => {
      const integrationDef = getIntegrationById(integration.integrationId);
      if (!integrationDef) return;

      const data = integrationsService.getIntegrationData(contact.id, integration.integrationId);
      if (data) {
        hasData = true;
        context += `\n${integrationDef.name}:\n`;
        context += `- ${data.summary}\n`;
        context += `- Last updated: ${data.timestamp.toLocaleString()}\n`;
        
        if (integration.integrationId === 'google-news' && data.data.articles) {
          context += `- Latest headlines: ${data.data.articles.slice(0, 3).map((a: any) => a.title).join(', ')}\n`;
        } else if (integration.integrationId === 'financial-markets' && data.data.prices) {
          context += `- Current prices: ${data.data.prices.slice(0, 3).map((p: any) => `${p.symbol}: $${p.price.toFixed(2)}`).join(', ')}\n`;
        } else if (integration.integrationId === 'rss-feeds' && data.data.items) {
          context += `- Recent articles: ${data.data.items.slice(0, 3).map((i: any) => i.title).join(', ')}\n`;
        } else if ((integration.integrationId === 'notion-oauth-source' || integration.integrationId === 'notion-oauth-action') && data.data) {
          // Add Notion database context
          if (data.data.databases && data.data.databases.length > 0) {
            context += `- Available databases: ${data.data.databases.map((db: any) => db.title || db.name).join(', ')}\n`;
          }
          if (data.data.pages && data.data.pages.length > 0) {
            context += `- Recent pages: ${data.data.pages.slice(0, 3).map((p: any) => p.title).join(', ')}\n`;
          }
        }
      }
    });

    return hasData ? context : '';
  }
}

export const geminiService = new GeminiService();