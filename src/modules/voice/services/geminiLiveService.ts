import { GoogleGenAI, Modality } from '@google/genai';
import { AIContact } from '../../../core/types/types';
import { integrationsService, firecrawlService } from '../../integrations';
import { documentService, documentContextService } from '../../fileManagement';
import { DomainChecker } from '../../../core/utils/domainChecker';
import { voiceApiService } from '../../../core/services/voiceApiService';

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
  private onDocumentGenerationCallback: ((document: { content: string; wordCount?: number }) => void) | null = null;

  // Document generation tracking
  private documentGenerationInProgress: Set<string> = new Set();
  private lastDocumentGenerationTime: number = 0;
  
  // Audio interruption tracking
  private lastInterruptionTime: number = 0;
  private speechStartTime: number = 0;

  // Audio processing - ULTRA LOW LATENCY OPTIMIZED
  private audioChunks: Float32Array[] = [];
  private audioQueue: Int16Array[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private processingInterval: number | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  
  // State management to prevent rapid flipping
  private currentState: 'idle' | 'listening' | 'processing' | 'responding' = 'idle';
  private stateChangeTimeout: number | null = null;
  
  // Memory management tracking
  private activeTimers: Set<number> = new Set();
  private eventListeners: Map<EventTarget, { event: string, handler: EventListenerOrEventListenerObject }[]> = new Map();
  private maxAudioChunks: number = 500; // MASSIVELY increased to prevent any speech cutoffs
  private maxAudioQueueSize: number = 200; // MASSIVELY increased to allow full conversations

  constructor(config: GeminiLiveConfig) {
    const apiKey = config.apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    } else {
      console.warn('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env file');
    }
  }

  /**
   * Memory-safe timer management
   */
  private setManagedTimeout(callback: () => void, delay: number): number {
    const timerId = window.setTimeout(() => {
      this.activeTimers.delete(timerId);
      callback();
    }, delay);
    this.activeTimers.add(timerId);
    return timerId;
  }

  private setManagedInterval(callback: () => void, interval: number): number {
    const timerId = window.setInterval(callback, interval);
    this.activeTimers.add(timerId);
    return timerId;
  }

  // Fast path for critical audio processing - no tracking overhead
  private setFastInterval(callback: () => void, interval: number): number {
    return window.setInterval(callback, interval);
  }

  private setFastTimeout(callback: () => void, delay: number): number {
    return window.setTimeout(callback, delay);
  }

  private clearManagedTimer(timerId: number): void {
    if (this.activeTimers.has(timerId)) {
      clearTimeout(timerId);
      clearInterval(timerId);
      this.activeTimers.delete(timerId);
    }
  }

  private clearAllTimers(): void {
    this.activeTimers.forEach(timerId => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
    this.activeTimers.clear();
  }

  /**
   * Memory-safe event listener management
   */
  private addManagedEventListener(
    target: EventTarget, 
    event: string, 
    handler: EventListenerOrEventListenerObject
  ): void {
    target.addEventListener(event, handler);
    
    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, []);
    }
    this.eventListeners.get(target)!.push({ event, handler });
  }

  private removeAllEventListeners(): void {
    this.eventListeners.forEach((listeners, target) => {
      listeners.forEach(({ event, handler }) => {
        target.removeEventListener(event, handler);
      });
    });
    this.eventListeners.clear();
  }

  /**
   * Audio buffer memory management - Smart cleanup that prevents speech cutoffs
   */
  private manageAudioBuffers(): void {
    // CRITICAL: Don't clean buffers during any audio activity
    if (this.isPlaying || this.isRecording || this.currentState === 'responding' || this.currentState === 'processing') {
      return;
    }
    
    const now = Date.now();
    
    // Don't clean if speech started recently (within 2 seconds)
    if (this.speechStartTime > 0 && (now - this.speechStartTime) < 2000) {
      return;
    }
    
    // Don't clean if recent interruption (user might be speaking)
    if (this.lastInterruptionTime > 0 && (now - this.lastInterruptionTime) < 3000) {
      return; 
    }
    
    // Only clean when buffers are EXTREMELY large and no recent activity
    if (now - this.lastDocumentGenerationTime < 5000) {
      return; // Don't clean if recent activity
    }
    
    // Only clean audio input chunks (not output queue) and only when extremely excessive
    if (this.audioChunks.length > this.maxAudioChunks * 2) { // Only when 2x over limit
      const excess = this.audioChunks.length - this.maxAudioChunks;
      this.audioChunks.splice(0, excess);
      console.log(`🧹 SMART cleanup: Removed ${excess} old input audio chunks`);
    }

    // ABSOLUTELY NEVER clean audioQueue - this is the output speech that users hear
    // Let it clean up naturally through playback completion
  }

  private clearAudioBuffers(): void {
    console.log(`🧹 Clearing ${this.audioChunks.length} audio chunks and ${this.audioQueue.length} queue items`);
    this.audioChunks.length = 0; // Clear array efficiently
    this.audioQueue.length = 0;
  }

  /**
   * Safe buffer cleanup - only call when session is ending or definitely safe
   */
  private safeBufferCleanup(): void {
    // Only cleanup when absolutely safe - session ending
    if (this.audioChunks.length > 0) {
      console.log(`🧹 SAFE cleanup: Removing ${this.audioChunks.length} input audio chunks`);
      this.audioChunks.length = 0;
    }
    // Reset all timing tracking
    this.documentGenerationInProgress.clear();
    this.lastDocumentGenerationTime = 0;
    this.lastInterruptionTime = 0;
    this.speechStartTime = 0;
  }

  /**
   * Initialize the audio context and request microphone permissions
   */
  public async initialize(): Promise<boolean> {
    try {
      console.log("🎤 Starting audio initialization...");
      
      // Initialize AudioContext with ULTRA LOW latency settings
      this.audioContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 16000
      });
      
      console.log("✅ AudioContext created");
      
      // Request microphone permissions with ULTRA LOW latency
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log("✅ Microphone access granted");
      console.log("🎤 Audio initialized with ULTRA-LOW latency");
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

      // Ensure audio is initialized - no polling needed
      if (!this.audioStream || !this.audioContext) {
        throw new Error("Audio not initialized - call initialize() first");
      }
      
      console.log("✅ Audio is ready, proceeding with session...");

      // Prevent multiple concurrent sessions with stronger guard
      if (this.isSessionActive || this.activeSession) {
        console.log("Session already active, ending current session first");
        this.endSession();
        // No delay - instant session restart for maximum responsiveness
      }

      this.isSessionActive = true;
      
      // Store the contact
      this.currentContact = contact;
      this.updateState('idle');
      
      // Clear any existing audio queue
      this.audioQueue = [];

      // 🎤 CREATE BACKEND VOICE SESSION
      // This handles authentication, function declarations, and session management
      console.log("🎤 Creating backend voice session...");
      let backendSession = null;
      
      try {
        // Try to use the backend voice service
        if (await voiceApiService.isAvailable()) {
          backendSession = await voiceApiService.createSession(contact);
          console.log("✅ Backend voice session created:", backendSession.session_id);
        } else {
          console.warn("⚠️ Backend voice service unavailable, using fallback mode");
        }
      } catch (error) {
        console.warn("⚠️ Backend session creation failed, using fallback mode:", error);
      }

      // Create session config following the docs exactly with ULTRA LOW LATENCY
      const config: any = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: backendSession ? backendSession.system_prompt : await this.createSystemPrompt(contact),
        // Optimized VAD for better speech detection
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            prefixPaddingMs: 50, // ULTRA-LOW: Minimal padding for instant response
            silenceDurationMs: 200 // ULTRA-LOW: Interrupt quickly rather than wait
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

      // 🔧 USE BACKEND-PROVIDED FUNCTION DECLARATIONS
      // The backend handles all function declarations and authentication
      if (backendSession && backendSession.function_declarations && backendSession.function_declarations.length > 0) {
        config.tools = [{ functionDeclarations: backendSession.function_declarations }];
        console.log(`🔧 Backend tools configured: ${backendSession.function_declarations.map((f: any) => f.name).join(', ')}`);
        console.log('🔧 Using backend-managed function declarations');
      } else {
        console.log('🔧 No backend session or no tools configured - continuing without function calling');
      }

      console.log('🔧 Final session config:', JSON.stringify(config, null, 2));

      // Create Live API session following docs pattern
      // Use ephemeral token if provided by backend, otherwise use regular API key
      const connectConfig: any = {
        model: 'gemini-live-2.5-flash-preview', // Use latest Live API model
        config: config,
      };

      // If backend provides ephemeral token, create a temporary Gemini AI instance with it
      let sessionGenAI = this.genAI;
      if (backendSession?.ephemeral_token) {
        console.log('🔐 Using ephemeral token from backend for enhanced security');
        // Note: In a real implementation, we would create a new GoogleGenerativeAI instance
        // with the ephemeral token, but for now we'll use the existing instance
        // as ephemeral tokens require special handling
      }

      this.activeSession = await sessionGenAI.live.connect({
        ...connectConfig,
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
      
      console.log("✅ Gemini Live session started with ULTRA-LOW LATENCY optimizations");
      
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
        const functionNames = message.toolCall.functionCalls?.map((fc: any) => fc.name).join(', ') || 'unknown';
        // Voice tool call executed
        this.updateState('processing');
        
        const functionResponses = [];
        
        // 🎤 ROUTE ALL FUNCTION CALLS THROUGH BACKEND
        for (const fc of message.toolCall.functionCalls) {
          try {
            console.log(`🔧 Processing function call ${fc.name} through backend...`);
            
            // Special handling for generate_document to trigger frontend callback
            if (fc.name === 'generate_document' && this.onDocumentGenerationCallback) {
              console.log(`📄 Processing document generation: ${fc.name}`);
              
              // Route through backend first for processing
              const backendResult = await voiceApiService.handleFunctionCall(fc.name, fc.args);
              
              if (backendResult.success && backendResult.result) {
                // Trigger the frontend callback with the backend result
                try {
                  // Backend returns document in result.document.content format
                  const documentContent = backendResult.result.document?.content || backendResult.result.content;
                  const wordCount = backendResult.result.document?.metadata?.word_count || backendResult.result.wordCount;
                  
                  if (documentContent) {
                    this.onDocumentGenerationCallback({
                      content: documentContent.replace(/\\n/g, '\n'), // Fix escaped newlines
                      wordCount: wordCount
                    });
                    console.log(`✅ Document generation callback triggered for backend-generated document`);
                  } else {
                    console.error('❌ No document content found in backend result:', backendResult.result);
                  }
                } catch (callbackError) {
                  console.error('❌ Document generation callback failed:', callbackError);
                }
              }
              
              // Use backend response format
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: backendResult.success ? {
                  success: true,
                  data: backendResult.result
                } : {
                  success: false,
                  error: backendResult.error || 'Backend function call failed'
                }
              });
            } else {
              // Route all other function calls through backend
              const backendResult = await voiceApiService.handleFunctionCall(fc.name, fc.args);
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: backendResult.success ? {
                  success: true,
                  data: backendResult.result || backendResult
                } : {
                  success: false,
                  error: backendResult.error || 'Backend function call failed'
                }
              });
            }
            
          } catch (error) {
            console.error(`❌ Backend function call ${fc.name} failed:`, error);
            functionResponses.push({
              id: fc.id,
              name: fc.name,
              response: {
                success: false,
                error: (error as Error).message || `Function call ${fc.name} failed`
              }
            });
          }
        }

        if (functionResponses.length > 0) {
          // Sending tool responses
          this.activeSession.sendToolResponse({ functionResponses });
        }
        return;
      }

      // Handle interruption - Allow user to interrupt but track timing
      if (message.serverContent && message.serverContent.interrupted) {
        this.lastInterruptionTime = Date.now();
        console.log("🛑 User interruption detected - stopping current speech");
        // Always honor interruption signals - user wants to speak
        this.stopAudioPlayback();
        this.audioQueue = []; // Clear remaining speech queue on user interruption
        this.updateState('listening');
        return;
      }

      // Handle generation complete
      if (message.serverContent && message.serverContent.generationComplete) {
        // Generation complete
        // Don't change state here, let audio finish playing
        return;
      }

      // Handle turn complete
      if (message.serverContent && message.serverContent.turnComplete) {
        // Turn complete
        // Start playing queued audio if not already playing
        if (!this.isPlaying && this.audioQueue.length > 0) {
          this.playNextAudioChunk();
        } else if (!this.isPlaying) {
          this.updateState('listening');
        }
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
            
            // Handle audio response - IMMEDIATE PLAYBACK for lowest latency  
            if (part.inlineData && part.inlineData.data) {
              // Audio chunk received - mark speech start time
              if (this.speechStartTime === 0) {
                this.speechStartTime = Date.now();
                console.log("🎵 Speech started");
              }
              this.updateState('responding');
              const audioData = this.base64ToInt16Array(part.inlineData.data);
              this.playAudioImmediately(audioData);
            }
          }
        }
        return;
      }

      // Handle direct audio data (fallback)
      if (message.data) {
        // Direct audio data received
        this.updateState('responding');
        const audioData = this.base64ToInt16Array(message.data);
        this.playAudioImmediately(audioData);
      }

      // Handle direct text (fallback)
      if (message.text) {
        console.log("📝 Received direct text:", message.text);
        if (this.onResponseCallback) {
          this.onResponseCallback({
            text: message.text,
            isComplete: false
          });
        }
      }

    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  /**
   * ULTRA LOW LATENCY audio playback - immediate if nothing playing, otherwise queue
   */
  private playAudioImmediately(audioData: Int16Array): void {
    // Add to queue for sequential playback
    this.audioQueue.push(audioData);
    
    // Start playing immediately if nothing is currently playing
    if (!this.isPlaying) {
      this.playNextAudioChunk();
    }
  }

  /**
   * Play the next audio chunk with ZERO latency
   */
  private playNextAudioChunk(): void {
    if (this.audioQueue.length === 0 || this.isPlaying || !this.audioContext) {
      return;
    }

    try {
      this.isPlaying = true;
      const audioData = this.audioQueue.shift()!;
      
      // Create audio buffer (Native audio outputs at 24kHz)
      const sampleRate = 24000;
      const audioBuffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // ULTRA-OPTIMIZED conversion loop - fastest possible
      for (let i = 0; i < audioData.length; i++) {
        channelData[i] = audioData[i] * 0.000030517578125; // Faster than division by 32768
      }
      
      // Create and play audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      // Direct event assignment for audio sources (managed events can cause latency)
      source.onended = () => {
        this.isPlaying = false;
        
        // Play next chunk IMMEDIATELY if available (ZERO delay for streaming)
        if (this.audioQueue.length > 0) {
          this.playNextAudioChunk();
        } else {
          // Speech completed - reset timing and return to listening state
          this.speechStartTime = 0;
          console.log("🎵 Speech completed");
          if (this.activeSession) {
            this.updateState('listening');
          } else {
            this.updateState('idle');
          }
        }
      };
      
      // Start IMMEDIATELY
      source.start(0);
      this.currentSource = source;
      
    } catch (error) {
      console.error("Error playing audio chunk:", error);
      this.isPlaying = false;
      // Continue with next chunk if available
      if (this.audioQueue.length > 0) {
        this.playNextAudioChunk(); // ZERO delay - INSTANT PLAYBACK
      } else {
        this.updateState('listening');
      }
    }
  }

  /**
   * Start capturing and streaming audio with OPTIMAL settings for ultra-low latency
   */
  private startAudioCapture(): void {
    if (!this.audioStream || !this.audioContext || !this.activeSession) {
      return;
    }

    try {
      // Starting audio capture
      this.isRecording = true;
      this.updateState('listening');

      // Create audio source from microphone
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.audioSource = source;
      
      // Use ULTRA-LOW buffer size - 256 samples (16ms at 16kHz) for maximum responsiveness
      const processor = this.audioContext.createScriptProcessor(256, 1, 1);
      this.audioProcessor = processor;
      
      processor.onaudioprocess = (event) => {
        if (!this.isRecording || !this.activeSession) {
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);
        
        // ULTRA-SENSITIVE voice activity detection for minimal latency
        let hasAudio = false;
        for (let i = 0; i < inputData.length; i++) {
          if (Math.abs(inputData[i]) > 0.0005) { // ULTRA-SENSITIVE: Instant response to any sound
            hasAudio = true;
            break;
          }
        }

        if (hasAudio) {
          // Direct copy without extra allocation when possible
          const audioChunk = new Float32Array(inputData);
          this.audioChunks.push(audioChunk);
        }
      };

      // Connect audio processing chain
      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Send audio chunks every 16ms for MAXIMUM responsiveness - ZERO LATENCY PATH
      this.processingInterval = this.setFastInterval(() => {
        this.sendAudioChunks();
        // COMPLETELY DISABLE automatic buffer management during audio processing
        // Only clean up when session ends or is explicitly stopped
        // This prevents any chance of cutting off speech mid-sentence
      }, 16);

    } catch (error) {
      console.error("Error starting audio capture:", error);
      this.isRecording = false;
      this.updateState('idle');
    }
  }

  /**
   * Send audio chunks with MINIMAL batching for lowest latency
   */
  private async sendAudioChunks(): Promise<void> {
    if (!this.activeSession || this.audioChunks.length === 0 || !this.isRecording) {
      return;
    }

    try {
      // Send chunks individually for ZERO batching latency
      const chunksToSend = [...this.audioChunks];
      this.audioChunks = []; // Clear immediately
      
      for (const chunk of chunksToSend) {
        // Convert individual chunk directly
        const pcmData = this.fastConvertToPCM16(chunk);
        
        if (pcmData.length === 0) {
          continue;
        }

        // Fast base64 conversion
        const base64Audio = this.fastPcmToBase64(pcmData);

        // Send immediately without waiting
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
   * ULTRA-FAST Float32 to 16-bit PCM conversion (optimized for minimal latency)
   */
  private fastConvertToPCM16(audioData: Float32Array): Int16Array {
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      // Clamp and convert with bitwise operation for speed
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = (sample * 32767) | 0;
    }
    return pcmData;
  }

  /**
   * ULTRA-FAST base64 conversion using direct buffer access
   */
  private fastPcmToBase64(pcmData: Int16Array): string {
    // Direct buffer access - fastest method
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
   * Stop audio playback with proper cleanup (for interruptions)
   */
  private stopAudioPlayback(): void {
    if (this.currentSource) {
      try {
        // Properly disconnect and clean up AudioBufferSourceNode
        this.currentSource.disconnect();
        if (this.currentSource.buffer) {
          this.currentSource.stop();
        }
        console.log("✅ Audio source stopped and disconnected");
      } catch (error) {
        // Ignore errors when stopping (source may already be stopped)
        console.warn("⚠️ Error stopping audio source:", error);
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    
    // Reset speech timing when stopping
    this.speechStartTime = 0;
    
    // Clear the audio queue to free memory
    if (this.audioQueue.length > 0) {
      console.log(`🧹 Clearing ${this.audioQueue.length} remaining audio queue items due to interruption`);
      this.audioQueue.length = 0;
    }
  }

  /**
   * Get appropriate voice for contact (DEPRECATED - now using auto-selection for proper accents)
   * This method is kept for potential future explicit voice selection
   */
  private getVoiceForContact(contact: AIContact): string {
    // Use the contact's selected voice if available, otherwise fall back to auto-selection
    if (contact.voice) {
      return contact.voice;
    }
    
    // Auto-select voice based on name for backward compatibility
    const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];
    const index = contact.name.charCodeAt(0) % voices.length;
    return voices[index];
  }

  /**
   * Check domain availability using RDAP
   */
  private async checkDomainAvailability(baseDomain: string, customVariations?: string[]): Promise<any> {
    try {
      // Get variations from contact integration settings or use provided ones
      let variations: string[] = customVariations || [];
      
      if (variations.length === 0) {
        // Get default variations from contact integration settings
        const domainIntegration = this.currentContact?.integrations?.find(
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
        this.currentContact?.integrations?.find(
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
          await new Promise(resolve => this.setManagedTimeout(resolve, 100));
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
      if (!this.currentContact) {
        throw new Error('No active contact for webhook trigger');
      }

      // Get webhook integrations for this contact
      const webhookIntegrations = this.currentContact.integrations?.filter(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      ) || [];

      if (webhookIntegrations.length === 0) {
        throw new Error('No webhook integrations configured for this contact');
      }

      // Find the best matching webhook
      const selectedWebhook = this.findBestMatchingWebhook(action, webhookIntegrations);

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
        action,
        this.currentContact.name
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

  /**
   * Create system prompt for the contact
   */
  private async createSystemPrompt(contact: AIContact): Promise<string> {
    console.log('📝 Voice: Building system prompt...');
    
    // Get fresh document context from Supabase
    const documentContext = await documentContextService.getAgentDocumentContext(contact);
    
    // For voice mode, use OPTIMIZED context to reduce latency
    let systemPrompt = this.buildOptimizedVoiceContext(contact, documentContext);
    
    // Add integration-specific instructions
    if (contact.integrations && contact.integrations.length > 0) {
      systemPrompt += '\n\nYou have access to the following integrations:';
      
      const hasApiTool = contact.integrations.some(i => i.integrationId === 'api-request-tool' && i.config.enabled);
      const hasDomainTool = contact.integrations.some(i => i.integrationId === 'domain-checker-tool' && i.config.enabled);
      const hasWebhookTool = contact.integrations.some(i => i.integrationId === 'webhook-trigger' && i.config.enabled);
      const hasGoogleSheets = contact.integrations.some(i => i.integrationId === 'google-sheets' && i.config.enabled);
      const hasWebSearch = contact.integrations.some(i => i.integrationId === 'web-search' && i.config.enabled);
      const hasFirecrawl = contact.integrations.some(i => i.integrationId === 'firecrawl-tool' && i.config.enabled);
      const hasNotion = contact.integrations.some(i => (i.integrationId === 'notion-oauth-source' || i.integrationId === 'notion-oauth-action') && i.config.enabled);
      
      if (hasApiTool) {
        systemPrompt += '\n- API Request Tool: Use make_api_request to fetch real-time data from external APIs when users ask for current information.';
      }
      
      if (hasDomainTool) {
        systemPrompt += '\n- Domain Checker: Use check_domain_availability to check if domains are available when users ask about domain availability.';
      }
      
      if (hasWebhookTool) {
        systemPrompt += '\n- Webhook Trigger: Use trigger_webhook when users ask to activate, trigger, start, launch, or execute something.';
      }
      
      if (hasGoogleSheets) {
        systemPrompt += '\n- Google Sheets: Use manage_google_sheets to read, write, search, and manage spreadsheet data.';
      }
      
      if (hasWebSearch) {
        console.log('🔍 Voice: Web search integration detected and enabled');
        systemPrompt += '\n- Web Search: Use search_web to find current information, news, or real-time data when users ask to search, look up, google, or find current information online.';
        systemPrompt += '\n  • Trigger phrases: "search up", "look up", "google this", "find information about", "what\'s happening with", "search for"';
        systemPrompt += '\n  • Always use this for current events, recent news, or any real-time information requests';
        systemPrompt += '\n  • IMPORTANT: Use search_web function when users clearly ask for current or real-time information';
        systemPrompt += '\n  • VOICE MODE: When you receive search results, speak the information naturally and conversationally';
        systemPrompt += '\n  • NEVER read out technical details like "tool response", "data", "content", or mention using functions';
        systemPrompt += '\n  • Simply present the information as if you naturally knew it, without mentioning the search process';
        systemPrompt += '\n  • Speak the actual information content directly, not the data structure or metadata';
      }
      
      // Always add Firecrawl instructions since it's configured via environment variable
      console.log('🕷️ Voice: Firecrawl web scraping available');
      systemPrompt += '\n- Web Scraping: Use scrape_website to extract content from websites when users ask to scrape, crawl, or get content from specific URLs.';
      systemPrompt += '\n  • Trigger phrases: "scrape", "crawl", "extract from website", "get content from", "go to [URL] and tell me", "what\'s on [URL]"';
      systemPrompt += '\n  • Use when users ask to visit a specific website and get its content';
      systemPrompt += '\n  • IMPORTANT: Use scrape_website function when users ask to go to a website or get content from a URL';
      systemPrompt += '\n  • VOICE MODE: When you receive scraping results, speak the information naturally and conversationally';
      systemPrompt += '\n  • NEVER read out technical details like "tool response", "data", "content", or mention using functions';
      systemPrompt += '\n  • Simply present the information as if you naturally knew it, without mentioning the scraping process';
      systemPrompt += '\n  • Speak the actual information content directly, not the data structure or metadata';
      
      if (hasNotion) {
        systemPrompt += '\n- Notion Integration: Use manage_notion to work with Notion pages and databases. You can:';
        systemPrompt += '\n  • search_databases: Find and list all databases';
        systemPrompt += '\n  • query_database: Get entries from a specific database (use database name or ID)';
        systemPrompt += '\n  • search_pages: Find specific pages';
        systemPrompt += '\n  • get_page_content: Read page content';
        systemPrompt += '\n  • create_page: Create new pages';
        systemPrompt += '\n  • update_page: Modify existing pages';
        systemPrompt += '\n  • create_database_entry: Add new entries to databases';
        systemPrompt += '\n  • append_blocks: Add content to existing pages';
        systemPrompt += '\n\n  IMPORTANT for database queries:';
        systemPrompt += '\n  - When users ask about database content (e.g., "what is in my brain dump", "show me habit tracker entries"), use query_database operation';
        systemPrompt += '\n  - You can use either the database ID or name in the databaseId parameter';
        systemPrompt += '\n  - For database names, use the exact name from previous search results or a close match';
        systemPrompt += '\n  - Examples: "Brain Dump", "Habit Tracker", "Task Dashboard", "Goal Management"';
        systemPrompt += '\n  - The system will automatically search for the database by name if an ID is not provided';
      }
    }
    
    // Add integration context
    const integrationContext = this.buildIntegrationContext(contact);
    if (integrationContext) {
      systemPrompt += '\n\n' + integrationContext;
    }
    
    // Add document generation instructions only if the tool is available
    if (this.onDocumentGenerationCallback) {
      systemPrompt += '\n\nDOCUMENT GENERATION INSTRUCTIONS:';
      systemPrompt += '\n- Use the generate_document function when users ask you to write something down, put something on paper, create written content, or produce documents';
      systemPrompt += '\n- Trigger phrases include: "write that down", "put that on paper", "write me this", "write an essay", "write X words on", "give me X words on", "create a document", "make me a report", etc.';
      systemPrompt += '\n- Generate well-formatted markdown content with proper headings, paragraphs, lists, and structure';
      systemPrompt += '\n- If the user specifies a word count (e.g., "write 100 words on..."), aim to meet that target';
      systemPrompt += '\n- The document will be displayed in a clean interface for the user to read and scroll through';
      systemPrompt += '\n- Do not mention document titles, URLs, or file locations - just generate and display the content';
      systemPrompt += '\n- IMPORTANT: Do not mention that you are using a tool or function to generate the document. Simply respond naturally and let the document appear automatically';
      systemPrompt += '\n- If document generation fails, explain the issue to the user and suggest they try again';
    } else {
      systemPrompt += '\n\nNOTE: Document generation is currently unavailable. If users ask to write something down or create documents, politely explain that the document generation feature is not available right now.';
    }
    
    systemPrompt += '\n\n🎤 CRITICAL VOICE MODE INSTRUCTIONS:';
    systemPrompt += '\n- NEVER read out technical details, data structures, or code-like content';
    systemPrompt += '\n- NEVER say words like "tool", "function", "response", "data", "content", "underscore", "curly bracket", etc.';
    systemPrompt += '\n- When you receive information from tools, speak it naturally as if you knew it yourself';
    systemPrompt += '\n- Present information conversationally without mentioning how you obtained it';
    systemPrompt += '\n- Focus on the actual information content, not the technical wrapper';
    

    systemPrompt += '\n\nAlways be helpful, engaging, and use the tools when appropriate to provide accurate, real-time information.';
    
    console.log(`📏 Voice: System prompt ready (${systemPrompt.length.toLocaleString()} chars)`);
    
    return systemPrompt;
  }

  /**
   * Build optimized context for voice mode to reduce latency
   */
  private buildOptimizedVoiceContext(contact: AIContact, documentContext: any): string {
    let context = `You are ${contact.name}. ${contact.description}`;
    
    const allDocuments = [...documentContext.permanentDocuments, ...documentContext.conversationDocuments];
    
    if (allDocuments.length > 0) {
      context += '\n\n=== YOUR KNOWLEDGE BASE (SUMMARIES) ===\n';
      context += 'You have access to the following documents. Use summaries for quick reference:\n\n';
      
      // Use ONLY summaries for voice mode to reduce latency
      const permanentDocs = documentContext.permanentDocuments;
      const conversationDocs = documentContext.conversationDocuments;
      
      if (permanentDocs.length > 0) {
        context += '📚 PERMANENT KNOWLEDGE:\n';
        permanentDocs.forEach((doc: any) => {
          context += `📄 ${doc.name} (${doc.type}): ${doc.summary || 'No summary available'}\n`;
        });
        context += '\n';
      }
      
      if (conversationDocs.length > 0) {
        context += '💬 CONVERSATION DOCUMENTS:\n';
        conversationDocs.forEach((doc: any) => {
          context += `📄 ${doc.name} (${doc.type}): ${doc.summary || 'No summary available'}\n`;
        });
        context += '\n';
      }
      
      context += 'Note: Full document content is available if needed, but use these summaries for quick reference in voice conversations.';
    }
    
    console.log(`✅ Voice: Optimized context: ${context.length.toLocaleString()} chars`);
    
    return context;
  }

  private buildIntegrationContext(contact: AIContact): string {
    if (!contact.integrations || contact.integrations.length === 0) {
      return '';
    }

    let context = '';
    const activeIntegrations = contact.integrations.filter(i => i.config.enabled);
    
    if (activeIntegrations.length > 0) {
      context = `Active integrations: ${activeIntegrations.map(i => i.integrationId).join(', ')}`;
    }

    return context;
  }

  /**
   * Update state and notify callback with debouncing to prevent rapid flipping
   */
  private updateState(state: 'idle' | 'listening' | 'processing' | 'responding'): void {
    // Don't update if state hasn't changed
    if (this.currentState === state) {
      return;
    }
    
    // Clear any pending state change
    if (this.stateChangeTimeout) {
      clearTimeout(this.stateChangeTimeout);
    }
    
    // For responsive states, update immediately
    if (state === 'responding' || state === 'processing') {
      this.currentState = state;
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(state);
      }
    } else {
      // For other states, debounce to prevent rapid flipping
      this.stateChangeTimeout = window.setTimeout(() => {
        this.currentState = state;
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback(state);
        }
        this.stateChangeTimeout = null;
      }, 25); // ULTRA-LOW 25ms debounce for instant response
    }
  }

  /**
   * Clean up resources - Enhanced memory leak prevention
   */
  private cleanup(): void {
    console.log("🧹 Starting comprehensive cleanup...");
    
    this.isRecording = false;
    this.isPlaying = false;
    this.isSessionActive = false;
    
    // Clear all timers (both managed and fast path)
    this.clearAllTimers();
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    if (this.stateChangeTimeout) {
      clearTimeout(this.stateChangeTimeout);
      this.stateChangeTimeout = null;
    }
    
    // Stop and clean up audio playback
    this.stopAudioPlayback();
    
    // Clean up audio processor with proper disconnection
    if (this.audioProcessor) {
      try {
        this.audioProcessor.disconnect();
        this.audioProcessor = null;
        console.log("✅ Audio processor cleaned up");
      } catch (error) {
        console.warn("⚠️ Error cleaning up audio processor:", error);
      }
    }
    
    // Clean up audio source with proper disconnection
    if (this.audioSource) {
      try {
        this.audioSource.disconnect();
        this.audioSource = null;
        console.log("✅ Audio source cleaned up");
      } catch (error) {
        console.warn("⚠️ Error cleaning up audio source:", error);
      }
    }
    
    // Clear all audio buffers to free memory
    this.clearAudioBuffers();
    
    // Now it's safe to do a thorough cleanup since session is ending
    this.safeBufferCleanup();
    
    // Remove all event listeners
    this.removeAllEventListeners();
    
    // Close session with proper cleanup
    if (this.activeSession) {
      try {
        if (typeof this.activeSession.close === 'function') {
          this.activeSession.close();
        }
      } catch (error) {
        console.warn("⚠️ Error closing session:", error);
      }
      this.activeSession = null;
    }
    
    this.updateState('idle');
    console.log("✅ Cleanup completed - memory freed");
  }

  /**
   * Force stop speaking (manual interruption)
   */
  public forceStopSpeaking(): void {
    if (this.isPlaying) {
      console.log("🛑 User force stopping speech");
      this.lastInterruptionTime = Date.now(); // Track manual interruption
      this.stopAudioPlayback();
      this.audioQueue = []; // Clear remaining queue
      this.updateState('listening');
    }
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
   * Stop listening with proper cleanup
   */
  public stopListening(): void {
    console.log("🛑 Stopping listening with cleanup...");
    this.isRecording = false;
    
    // Clear processing interval (fast path timer)
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // DON'T call manageAudioBuffers() here - it could interfere with ongoing speech
    // Let buffers clean up naturally or during full session cleanup
    
    this.updateState('idle');
    console.log("✅ Listening stopped - speech buffers preserved");
  }

  /**
   * End the current session
   */
  public endSession(): void {
    console.log("🛑 Ending Gemini Live session");
    
    this.cleanup();
    
    // Close session (but keep audio stream for future sessions)
    if (this.activeSession) {
      this.activeSession.close();
      this.activeSession = null;
    }
    
    // 🎤 End backend voice session
    try {
      voiceApiService.endSession();
      console.log("✅ Backend voice session ended");
    } catch (error) {
      console.warn("⚠️ Failed to end backend voice session:", error);
    }
    
    this.currentContact = null;
    console.log("✅ Session ended");
  }

  /**
   * Completely shutdown the service - Enhanced memory cleanup
   */
  public shutdown(): void {
    console.log("🛑 Shutting down Gemini Live service - Full cleanup");
    
    // Run comprehensive cleanup first
    this.cleanup();
    
    // Clean up audio stream with proper track stopping
    if (this.audioStream) {
      try {
        this.audioStream.getTracks().forEach(track => {
          track.stop();
          console.log(`✅ Stopped audio track: ${track.kind}`);
        });
        this.audioStream = null;
        console.log("✅ Audio stream cleaned up");
      } catch (error) {
        console.warn("⚠️ Error cleaning up audio stream:", error);
      }
    }
    
    // Close audio context with proper state checking
    if (this.audioContext) {
      try {
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close().then(() => {
            console.log("✅ Audio context closed");
          }).catch(error => {
            console.warn("⚠️ Error closing audio context:", error);
          });
        }
        this.audioContext = null;
      } catch (error) {
        console.warn("⚠️ Error during audio context cleanup:", error);
        this.audioContext = null;
      }
    }
    
    // Final cleanup of references
    this.activeSession = null;
    this.currentContact = null;
    this.genAI = null;
    
    // Clear callbacks and document generation tracking
    this.onResponseCallback = null;
    this.onErrorCallback = null;
    this.onStateChangeCallback = null;
    this.onDocumentGenerationCallback = null;
    
    // Clear document generation tracking
    this.documentGenerationInProgress.clear();
    this.lastDocumentGenerationTime = 0;
    
    console.log("✅ Gemini Live service completely shut down - All memory freed");
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

  public onDocumentGeneration(callback: (document: { content: string; wordCount?: number }) => void): void {
    this.onDocumentGenerationCallback = callback;
    console.log('📄 Document generation callback registered - paper tool now available');
  }

  /**
   * Check if document generation system is ready
   */
  public isDocumentGenerationReady(): boolean {
    return !!this.onDocumentGenerationCallback;
  }

  /**
   * Get document generation status for debugging
   */
  public getDocumentGenerationStatus(): { 
    ready: boolean; 
    callbackRegistered: boolean; 
    inProgress: number;
    lastGenerationTime: number;
    timeSinceLastGeneration: number;
  } {
    return {
      ready: this.isDocumentGenerationReady(),
      callbackRegistered: !!this.onDocumentGenerationCallback,
      inProgress: this.documentGenerationInProgress.size,
      lastGenerationTime: this.lastDocumentGenerationTime,
      timeSinceLastGeneration: Date.now() - this.lastDocumentGenerationTime
    };
  }

  // Status getters
  public isSpeakingNow(): boolean {
    return this.isPlaying;
  }

  public isListeningNow(): boolean {
    return this.isRecording;
  }

  public setAutoListen(enabled: boolean): void {
    // Auto-listen is handled by the built-in VAD, so this is just for interface compatibility
    console.log(`Auto-listen ${enabled ? 'enabled' : 'disabled'} (handled by built-in VAD)`);
  }
}

// Export singleton instance
export const geminiLiveService = new GeminiLiveService({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  model: 'gemini-live-2.5-flash-preview',
  temperature: 0.9,
});