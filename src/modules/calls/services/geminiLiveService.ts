import { GoogleGenAI, Modality } from '@google/genai';
import { UserAgent, AgentIntegration } from '../../../types';
import { IntegrationsService } from '../../../services/integrationsService';

interface GeminiLiveConfig {
  model: string;
  systemInstruction?: string;
  tools?: any[];
  responseModalities: string[];
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName: string;
      };
    };
  };
}

interface AudioChunk {
  data: string;
  timestamp: number;
}

export class GeminiLiveService {
  private genAI: GoogleGenAI;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioQueue: AudioChunk[] = [];
  private isPlaying = false;
  private currentAgent: UserAgent | null = null;
  private integrations: AgentIntegration[] = [];

  // Callbacks
  private onStatusChange?: (status: string) => void;
  private onError?: (error: string) => void;
  private onAudioData?: (data: string) => void;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenAI({ apiKey });
  }

  setCallbacks(callbacks: {
    onStatusChange?: (status: string) => void;
    onError?: (error: string) => void;
    onAudioData?: (data: string) => void;
  }) {
    this.onStatusChange = callbacks.onStatusChange;
    this.onError = callbacks.onError;
    this.onAudioData = callbacks.onAudioData;
  }

  async initializeAudio(): Promise<void> {
    try {
      console.log('🎤 Starting audio initialization...');
      
      // Create AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      console.log('✅ AudioContext created');

      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('✅ Microphone access granted');

    } catch (error) {
      console.error('❌ Audio initialization failed:', error);
      this.onError?.('Failed to initialize audio: ' + (error as Error).message);
      throw error;
    }
  }

  async startSession(agent: UserAgent): Promise<void> {
    try {
      this.currentAgent = agent;
      
      // End existing session if active
      if (this.session) {
        console.log('Session already active, ending current session first');
        await this.endSession();
      }

      // Load agent integrations
      this.integrations = await IntegrationsService.getAgentIntegrations(agent.id);
      console.log('🔍 Contact integrations:', this.integrations);

      // Check what tools are available
      const hasApiTool = this.integrations.some(i => i.template_id === 'api-request');
      const hasDomainTool = this.integrations.some(i => i.template_id === 'domain-search');
      const hasWebhookTool = this.integrations.some(i => i.template_id === 'webhook');
      const hasN8NTool = this.integrations.some(i => i.template_id === 'n8n');
      const hasZapierTool = this.integrations.some(i => i.template_id === 'zapier');
      const hasGoogleSheets = this.integrations.some(i => i.template_id === 'google-sheets');
      
      console.log('🔍 Has API tool:', hasApiTool, 'Domain tool:', hasDomainTool, 'Webhook tool:', hasWebhookTool, 'n8n tool:', hasN8NTool, 'Zapier tool:', hasZapierTool, 'Google Sheets:', hasGoogleSheets);

      // Build tools array for function calling
      const tools: any[] = [];

      // Add integration-based tools
      this.integrations.forEach(integration => {
        switch (integration.template_id) {
          case 'webhook':
            tools.push({
              functionDeclarations: [{
                name: `webhook_${integration.id.replace(/-/g, '_')}`,
                description: `Send data to webhook: ${integration.description || integration.name}`,
                parameters: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      description: 'Data to send to the webhook'
                    },
                    message: {
                      type: 'string',
                      description: 'Message or context about why this webhook is being called'
                    }
                  },
                  required: ['data']
                }
              }]
            });
            break;
          case 'n8n':
            tools.push({
              functionDeclarations: [{
                name: `n8n_${integration.id.replace(/-/g, '_')}`,
                description: `Trigger n8n workflow: ${integration.description || integration.name}. Workflow: ${integration.config.workflow_name || 'Unnamed'}`,
                parameters: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      description: 'Data to send to the n8n workflow'
                    },
                    message: {
                      type: 'string',
                      description: 'Message or context about why this workflow is being triggered'
                    }
                  },
                  required: ['data']
                }
              }]
            });
            break;
          case 'zapier':
            tools.push({
              functionDeclarations: [{
                name: `zapier_${integration.id.replace(/-/g, '_')}`,
                description: `Trigger Zapier Zap: ${integration.description || integration.name}. Zap: ${integration.config.zap_name || 'Unnamed'}`,
                parameters: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      description: 'Data to send to the Zapier Zap'
                    },
                    message: {
                      type: 'string',
                      description: 'Message or context about why this Zap is being triggered'
                    }
                  },
                  required: ['data']
                }
              }]
            });
            break;
          case 'google-sheets':
            tools.push({
              functionDeclarations: [{
                name: `sheets_${integration.id.replace(/-/g, '_')}`,
                description: `Read data from Google Sheets: ${integration.description || integration.name}`,
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'What specific data you want to find or retrieve from the sheet'
                    }
                  },
                  required: ['query']
                }
              }]
            });
            break;
          case 'api-request':
            tools.push({
              functionDeclarations: [{
                name: `api_${integration.id.replace(/-/g, '_')}`,
                description: `Make API request: ${integration.description || integration.name}`,
                parameters: {
                  type: 'object',
                  properties: {
                    endpoint: {
                      type: 'string',
                      description: 'API endpoint path (will be appended to base URL)'
                    },
                    data: {
                      type: 'object',
                      description: 'Data to send with the request'
                    },
                    query: {
                      type: 'string',
                      description: 'What you want to achieve with this API call'
                    }
                  },
                  required: ['query']
                }
              }]
            });
            break;
        }
      });

      // Build system instruction
      let systemInstruction = agent.system_instructions || agent.personality_prompt || 
        `You are ${agent.name}, a helpful AI assistant. ${agent.description}`;

      // Add integration context to system instruction
      if (this.integrations.length > 0) {
        systemInstruction += '\n\nYou have access to the following integrations:\n';
        this.integrations.forEach(integration => {
          systemInstruction += `- ${integration.name}: ${integration.description}\n`;
        });
        systemInstruction += '\nUse these integrations when appropriate to help the user accomplish their goals.';
      }

      // Configure the session
      const config: GeminiLiveConfig = {
        model: 'gemini-2.0-flash-live-001',
        systemInstruction,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: agent.voice || 'Puck'
            }
          }
        }
      };

      // Add tools if available
      if (tools.length > 0) {
        config.tools = tools;
      }

      // Create session with callbacks
      this.session = await this.genAI.live.connect({
        model: config.model,
        config: {
          responseModalities: config.responseModalities,
          systemInstruction: config.systemInstruction,
          speechConfig: config.speechConfig,
          tools: config.tools
        },
        callbacks: {
          onopen: () => {
            console.log('✅ Live API session opened');
            this.onStatusChange?.('connected');
          },
          onmessage: (message: any) => {
            this.handleMessage(message);
          },
          onerror: (error: any) => {
            console.error('❌ Live API error:', error);
            this.onError?.('Live API error: ' + error.message);
          },
          onclose: (event: any) => {
            console.log('🔌 Live API session closed:', event.reason);
            this.onStatusChange?.('disconnected');
          }
        }
      });

      console.log('✅ Gemini Live session started with low latency optimizations');
      
      // Execute chat-start integrations
      await IntegrationsService.executeChatStartIntegrations(agent.id);

    } catch (error) {
      console.error('❌ Failed to start session:', error);
      this.onError?.('Failed to start session: ' + (error as Error).message);
      throw error;
    }
  }

  private handleMessage(message: any): void {
    try {
      // Handle tool calls
      if (message.toolCall) {
        this.handleToolCall(message.toolCall);
        return;
      }

      // Handle server content
      if (message.serverContent) {
        if (message.serverContent.interrupted) {
          console.log('🛑 Generation interrupted');
          this.stopAudioPlayback();
          return;
        }

        if (message.serverContent.turnComplete) {
          console.log('✅ Turn complete');
          return;
        }

        if (message.serverContent.generationComplete) {
          console.log('✅ Generation complete');
          return;
        }
      }

      // Handle audio data
      if (message.data) {
        console.log('🔊 Received audio chunk - adding to queue');
        this.audioQueue.push({
          data: message.data,
          timestamp: Date.now()
        });
        
        // Start playback if not already playing
        if (!this.isPlaying) {
          this.playAudioQueue();
        }
        
        // Notify callback
        this.onAudioData?.(message.data);
      }

    } catch (error) {
      console.error('❌ Error handling message:', error);
      this.onError?.('Error handling message: ' + (error as Error).message);
    }
  }

  private async handleToolCall(toolCall: any): Promise<void> {
    try {
      console.log('🔧 Handling tool call:', toolCall);

      const functionResponses: any[] = [];

      for (const functionCall of toolCall.functionCalls) {
        const functionName = functionCall.name;
        const args = functionCall.args || {};

        console.log('🔧 Executing function:', functionName, 'with args:', args);

        // Find the integration based on function name
        const integrationId = functionName.split('_').slice(1).join('-');
        const integration = this.integrations.find(i => 
          functionName.includes(i.id.replace(/-/g, '_'))
        );

        if (!integration) {
          console.error('❌ Integration not found for function:', functionName);
          functionResponses.push({
            id: functionCall.id,
            name: functionName,
            response: {
              error: 'Integration not found'
            }
          });
          continue;
        }

        // Execute the integration
        const result = await IntegrationsService.executeIntegration(integration, args);

        functionResponses.push({
          id: functionCall.id,
          name: functionName,
          response: {
            success: result.success,
            data: result.data,
            summary: result.summary,
            error: result.error
          }
        });
      }

      // Send tool responses back to the model
      if (functionResponses.length > 0) {
        console.log('📤 Sending tool responses:', functionResponses);
        this.session.sendToolResponse({ functionResponses });
      }

    } catch (error) {
      console.error('❌ Error handling tool call:', error);
      this.onError?.('Error handling tool call: ' + (error as Error).message);
    }
  }

  private async playAudioQueue(): Promise<void> {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioContext) {
      return;
    }

    this.isPlaying = true;

    try {
      while (this.audioQueue.length > 0) {
        const chunk = this.audioQueue.shift();
        if (!chunk) continue;

        // Decode base64 audio data
        const binaryString = atob(chunk.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert to Int16Array (16-bit PCM)
        const audioData = new Int16Array(bytes.buffer);
        
        // Create AudioBuffer
        const audioBuffer = this.audioContext.createBuffer(1, audioData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        
        // Convert Int16 to Float32 and copy to buffer
        for (let i = 0; i < audioData.length; i++) {
          channelData[i] = audioData[i] / 32768.0;
        }

        // Play the audio
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        
        // Wait for audio to finish playing
        await new Promise<void>((resolve) => {
          source.onended = () => resolve();
          source.start();
        });
      }
    } catch (error) {
      console.error('❌ Error playing audio:', error);
    } finally {
      this.isPlaying = false;
    }
  }

  private stopAudioPlayback(): void {
    this.audioQueue = [];
    this.isPlaying = false;
  }

  async startAudioCapture(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio not initialized');
    }

    try {
      console.log('🎤 Starting audio capture');
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Use ScriptProcessorNode for now (will be deprecated but works)
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.audioProcessor.onaudioprocess = (event) => {
        if (!this.session) return;

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert Float32 to Int16
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        // Convert to base64
        const bytes = new Uint8Array(int16Data.buffer);
        const base64 = btoa(String.fromCharCode(...bytes));

        // Send to Gemini Live API
        this.session.sendRealtimeInput({
          audio: {
            data: base64,
            mimeType: 'audio/pcm;rate=16000'
          }
        });
      };

      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);

    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      throw error;
    }
  }

  async stopAudioCapture(): Promise<void> {
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.session) {
      throw new Error('Session not active');
    }

    try {
      this.session.sendClientContent({
        turns: text,
        turnComplete: true
      });
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  async endSession(): Promise<void> {
    try {
      console.log('🛑 Ending Gemini Live session');
      
      await this.stopAudioCapture();
      this.stopAudioPlayback();
      
      if (this.session) {
        this.session.close();
        this.session = null;
      }
      
      console.log('✅ Session ended');
      this.onStatusChange?.('disconnected');
    } catch (error) {
      console.error('❌ Error ending session:', error);
    }
  }

  async cleanup(): Promise<void> {
    await this.endSession();
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  isSessionActive(): boolean {
    return this.session !== null;
  }

  getCurrentAgent(): UserAgent | null {
    return this.currentAgent;
  }
}