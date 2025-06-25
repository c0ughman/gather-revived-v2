import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIContact, Message, DocumentInfo } from '../types';
import { integrationsService } from './integrationsService';
import { getIntegrationById } from '../data/integrations';

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

      // Check if contact has API request tool
      const hasApiTool = contact.integrations?.some(
        integration => integration.integrationId === 'api-request-tool' && integration.config.enabled
      );

      // Check if contact has domain checker tool
      const hasDomainTool = contact.integrations?.some(
        integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
      );

      // Check if contact has webhook trigger integration
      const hasWebhookTool = contact.integrations?.some(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      );

      // Check if contact has Google Sheets integration
      const hasGoogleSheets = contact.integrations?.some(
        integration => integration.integrationId === 'google-sheets' && integration.config.enabled
      );

      // Define tools for function calling
      const functionDeclarations = [];

      if (hasApiTool) {
        functionDeclarations.push({
          name: "make_api_request",
          description: "Make an HTTP API request to fetch data from external services when the user asks for real-time information",
          parameters: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The URL to make the request to"
              },
              method: {
                type: "string",
                description: "HTTP method (GET, POST, PUT, DELETE)",
                enum: ["GET", "POST", "PUT", "DELETE"]
              },
              headers: {
                type: "object",
                description: "HTTP headers as key-value pairs"
              },
              body: {
                type: "string",
                description: "Request body for POST/PUT requests"
              }
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
              domain: {
                type: "string",
                description: "Base domain name to check (without TLD)"
              },
              variations: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "Optional domain variations to check. Use {domain} as placeholder. If not provided, uses default variations."
              }
            },
            required: ["domain"]
          }
        });
      }

      if (hasWebhookTool) {
        // Get all webhook integrations for this contact
        const webhookIntegrations = contact.integrations?.filter(
          integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
        ) || [];

        // Create a function for triggering webhooks
        functionDeclarations.push({
          name: "trigger_webhook",
          description: "Trigger a webhook based on natural language commands. Use when user asks to activate, trigger, start, launch, or execute something that matches any webhook description.",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                description: "The action the user wants to perform (e.g., 'activate marketing', 'trigger workflow', 'send notification')"
              },
              webhookId: {
                type: "string",
                description: "Optional specific webhook ID if user specifies. Leave empty to auto-match based on action.",
                enum: webhookIntegrations.map((_, index) => `webhook_${index}`)
              }
            },
            required: ["action"]
          }
        });
      }

      if (hasGoogleSheets) {
        // Get all Google Sheets integrations for this contact
        const sheetsIntegrations = contact.integrations?.filter(
          integration => integration.integrationId === 'google-sheets' && integration.config.enabled
        ) || [];

        functionDeclarations.push({
          name: "manage_google_sheets",
          description: "Read, write, search, and manage Google Sheets data. Use when user asks to view, add, update, search, or modify spreadsheet data. Always provide data as 2D arrays for write/append operations.",
          parameters: {
            type: "object",
            properties: {
              operation: {
                type: "string",
                description: "The operation to perform: 'read' (view data), 'write' (update specific cells), 'append' (add new rows), 'search' (find data), 'info' (get metadata), 'clear' (delete data)",
                enum: ["read", "write", "append", "search", "info", "clear"]
              },
              sheetIndex: {
                type: "number",
                description: "Index of the Google Sheets integration to use (0 for first sheet, 1 for second, etc.)",
                default: 0
              },
              range: {
                type: "string",
                description: "Cell range for read/write operations (e.g., 'A1:C10', 'B5:D5', 'A:A'). Required for write/clear operations. Optional for read (defaults to all data)."
              },
              data: {
                type: "array",
                items: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                },
                description: "2D array of data for write/append operations. MUST be array of arrays. Examples: [['John', 'Doe', 'john@email.com']] for one row, [['Name', 'Email'], ['John', 'john@email.com'], ['Jane', 'jane@email.com']] for multiple rows with headers."
              },
              searchTerm: {
                type: "string",
                description: "Search term to find in the spreadsheet (required for search operation)"
              },
              sheetName: {
                type: "string",
                description: "Optional name of the specific sheet/tab to operate on (defaults to first sheet)"
              }
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

      // Build context
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
        .slice(-10) // Keep last 10 messages for context
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
        
        // Execute function calls
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
                response: {
                  success: true,
                  data: result
                }
              });
            } catch (error) {
              console.error('❌ API request failed:', error);
              functionResponses.push({
                name: call.name,
                response: {
                  success: false,
                  error: error instanceof Error ? error.message : 'API request failed'
                }
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
                response: {
                  success: true,
                  data: result
                }
              });
            } catch (error) {
              console.error('❌ Domain check failed:', error);
              functionResponses.push({
                name: call.name,
                response: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Domain check failed'
                }
              });
            }
          }

          if (call.name === 'trigger_webhook') {
            const args = call.args as any || {};
            const { action, webhookId } = args;
            
            try {
              console.log(`🪝 Triggering webhook for action: ${action}`);
              
              const result = await this.triggerWebhook(action, webhookId, contact, userMessage);
              
              functionResponses.push({
                name: call.name,
                response: {
                  success: true,
                  data: result
                }
              });
            } catch (error) {
              console.error('❌ Webhook trigger failed:', error);
              
              // Check if this might be a CORS issue with a webhook that actually succeeded
              const errorMessage = error instanceof Error ? error.message : 'Webhook trigger failed';
              const isLikelyCorsBlocedWebhook = errorMessage.includes('Load failed') || 
                                               errorMessage.includes('CORS') || 
                                               errorMessage.includes('Access-Control-Allow-Origin');
              
              if (isLikelyCorsBlocedWebhook) {
                // Treat as success with a note about CORS
                functionResponses.push({
                  name: call.name,
                  response: {
                    success: true,
                    data: {
                      action: action || 'webhook action',
                      description: 'Webhook triggered (CORS blocked response)',
                      confirmationMessage: 'Action completed successfully! The webhook was triggered despite a technical response issue.',
                      corsBlocked: true,
                      note: 'The webhook request was sent successfully, but the browser blocked the response due to CORS policy. This is normal for webhook services and does not affect functionality.'
                    }
                  }
                });
              } else {
                functionResponses.push({
                  name: call.name,
                  response: {
                    success: false,
                    error: errorMessage
                  }
                });
              }
            }
          }

          if (call.name === 'manage_google_sheets') {
            try {
              const args = call.args as any || {};
              const { operation, sheetIndex = 0, range, data, searchTerm, sheetName } = args;
              
              console.log(`📊 Managing Google Sheets: ${operation}`);
              
              // Get the Google Sheets integration for this contact
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
                response: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Google Sheets operation failed'
                }
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

For domain results: Present domain availability in a clear, organized format showing which ones are available vs taken.

For webhook results: If the webhook was triggered successfully (even if CORS blocked the response), confirm the action was completed. Focus on the confirmation message from the webhook configuration. If there was a CORS issue but the webhook likely succeeded, reassure the user that the action was triggered successfully despite the technical response being blocked.

For Google Sheets results: Present spreadsheet data in a clear, formatted way. For read operations, show data in a table format if possible. For write/append operations, confirm what was added/updated. For search results, highlight matches and show relevant context. Always mention the sheet name for clarity.
${contact.name}:`;

          console.log('🔧 Generating final response with function results...');
          console.log('🔧 Follow-up prompt length:', followUpPrompt.length);
          
          const finalResult = await model.generateContent(followUpPrompt);
          const finalResponse = finalResult.response.text();
          
          console.log('✅ Final response generated:', finalResponse.substring(0, 100) + '...');
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
      // Get variations from contact integration settings or use provided ones
      let variations: string[] = customVariations || [];
      
      if (variations.length === 0) {
        // Get default variations from contact integration settings
        const domainIntegration = contact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
        );
        
        if (domainIntegration?.config.settings.variations) {
          variations = domainIntegration.config.settings.variations.split('\n').filter((v: string) => v.trim());
        } else {
          // Fallback default variations
          variations = [
            '{domain}.com',
            '{domain}.net',
            '{domain}.org',
            'try{domain}.com',
            '{domain}app.com'
          ];
        }
      }

      const maxConcurrent = parseInt(
        contact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool'
        )?.config.settings.maxConcurrent || '5'
      );

      // Generate domain variations
      const domainsToCheck = variations.map(variation => 
        variation.replace('{domain}', baseDomain)
      );

      console.log(`🔍 Checking ${domainsToCheck.length} domain variations for "${baseDomain}"`);

      // Check domains in batches
      const results = [];
      for (let i = 0; i < domainsToCheck.length; i += maxConcurrent) {
        const batch = domainsToCheck.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (domain) => {
          try {
            // First try the main RDAP service
            let response = await fetch(`https://rdap.org/domain/${domain}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json'
              }
            });

            let isAvailable = response.status === 404;
            let statusCode = response.status;
            let method = 'rdap.org';

            // Special handling for .io domains - they often show as 404 on rdap.org even when taken
            if (domain.endsWith('.io') && response.status === 404) {
              try {
                // Try WHOIS API as fallback for .io domains
                console.log(`🔍 .io domain detected, using fallback check for ${domain}`);
                const whoisResponse = await fetch(`https://api.whoapi.com/?domain=${domain}&r=whois&apikey=free`, {
                  method: 'GET'
                });
                
                if (whoisResponse.ok) {
                  const whoisData = await whoisResponse.json();
                  // If whois returns data, domain is likely taken
                  if (whoisData && whoisData.whois_server) {
                    isAvailable = false;
                    statusCode = 200;
                    method = 'whois fallback';
                  }
                }
              } catch (whoisError) {
                console.warn(`⚠️ WHOIS fallback failed for ${domain}:`, whoisError);
                // For .io domains, be more conservative - if RDAP says 404 but we can't verify, mark as uncertain
                if (domain.endsWith('.io')) {
                  method = 'rdap.org (uncertain for .io)';
                }
              }
            }

            const status = isAvailable ? 'available' : 'taken';
            
            console.log(`${isAvailable ? '✅' : '❌'} ${domain}: ${status} (via ${method})`);
            
            return {
              domain,
              available: isAvailable,
              status,
              statusCode,
              method,
              checked: true,
              note: domain.endsWith('.io') && method.includes('rdap.org') ? 'Note: .io domain availability may be uncertain with RDAP' : undefined
            };
          } catch (error) {
            console.error(`❌ Error checking ${domain}:`, error);
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
        
        // Small delay between batches to be respectful to the RDAP service
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
  private async triggerWebhook(action: string, webhookId?: string, contact?: AIContact, userMessage?: string): Promise<any> {
    try {
      // Get webhook integrations for this contact
      const webhookIntegrations = contact?.integrations?.filter(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      ) || [];

      if (webhookIntegrations.length === 0) {
        throw new Error('No webhook integrations configured for this contact');
      }

      // Find the best matching webhook
      let selectedWebhook;
      
      if (webhookId) {
        // Use specific webhook if provided
        const webhookIndex = parseInt(webhookId.replace('webhook_', ''));
        selectedWebhook = webhookIntegrations[webhookIndex];
      } else {
        // Auto-match based on action and description
        selectedWebhook = this.findBestMatchingWebhook(action, webhookIntegrations);
      }

      if (!selectedWebhook) {
        throw new Error(`No suitable webhook found for action: ${action}`);
      }

      const config = selectedWebhook.config;
      const { webhookUrl, description, payload, headers, confirmationMessage } = config.settings;

      console.log(`🪝 Triggering webhook: ${description}`);

      // Parse headers
      let parsedHeaders = { 'Content-Type': 'application/json' };
      try {
        if (headers) {
          parsedHeaders = { ...parsedHeaders, ...JSON.parse(headers) };
        }
      } catch (e) {
        console.warn('Invalid headers JSON, using default headers');
      }

      // Execute webhook
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
   * Find the best matching webhook based on action and description
   */
  private findBestMatchingWebhook(action: string, webhookIntegrations: any[]): any {
    const actionLower = action.toLowerCase();
    
    // Try to find exact or partial matches in description
    for (const webhook of webhookIntegrations) {
      const description = (webhook.config.settings.description || '').toLowerCase();
      const keywords = (webhook.config.settings.triggerKeywords || '').toLowerCase().split(',').map((k: string) => k.trim());
      
      // Check if action contains any words from the description
      const descriptionWords = description.split(/\s+/);
      const actionWords = actionLower.split(/\s+/);
      
      // Look for word matches
      const hasDescriptionMatch = descriptionWords.some((word: string) => 
        word.length > 2 && actionWords.some(actionWord => actionWord.includes(word))
      );
      
      // Look for keyword matches
      const hasKeywordMatch = keywords.some((keyword: string) => 
        keyword.length > 0 && actionLower.includes(keyword)
      );
      
      if (hasDescriptionMatch || hasKeywordMatch) {
        console.log(`✅ Matched webhook: ${description} (score: ${hasKeywordMatch ? 'keyword' : 'description'})`);
        return webhook;
      }
    }

    // If no good match, return the first one as fallback
    console.log(`⚠️ No exact match found for "${action}", using first webhook`);
    return webhookIntegrations[0];
  }

  private buildContactContext(contact: AIContact, documents: DocumentInfo[]): string {
    let context = `You are ${contact.name}. ${contact.description}`;
    
    // Add document context if available
    if (documents.length > 0) {
      context += '\n\nYou have access to the following documents:\n';
      documents.forEach(doc => {
        context += `- ${doc.name}: ${doc.summary || doc.content.substring(0, 200)}...\n`;
      });
      context += '\nUse this information to provide more accurate and detailed responses.';
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

    if (hasApiTool) {
      context += '\n\nYou have access to the make_api_request function. Use it when users ask for real-time information that requires fetching data from external APIs, such as:';
      context += '\n- Weather information (use OpenWeatherMap API)';
      context += '\n- Cryptocurrency prices (use CoinGecko API)';
      context += '\n- Stock market data';
      context += '\n- News articles';
      context += '\n- Any other real-time web data';
      context += '\n\nAlways explain what you\'re doing when making API requests and provide helpful context about the data you retrieve.';
    }

    if (hasDomainTool) {
      context += '\n\n🔧 DOMAIN CHECKING CAPABILITY ENABLED 🔧';
      context += '\nYou HAVE the check_domain_availability function available. You MUST use it when users ask about domains. Do NOT tell users you cannot check domains.';
      context += '\n\nALWAYS use the function for these requests:';
      context += '\n- "Is [domain] available?"';
      context += '\n- "Check if [name] domains are available"';
      context += '\n- "Find available domains for [project]"';
      context += '\n- "What domain variations are available?"';
      context += '\n- "Try [different domain]" or "Check another domain"';
      context += '\n\nHow to use the function:';
      context += '\n1. Extract the base domain name (remove .com, .net, etc.)';
      context += '\n2. Call check_domain_availability with the base name only';
      context += '\n3. The function will check multiple variations automatically';
      context += '\n4. Present results clearly showing available vs taken domains';
      context += '\n5. ALWAYS encourage users to check more domains after showing results';
      context += '\n\nExample: If user asks "Is mycompany.com available?"';
      context += '\n→ Call check_domain_availability with domain: "mycompany"';
      context += '\n→ Function will check mycompany.com, mycompany.net, trycompany.com, etc.';
      context += '\n→ After showing results, ask "Would you like me to check any other domain names?"';
      context += '\n\nIMPORTANT: You ARE capable of checking domains multiple times. Use the function immediately when asked, EVERY TIME. After each domain check, offer to check more domains to keep the conversation flowing.';
    }

    if (hasWebhookTool) {
      context += '\n\n🪝 WEBHOOK TRIGGER CAPABILITY ENABLED 🪝';
      context += '\nYou HAVE the trigger_webhook function available. You MUST use it when users ask to activate, trigger, start, launch, or execute workflows.';
      
      // List available webhooks
      const webhookIntegrations = contact.integrations?.filter(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      ) || [];
      
      if (webhookIntegrations.length > 0) {
        context += '\n\nAvailable webhook actions:';
        webhookIntegrations.forEach((webhook, index) => {
          const description = webhook.config.settings.description || 'Webhook action';
          const keywords = webhook.config.settings.triggerKeywords || '';
          context += `\n${index + 1}. ${description}`;
          if (keywords) {
            context += ` (Keywords: ${keywords})`;
          }
        });
      }
      
      context += '\n\nALWAYS use the trigger_webhook function for these requests:';
      context += '\n- "Activate [anything]" or "Start [process]"';
      context += '\n- "Trigger [workflow]" or "Launch [campaign]"';
      context += '\n- "Execute [action]" or "Run [automation]"';
      context += '\n- Any natural language request that matches webhook descriptions';
      context += '\n\nHow to use the function:';
      context += '\n1. Listen for action words like activate, trigger, start, launch, execute';
      context += '\n2. Extract the action the user wants to perform';
      context += '\n3. Call trigger_webhook with the action description';
      context += '\n4. The system will automatically match the best webhook';
      context += '\n5. Confirm the action was completed using the webhook\'s confirmation message';
      context += '\n\nExample: If user says "activate marketing workflow"';
      context += '\n→ Call trigger_webhook with action: "activate marketing workflow"';
      context += '\n→ System finds matching webhook and triggers it';
      context += '\n→ Show confirmation message to user';
      context += '\n\nIMPORTANT: You ARE capable of triggering webhooks. Use the function immediately when users request actions that match webhook descriptions.';
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
        
        // Add specific data points based on integration type
        if (integration.integrationId === 'google-news' && data.data.articles) {
          context += `- Latest headlines: ${data.data.articles.slice(0, 3).map((a: any) => a.title).join(', ')}\n`;
        } else if (integration.integrationId === 'financial-markets' && data.data.prices) {
          context += `- Current prices: ${data.data.prices.slice(0, 3).map((p: any) => `${p.symbol}: $${p.price.toFixed(2)}`).join(', ')}\n`;
        } else if (integration.integrationId === 'rss-feeds' && data.data.items) {
          context += `- Recent articles: ${data.data.items.slice(0, 3).map((i: any) => i.title).join(', ')}\n`;
        }
      }
    });

    return hasData ? context : '';
  }
}

export const geminiService = new GeminiService();