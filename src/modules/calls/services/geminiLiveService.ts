import { GoogleGenAI, Modality } from '@google/genai';
import { AIContact, Message } from '../../../types';
import { integrationsService } from '../../../services/integrationsService';
import { documentService } from '../../../services/documentService';

// Configuration for Gemini Live API
interface GeminiLiveConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

// Response types for streaming
interface GeminiLiveResponse {
  text: string;
  isComplete: boolean;
}

class GeminiLiveService {
  private genAI: GoogleGenAI | null = null;
  private activeSession: any = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isRecording: boolean = false;
  private isPlaying: boolean = false;
  private currentContact: AIContact | null = null;
  private isSessionActive: boolean = false;

  // Callbacks
  private onResponseCallback: ((response: GeminiLiveResponse) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onStateChangeCallback: ((state: 'idle' | 'listening' | 'processing' | 'responding') => void) | null = null;

  // Audio processing - SIMPLIFIED FOR LOW LATENCY
  private audioChunks: Float32Array[] = [];
  private audioQueue: Int16Array[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private processingInterval: number | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;

  constructor(config: GeminiLiveConfig) {
    const apiKey = config.apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    } else {
      console.warn('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env file');
    }
  }

  /**
   * Initialize the audio context and request microphone permissions
   */
  public async initialize(): Promise<boolean> {
    try {
      console.log("🎤 Starting audio initialization...");
      
      // Initialize AudioContext with ULTRA LOW LATENCY settings
      this.audioContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 16000
      });
      
      console.log("✅ AudioContext created");
      
      // Request microphone permissions with MINIMAL latency
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          latency: 0.01 // 10ms latency
        } 
      });
      
      console.log("✅ Microphone access granted");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize audio:", error);
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error("Failed to initialize audio: " + (error as Error).message));
      }
      return false;
    }
  }

  /**
   * Start a new Live API session
   */
  public async startSession(contact: AIContact): Promise<void> {
    try {
      if (!this.genAI) {
        throw new Error("Gemini API not initialized - check your API key");
      }

      if (!this.audioStream || !this.audioContext) {
        throw new Error("Audio not initialized - call initialize() first");
      }

      // Prevent multiple concurrent sessions
      if (this.isSessionActive) {
        console.log("Session already active, ending current session first");
        this.endSession();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.isSessionActive = true;
      this.currentContact = contact;
      this.updateState('idle');
      this.audioQueue = [];

      // Check integrations and documents
      const hasApiTool = contact.integrations?.some(
        integration => integration.integrationId === 'api-request-tool' && integration.config.enabled
      );
      const hasDomainTool = contact.integrations?.some(
        integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
      );
      const hasWebhookTool = contact.integrations?.some(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      );
      const hasGoogleSheets = contact.integrations?.some(
        integration => integration.integrationId === 'google-sheets' && integration.config.enabled
      );

      console.log(`🔍 Contact integrations:`, contact.integrations);
      console.log(`🔍 Has API tool: ${hasApiTool}, Domain tool: ${hasDomainTool}, Webhook tool: ${hasWebhookTool}, Google Sheets: ${hasGoogleSheets}`);

      // Create session config with MINIMAL latency settings
      const config: any = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.createSystemPrompt(contact),
        // ULTRA-AGGRESSIVE VAD for INSTANT response
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            prefixPaddingMs: 10, // MINIMAL padding
            silenceDurationMs: 100 // INSTANT cutoff
          }
        },
        // Speech configuration
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.getVoiceForContact(contact)
            }
          }
        }
      };

      // Add tools if integrations are enabled
      const functionDeclarations = [];

      if (hasApiTool) {
        functionDeclarations.push({
          name: "make_api_request",
          description: "Make an HTTP API request to fetch data from external services",
          parameters: {
            type: "object" as const,
            properties: {
              url: { type: "string" as const, description: "The URL to make the request to" },
              method: { type: "string" as const, description: "HTTP method (GET, POST, PUT, DELETE)", enum: ["GET", "POST", "PUT", "DELETE"] },
              headers: { type: "object" as const, description: "HTTP headers as key-value pairs" },
              body: { type: "string" as const, description: "Request body for POST/PUT requests" }
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
            type: "object" as const,
            properties: {
              domain: { type: "string" as const, description: "Base domain name to check (without TLD)" },
              variations: { type: "array" as const, items: { type: "string" as const }, description: "Optional domain variations to check. Use {domain} as placeholder." }
            },
            required: ["domain"]
          }
        });
      }

      if (hasWebhookTool) {
        functionDeclarations.push({
          name: "trigger_webhook",
          description: "Trigger a webhook based on natural language commands",
          parameters: {
            type: "object" as const,
            properties: {
              action: { type: "string" as const, description: "The action the user wants to perform" }
            },
            required: ["action"]
          }
        });
      }

      if (hasGoogleSheets) {
        functionDeclarations.push({
          name: "manage_google_sheets",
          description: "Read, write, search, and manage Google Sheets data",
          parameters: {
            type: "object" as const,
            properties: {
              operation: { type: "string" as const, description: "The operation to perform", enum: ["read", "write", "append", "search", "info", "clear"] },
              sheetIndex: { type: "number" as const, description: "Index of the Google Sheets integration to use", default: 0 },
              range: { type: "string" as const, description: "Cell range for operations" },
              data: { type: "array" as const, items: { type: "array" as const, items: { type: "string" as const } }, description: "2D array of data for write/append operations" },
              searchTerm: { type: "string" as const, description: "Search term for search operation" },
              sheetName: { type: "string" as const, description: "Optional sheet/tab name" }
            },
            required: ["operation"]
          }
        });
      }

      if (functionDeclarations.length > 0) {
        config.tools = [{ functionDeclarations }];
        console.log(`🔧 Tools configured: ${functionDeclarations.map(f => f.name).join(', ')}`);
      }

      // Create Live API session
      this.activeSession = await this.genAI.live.connect({
        model: 'gemini-2.0-flash-live-001',
        config: config,
        callbacks: {
          onopen: () => {
            console.log('✅ Live API session opened');
            this.startAudioCapture();
          },
          onmessage: (message: any) => {
            this.handleMessage(message);
          },
          onerror: (error: any) => {
            console.error('Live API error:', error);
            if (this.onErrorCallback) {
              this.onErrorCallback(new Error(`Live API error: ${error.message}`));
            }
          },
          onclose: (event: any) => {
            console.log('Live API session closed:', event.code, event.reason);
            this.cleanup();
          }
        }
      });
      
      console.log("✅ Gemini Live session started with ULTRA-LOW LATENCY");
      
    } catch (error) {
      console.error("Failed to start Gemini Live session:", error);
      this.isSessionActive = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error("Failed to start session: " + (error as Error).message));
      }
    }
  }

  /**
   * Handle incoming messages from Live API 
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      // Handle tool calls
      if (message.toolCall && this.activeSession) {
        console.log('🔧 Received tool call:', message.toolCall);
        this.updateState('processing');
        
        const functionResponses = [];
        
        for (const fc of message.toolCall.functionCalls) {
          if (fc.name === 'make_api_request') {
            try {
              const { url, method = 'GET', headers = {}, body } = fc.args;
              console.log(`🌐 Making API request: ${method} ${url}`);
              
              const result = await integrationsService.executeApiRequest(url, method, headers, body);
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ API request failed:', error);
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: { success: false, error: (error as Error).message || 'API request failed' }
              });
            }
          }
          
          if (fc.name === 'check_domain_availability') {
            try {
              const { domain, variations } = fc.args;
              console.log(`🔍 Checking domain availability for: ${domain}`);
              
              const result = await this.checkDomainAvailability(domain, variations);
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ Domain check failed:', error);
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: { success: false, error: (error as Error).message || 'Domain check failed' }
              });
            }
          }

          if (fc.name === 'trigger_webhook') {
            try {
              const { action } = fc.args;
              console.log(`🪝 Triggering webhook for action: ${action}`);
              
              const result = await this.triggerWebhook(action);
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: { success: true, data: result }
              });
            } catch (error) {
              console.error('❌ Webhook trigger failed:', error);
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: { success: false, error: (error as Error).message || 'Webhook trigger failed' }
              });
            }
          }

          if (fc.name === 'manage_google_sheets') {
            try {
              const { operation, sheetIndex = 0, range, data, searchTerm, sheetName } = fc.args;
              console.log(`📊 Managing Google Sheets: ${operation}`);
              
              const sheetsIntegrations = this.currentContact?.integrations?.filter(
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
                id: fc.id,
                name: fc.name,
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
                id: fc.id,
                name: fc.name,
                response: { success: false, error: (error as Error).message || 'Google Sheets operation failed' }
              });
            }
          }
        }

        if (functionResponses.length > 0) {
          console.log('📤 Sending tool response...');
          this.activeSession.sendToolResponse({ functionResponses });
        }
        return;
      }

      // Handle interruption
      if (message.serverContent && message.serverContent.interrupted) {
        console.log("🛑 Interruption detected");
        this.stopAudioPlayback();
        this.audioQueue = [];
        this.updateState('listening');
        return;
      }

      // Handle model turn with audio/text
      if (message.serverContent && message.serverContent.modelTurn) {
        const modelTurn = message.serverContent.modelTurn;
        
        if (modelTurn.parts) {
          for (const part of modelTurn.parts) {
            // Handle text response
            if (part.text) {
              console.log("📝 Received text:", part.text);
              if (this.onResponseCallback) {
                this.onResponseCallback({
                  text: part.text,
                  isComplete: false
                });
              }
            }
            
            // Handle audio response - IMMEDIATE playback for low latency
            if (part.inlineData && part.inlineData.data) {
              console.log("🔊 Received audio chunk - playing IMMEDIATELY");
              this.updateState('responding');
              const audioData = this.base64ToInt16Array(part.inlineData.data);
              this.playAudioImmediately(audioData);
            }
          }
        }
        return;
      }

    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  /**
   * IMMEDIATE audio playback - no queuing for ultra-low latency
   */
  private playAudioImmediately(audioData: Int16Array): void {
    if (!this.audioContext) return;

    try {
      // Create audio buffer (Native audio outputs at 24kHz)
      const sampleRate = 24000;
      const audioBuffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert to float32 immediately
      for (let i = 0; i < audioData.length; i++) {
        channelData[i] = audioData[i] / 32768.0;
      }
      
      // Create and play audio source IMMEDIATELY
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.isPlaying = false;
        this.updateState('listening');
      };
      
      // Start IMMEDIATELY - no delays
      source.start(0);
      this.currentSource = source;
      this.isPlaying = true;
      
    } catch (error) {
      console.error("Error playing audio:", error);
      this.isPlaying = false;
      this.updateState('listening');
    }
  }

  /**
   * Start capturing and streaming audio with MINIMAL latency
   */
  private startAudioCapture(): void {
    if (!this.audioStream || !this.audioContext || !this.activeSession) {
      return;
    }

    try {
      console.log("🎤 Starting ULTRA-LOW LATENCY audio capture");
      this.isRecording = true;
      this.updateState('listening');

      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.audioSource = source;
      
      // Use SMALLEST buffer size for INSTANT response (128 samples = 8ms at 16kHz)
      const processor = this.audioContext.createScriptProcessor(128, 1, 1);
      this.audioProcessor = processor;
      
      processor.onaudioprocess = (event) => {
        if (!this.isRecording || !this.activeSession) return;

        const inputData = event.inputBuffer.getChannelData(0);
        
        // INSTANT voice activity detection
        let hasAudio = false;
        for (let i = 0; i < inputData.length; i++) {
          if (Math.abs(inputData[i]) > 0.001) { // Very low threshold for instant response
            hasAudio = true;
            break;
          }
        }

        if (hasAudio) {
          const audioChunk = new Float32Array(inputData);
          this.audioChunks.push(audioChunk);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Send audio chunks every 8ms for INSTANT streaming
      this.processingInterval = window.setInterval(() => {
        this.sendAudioChunks();
      }, 8);

    } catch (error) {
      console.error("Error starting audio capture:", error);
      this.isRecording = false;
      this.updateState('idle');
    }
  }

  /**
   * Send audio chunks IMMEDIATELY with no batching
   */
  private async sendAudioChunks(): Promise<void> {
    if (!this.activeSession || this.audioChunks.length === 0 || !this.isRecording) {
      return;
    }

    try {
      // Send each chunk INDIVIDUALLY for zero latency
      const chunksToSend = [...this.audioChunks];
      this.audioChunks = [];
      
      for (const chunk of chunksToSend) {
        const pcmData = this.fastConvertToPCM16(chunk);
        if (pcmData.length === 0) continue;

        const base64Audio = this.fastPcmToBase64(pcmData);

        // Send IMMEDIATELY
        this.activeSession.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000"
          }
        });
      }

    } catch (error) {
      console.error("Error sending audio:", error);
    }
  }

  /**
   * Ultra-fast Float32 to 16-bit PCM conversion
   */
  private fastConvertToPCM16(audioData: Float32Array): Int16Array {
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = (sample * 32767) | 0;
    }
    return pcmData;
  }

  /**
   * Ultra-fast base64 conversion
   */
  private fastPcmToBase64(pcmData: Int16Array): string {
    const uint8Array = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
  }

  /**
   * Convert base64 to Int16Array for audio playback
   */
  private base64ToInt16Array(base64: string): Int16Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  /**
   * Stop audio playback (for interruptions)
   */
  private stopAudioPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (error) {
        // Ignore errors when stopping
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  /**
   * Get appropriate voice for contact
   */
  private getVoiceForContact(contact: AIContact): string {
    if (contact.voice) {
      return contact.voice;
    }
    
    const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];
    const index = contact.name.charCodeAt(0) % voices.length;
    return voices[index];
  }

  /**
   * Check domain availability using RDAP
   */
  private async checkDomainAvailability(baseDomain: string, customVariations?: string[]): Promise<any> {
    try {
      let variations: string[] = customVariations || [];
      
      if (variations.length === 0) {
        const domainIntegration = this.currentContact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
        );
        
        if (domainIntegration?.config.settings.variations) {
          variations = domainIntegration.config.settings.variations.split('\n').filter((v: string) => v.trim());
        } else {
          variations = ['{domain}.com', '{domain}.net', '{domain}.org', 'try{domain}.com', '{domain}app.com'];
        }
      }

      const maxConcurrent = parseInt(
        this.currentContact?.integrations?.find(
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
  private async triggerWebhook(action: string): Promise<any> {
    try {
      const webhookIntegrations = this.currentContact?.integrations?.filter(
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
        action,
        this.currentContact?.name
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
   * Create system prompt for the contact with PROPER integration and document access
   */
  private createSystemPrompt(contact: AIContact): string {
    let systemPrompt = `You are ${contact.name}. ${contact.description}

Key guidelines for ULTRA-LOW LATENCY conversation:
- Stay in character as ${contact.name}
- Keep responses VERY brief (1-2 sentences maximum) for real-time conversation
- Respond quickly and naturally - this is real-time voice chat
- If interrupted, stop immediately and listen
- Prioritize speed over completeness in responses

You are ${contact.name} and should embody the characteristics described in your profile.`;

    // Check for integrations and add proper instructions
    const hasApiTool = contact.integrations?.some(
      integration => integration.integrationId === 'api-request-tool' && integration.config.enabled
    );

    const hasDomainTool = contact.integrations?.some(
      integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
    );

    const hasWebhookTool = contact.integrations?.some(
      integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
    );

    const hasGoogleSheets = contact.integrations?.some(
      integration => integration.integrationId === 'google-sheets' && integration.config.enabled
    );

    if (hasApiTool) {
      systemPrompt += `\n\n🔧 API REQUEST TOOL AVAILABLE 🔧
You HAVE the make_api_request function. Use it when users ask for real-time information:
- Weather data (use OpenWeatherMap API)
- Cryptocurrency prices (use CoinGecko API) 
- Stock market data
- News articles
- Any real-time web data
Always explain what you're doing when making API requests.`;
    }

    if (hasDomainTool) {
      systemPrompt += `\n\n🔧 DOMAIN CHECKING AVAILABLE 🔧
You HAVE the check_domain_availability function. Use it when users ask about domains:
- "Is [domain] available?"
- "Check if [name] domains are available"
- "Find available domains for [project]"
Extract the base domain name (remove .com, .net, etc.) and call the function.`;
    }

    if (hasWebhookTool) {
      systemPrompt += `\n\n🪝 WEBHOOK TRIGGERS AVAILABLE 🪝
You HAVE the trigger_webhook function. Use it when users ask to activate, trigger, start, launch, or execute workflows.`;
      
      const webhookIntegrations = contact.integrations?.filter(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      ) || [];
      
      if (webhookIntegrations.length > 0) {
        systemPrompt += '\n\nAvailable webhook actions:';
        webhookIntegrations.forEach((webhook, index) => {
          const description = webhook.config.settings.description || 'Webhook action';
          systemPrompt += `\n${index + 1}. ${description}`;
        });
      }
    }

    if (hasGoogleSheets) {
      systemPrompt += `\n\n📊 GOOGLE SHEETS ACCESS AVAILABLE 📊
You HAVE the manage_google_sheets function. Use it when users ask to view, add, update, search, or modify spreadsheet data.`;
    }

    // Add documents if available - PROPERLY FORMAT FOR AI ACCESS
    if (contact.documents && contact.documents.length > 0) {
      systemPrompt += `\n\n=== YOUR KNOWLEDGE BASE ===
You have access to the following documents. Use this information to provide accurate responses:

`;
      contact.documents.forEach(doc => {
        systemPrompt += `📄 DOCUMENT: ${doc.name}
📋 Type: ${doc.type}
📊 Summary: ${doc.summary || 'Document content available'}

📖 CONTENT:
${doc.extractedText || doc.content || 'Content not available'}

---

`;
      });
      
      systemPrompt += `This is your permanent knowledge base. Reference this information throughout conversations to provide accurate and detailed responses.`;
    }

    return systemPrompt;
  }

  /**
   * Update state and notify callback
   */
  private updateState(state: 'idle' | 'listening' | 'processing' | 'responding'): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(state);
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.isRecording = false;
    this.isPlaying = false;
    this.isSessionActive = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
    
    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    
    this.stopAudioPlayback();
    this.activeSession = null;
    this.audioQueue = [];
    this.updateState('idle');
  }

  /**
   * Start listening manually
   */
  public startListening(): void {
    if (!this.isRecording && this.activeSession && !this.isPlaying) {
      this.startAudioCapture();
    }
  }

  /**
   * Stop listening
   */
  public stopListening(): void {
    this.isRecording = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.updateState('idle');
  }

  /**
   * End the current session
   */
  public endSession(): void {
    console.log("🛑 Ending Gemini Live session");
    
    this.cleanup();
    
    if (this.activeSession) {
      this.activeSession.close();
      this.activeSession = null;
    }
    
    this.currentContact = null;
    console.log("✅ Session ended");
  }

  /**
   * Completely shutdown the service
   */
  public shutdown(): void {
    console.log("🛑 Shutting down Gemini Live service");
    
    this.cleanup();
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.activeSession = null;
    this.currentContact = null;
    console.log("✅ Service shutdown complete");
  }

  // Callback setters
  public onResponse(callback: (response: GeminiLiveResponse) => void): void {
    this.onResponseCallback = callback;
  }

  public onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  public onStateChange(callback: (state: 'idle' | 'listening' | 'processing' | 'responding') => void): void {
    this.onStateChangeCallback = callback;
  }

  // Status getters
  public isSpeakingNow(): boolean {
    return this.isPlaying;
  }

  public isListeningNow(): boolean {
    return this.isRecording;
  }
}

// Export singleton instance
export const geminiLiveService = new GeminiLiveService({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  model: 'gemini-2.0-flash-live-001',
  temperature: 0.9,
});