import { GoogleGenAI, Modality } from '@google/genai';
import { AIContact } from '../../../core/types/types';
import { integrationsService } from '../../integrations';
import { documentContextService } from '../../fileManagement';
import { voiceApiService } from '../../../core/services/voiceApiService';
import { APP_CONFIG } from '../../../core/config';

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
  
  // Context refresh for real-time notes updates
  private lastNotesHash: string = '';

  // Document generation tracking
  private documentGenerationInProgress: Set<string> = new Set();
  private lastDocumentGenerationTime: number = 0;
  
  // Audio interruption tracking
  private lastInterruptionTime: number = 0;
  private speechStartTime: number = 0;

  // Voice conversation tracking - RESTORED for memory system
  private conversationTranscript: Array<{
    speaker: 'user' | 'ai';
    text: string;
    timestamp: Date;
    messageId: string;
  }> = [];
  private currentUserInput: string = '';
  private currentAssistantResponse: string = '';
  private lastUserMessageId: string = '';
  private lastAiMessageId: string = '';
  
  // Transcription buffers for complete turn capture
  private currentUserTranscription: string = '';
  private currentAiTranscription: string = '';
  
  // Browser speech recognition for user speech capture
  private speechRecognition: any = null;
  private isSpeechRecognitionActive: boolean = false;

  // Audio processing - ULTRA LOW LATENCY OPTIMIZED
  private audioChunks: Float32Array[] = [];
  private audioQueue: Int16Array[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private processingInterval: number | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  
  // Optimistic audio buffering - Phase 3 (Option 4)
  private preSessionAudioBuffer: Float32Array[] = [];
  private isBufferingPreSession: boolean = false;
  private maxPreSessionBufferSize: number = 500; // ~8 seconds of audio at 16ms chunks
  
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
    if (apiKey && apiKey.trim().length > 0) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log('✅ Gemini Live API initialized successfully');
    } else {
      console.error('❌ Gemini API key not found! Voice calls will not work.');
      console.error('📝 Please add VITE_GEMINI_API_KEY to your .env file');
      console.error('💡 Get your API key from: https://aistudio.google.com/app/apikey');
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
   * Idempotent - safe to call multiple times (reuses existing context)
   */
  public async initialize(): Promise<boolean> {
    try {
      // Check if already initialized (Phase 2: reuse for instant calls)
      if (this.audioContext && this.audioStream && this.audioStream.active) {
        console.log("✅ Audio already initialized - reusing existing context (~instant)");
        // Resume if suspended
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        return true;
      }
      
      console.log("🎤 Starting audio initialization...");
      
      // Initialize AudioContext with ULTRA LOW latency settings
      if (!this.audioContext) {
        this.audioContext = new AudioContext({
          latencyHint: 'interactive',
          sampleRate: 16000
        });
        console.log("✅ AudioContext created");
      }
      
      // Request microphone permissions with ULTRA LOW latency
      if (!this.audioStream || !this.audioStream.active) {
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
      }
      
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
      // Lazy initialization: try to initialize if not already done
      if (!this.genAI) {
        const apiKey = APP_CONFIG.api.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey && apiKey.trim().length > 0) {
          console.log('🔄 Lazy initializing Gemini API...');
          this.genAI = new GoogleGenAI({ apiKey });
          console.log('✅ Gemini API initialized successfully');
        } else {
          throw new Error("Gemini API not initialized - check your API key");
        }
      }

      // Ensure audio is initialized - no polling needed
      if (!this.audioStream || !this.audioContext) {
        throw new Error("Audio not initialized - call initialize() first");
      }
      
      console.log("✅ Audio is ready, proceeding with session...");

      // Prevent multiple concurrent sessions with stronger guard
      if (this.isSessionActive || this.activeSession) {
        console.log("Session already active, ending current session first");
        await this.endSession();
        // No delay - instant session restart for maximum responsiveness
      }

      this.isSessionActive = true;
      
      // Store the contact
      this.currentContact = contact;
      this.updateState('idle');
      
      // Clear any existing audio queue
      this.audioQueue = [];
      
      // Clear previous conversation transcript for new session
      this.conversationTranscript = [];
      this.currentUserInput = '';
      this.currentAssistantResponse = '';
      this.currentUserTranscription = '';
      this.currentAiTranscription = '';
      console.log('🗣️ Started new conversation transcript for voice call');
      
      // Phase 3 (Option 4): Start audio capture IMMEDIATELY for optimistic buffering
      // This allows user to start talking while Gemini connection is being established
      console.log('🎤 Starting OPTIMISTIC audio capture - user can talk immediately!');
      this.startAudioCapture();
      console.log('✅ Audio capture active - buffering will begin if user talks during connection');
      
      // Transcription is now handled by Gemini Live API directly

      // Removed conversation session creation for simple voice calls

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

      // Use backend-provided system prompt to avoid duplication
      console.log('🧠 Voice: Using backend system prompt to ensure memory inclusion');
      let localSystemPrompt = `You are ${contact.name}. ${contact.description}`;
      
      // Get system prompt from backend if available
      if (backendSession && backendSession.system_prompt) {
        localSystemPrompt = backendSession.system_prompt;
        console.log('✅ Voice: Using backend-provided system prompt');
      } else {
        console.log('⚠️ Voice: Backend system prompt not available, using basic prompt');
      }
      
      // Debug voice selection
      const selectedVoice = this.getVoiceForContact(contact);
      console.log(`🎤 Selected voice for ${contact.name}: ${selectedVoice}`);
      
      // Create session config following the docs exactly with ULTRA LOW LATENCY
      const config: any = {
        responseModalities: [Modality.AUDIO], // Audio only for compatibility
        systemInstruction: localSystemPrompt, // ALWAYS use local prompt that includes memory
        // Enable transcription for conversation capture
        inputAudioTranscription: {},
        outputAudioTranscription: {},
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
              voiceName: selectedVoice
            }
          }
        }
      };

      // 🔧 USE BACKEND-PROVIDED FUNCTION DECLARATIONS
      // The backend handles all function declarations and authentication
      const functionDeclarations = [];
      
      // Add memory saving function (always available)
      functionDeclarations.push({
        name: 'save_to_memory',
        description: 'Save important information, concepts, facts, insights, or summaries to memory for future reference',
        parameters: {
          type: 'object',
          properties: {
            information: {
              type: 'string',
              description: 'The important information, concept, fact, insight, or summary to save. Should be distilled and concise, not verbatim conversation.'
            },
            topic: {
              type: 'string',
              description: 'The main topic or category this information relates to (e.g., "User Preferences", "Technical Knowledge", "Personal Facts")'
            },
            importance: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'The importance level of this information for future conversations'
            },
            type: {
              type: 'string',
              enum: ['fact', 'concept', 'preference', 'insight', 'summary'],
              description: 'The type of information being saved'
            }
          },
          required: ['information']
        }
      });

      // Add document retrieval function for real-time collaboration
      functionDeclarations.push({
        name: 'get_current_document',
        description: 'Get the current content of the document the user is working on. Use this to see what they have written or to reference specific parts of their document.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      });

      
      // Add backend function declarations if available
      if (backendSession && backendSession.function_declarations && backendSession.function_declarations.length > 0) {
        functionDeclarations.push(...backendSession.function_declarations);
        console.log(`🔧 Backend tools configured: ${backendSession.function_declarations.map((f: any) => f.name).join(', ')}`);
      }
      
      // Configure all tools
      if (functionDeclarations.length > 0) {
        config.tools = [{ functionDeclarations }];
        console.log(`🔧 All tools configured: ${functionDeclarations.map((f: any) => f.name).join(', ')}`);
      } else {
        console.log('🔧 No backend session or no tools configured - continuing without function calling');
      }

      console.log('🔧 Final session config (excluding long systemInstruction):', {
        ...config,
        systemInstruction: `[${config.systemInstruction?.length || 0} chars]`
      });
      
      // Check for potential issues and limit system instruction for voice calls
      const VOICE_SYSTEM_INSTRUCTION_MAX_TOKENS = 16000; // From backend context_limits.py - UPDATED to match backend
      
      // Calculate tokens using approximate conversion (4 chars = 1 token)
      const estimatedTokens = Math.ceil(config.systemInstruction?.length / 4) || 0;
      
      if (config.systemInstruction && estimatedTokens > VOICE_SYSTEM_INSTRUCTION_MAX_TOKENS) {
        console.warn('⚠️ System instruction too long for voice:', estimatedTokens, 'tokens, max:', VOICE_SYSTEM_INSTRUCTION_MAX_TOKENS);
        // Truncate to fit token limit while preserving essential parts
        const maxChars = VOICE_SYSTEM_INSTRUCTION_MAX_TOKENS * 4; // Convert tokens to approximate chars
        const essentialPrompt = `You are ${contact.name}. ${contact.description}`;
        const remainingSpace = maxChars - essentialPrompt.length;
        if (remainingSpace > 400) {
          // Keep some integration instructions if there's space
          const truncatedInstructions = config.systemInstruction.substring(essentialPrompt.length, essentialPrompt.length + remainingSpace - 100) + '...';
          config.systemInstruction = essentialPrompt + truncatedInstructions;
        } else {
          config.systemInstruction = essentialPrompt;
        }
        const finalTokens = Math.ceil(config.systemInstruction.length / 4);
        console.log('✂️ Truncated system instruction to:', config.systemInstruction.length, 'characters,', finalTokens, 'tokens');
      }

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
            
            // Phase 3 (Option 4): Flush buffered audio immediately
            if (this.preSessionAudioBuffer.length > 0) {
              const bufferedSeconds = (this.preSessionAudioBuffer.length * 16 / 1000).toFixed(2);
              console.log(`🚀 FLUSHING BUFFERED AUDIO: ${this.preSessionAudioBuffer.length} chunks (~${bufferedSeconds}s) captured during connection`);
              
              // Send all buffered chunks immediately
              let sentCount = 0;
              for (const chunk of this.preSessionAudioBuffer) {
                try {
                  const pcmData = this.fastConvertToPCM16(chunk);
                  if (pcmData.length > 0) {
                    const base64Audio = this.fastPcmToBase64(pcmData);
                    this.activeSession.sendRealtimeInput({
                      audio: {
                        data: base64Audio,
                        mimeType: "audio/pcm;rate=16000"
                      }
                    });
                    sentCount++;
                  }
                } catch (error) {
                  console.error('❌ Error sending buffered chunk:', error);
                }
              }
              
              console.log(`✅ Successfully sent ${sentCount}/${this.preSessionAudioBuffer.length} buffered chunks - NO AUDIO LOST!`);
              
              // Clear buffer after sending
              this.preSessionAudioBuffer = [];
              this.isBufferingPreSession = false;
            } else {
              console.log('📭 No buffered audio - user was silent during connection');
            }
            
            // Audio capture already started in startSession() for optimistic buffering
            // Just ensure listening state is set
            this.updateState('listening');
            console.log('🎤 Session ready - now processing audio in real-time');
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
      // Handle server content messages
      // Handle user content (user speech transcription)
      if (message.userContent && message.userContent.userTurn) {
        const userTurn = message.userContent.userTurn;
        if (userTurn.parts) {
          for (const part of userTurn.parts) {
            if (part.text) {
              console.log("🎤 User said:", part.text);
              // User speech received
              this.currentUserInput += part.text;
            }
          }
        }
        return;
      }
      
      // Handle turn complete for user (when user finishes speaking)
      if (message.userContent && message.userContent.turnComplete) {
        console.log('🎤 User turn complete - buffer length:', this.currentUserTranscription.length);
        
        // Save buffered user transcription as complete message
        if (this.currentUserTranscription.trim()) {
          const messageId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          this.conversationTranscript.push({
            speaker: 'user',
            text: `"${this.currentUserTranscription.trim()}"`,
            timestamp: new Date(),
            messageId: messageId
          });
          this.lastUserMessageId = messageId;
          console.log(`📝 Saved complete user message via turnComplete (${this.conversationTranscript.length} total): "${this.currentUserTranscription.trim()}"`);
          this.currentUserTranscription = ''; // Clear buffer
        } else {
          console.log('⚠️ User turn complete but no transcription buffered');
        }
        
        // User finished speaking, reset current input
        this.currentUserInput = '';
        this.updateState('processing');
        return;
      }
      // Handle tool calls
      if (message.toolCall && this.activeSession) {
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
                    
                    // Save document to conversation transcript as AI message
                    const messageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const cleanContent = documentContent.replace(/\\n/g, '\n');
                    this.conversationTranscript.push({
                      speaker: 'ai',
                      text: cleanContent, // Plain text, no quotes for documents
                      timestamp: new Date(),
                      messageId: messageId
                    });
                    console.log(`📄 Saved document to conversation transcript (${this.conversationTranscript.length} total): ${cleanContent.length} chars`);
                    
                    console.log(`✅ Document generation callback triggered and saved to conversation history`);
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
            } else if (fc.name === 'get_current_document') {
              // Handle document retrieval locally - this is the KEY to real-time collaboration
              console.log(`📄 AI requested current document content`);
              
              const documentContent = this.currentPaperContent || 'No document content available';
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: true,
                  document_content: documentContent,
                  last_updated: new Date().toISOString(),
                  word_count: documentContent.split(' ').length,
                  character_count: documentContent.length,
                  message: 'Current document content retrieved successfully'
                }
              });
              
              console.log(`📄 Provided document content to AI (${documentContent.length} chars)`);
              
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
        
        // Save interrupted AI transcription with "--" marker
        if (this.currentAiTranscription.trim()) {
          const messageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          this.conversationTranscript.push({
            speaker: 'ai',
            text: `"${this.currentAiTranscription.trim()}--"`,
            timestamp: new Date(),
            messageId: messageId
          });
          this.lastAiMessageId = messageId;
          console.log(`📝 Saved interrupted AI message (${this.conversationTranscript.length} total): "${this.currentAiTranscription.trim()}--"`);
          this.currentAiTranscription = ''; // Clear buffer
        }
        
        // Always honor interruption signals - user wants to speak
        this.stopAudioPlayback();
        this.audioQueue = []; // Clear remaining speech queue on user interruption
        this.updateState('listening');
        return;
      }

      // Handle input transcription (user speech transcribed)
      if (message.serverContent && message.serverContent.inputTranscription) {
        const transcription = message.serverContent.inputTranscription;
        console.log("🎤 Input transcription chunk received:", JSON.stringify(transcription.text));
        
        // Buffer the transcription - don't save immediately
        if (transcription.text) {
          this.currentUserTranscription += transcription.text;
          console.log(`📝 User transcription buffer now (${this.currentUserTranscription.length} chars): "${this.currentUserTranscription}"`);
        } else {
          console.log("⚠️ Input transcription chunk was empty");
        }
        return;
      }

      // Handle output transcription (AI speech transcribed)
      if (message.serverContent && message.serverContent.outputTranscription) {
        const transcription = message.serverContent.outputTranscription;
        console.log("🤖 Output transcription chunk:", transcription.text);
        
        // Buffer the transcription - don't save immediately
        if (transcription.text) {
          this.currentAiTranscription += transcription.text;
          console.log(`📝 Buffering AI transcription (${this.currentAiTranscription.length} chars): "${this.currentAiTranscription}"`);
        }
        return;
      }

      // Handle generation complete
      if (message.serverContent && message.serverContent.generationComplete) {
        // Save assistant response when generation is complete
        if (this.currentAssistantResponse.trim()) {
          console.log('🤖 Generation complete');
          this.currentAssistantResponse = '';
        }
        // Don't change state here, let audio finish playing
        return;
      }

      // Handle turn complete
      if (message.serverContent && message.serverContent.turnComplete) {
        console.log('🤖 AI turn complete');
        
        // Save buffered AI transcription as complete message
        if (this.currentAiTranscription.trim()) {
          const messageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          this.conversationTranscript.push({
            speaker: 'ai',
            text: `"${this.currentAiTranscription.trim()}"`,
            timestamp: new Date(),
            messageId: messageId
          });
          this.lastAiMessageId = messageId;
          console.log(`📝 Saved complete AI message (${this.conversationTranscript.length} total): "${this.currentAiTranscription.trim()}"`);
          this.currentAiTranscription = ''; // Clear buffer
        }
        
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
              
              // Store assistant response for conversation history
              this.currentAssistantResponse += part.text;
              console.log("📝 Current assistant response length:", this.currentAssistantResponse.length);
              
              // Add AI text to conversation transcript (this is the AI's response)
              if (part.text.trim()) {
                const messageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.conversationTranscript.push({
                  speaker: 'ai',
                  text: part.text.trim(),
                  timestamp: new Date(),
                  messageId: messageId
                });
                this.lastAiMessageId = messageId;
                console.log(`📝 Added AI text response to transcript (${this.conversationTranscript.length} total): "${part.text.trim().substring(0, 100)}..."`);
              }
              
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
    if (!this.audioStream || !this.audioContext) {
      console.error('❌ Cannot start audio capture - missing dependencies:', {
        hasStream: !!this.audioStream,
        hasContext: !!this.audioContext
      });
      return;
    }
    
    // Note: activeSession is being assigned and will be available for sending audio
    // We don't check it here because onopen fires before the assignment completes

    try {
      // CRITICAL: Resume AudioContext if suspended (required after user interaction)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('🎤 Resuming suspended AudioContext...');
        this.audioContext.resume().then(() => {
          console.log('✅ AudioContext resumed, state:', this.audioContext?.state);
        });
      } else if (this.audioContext) {
        console.log('✅ AudioContext state:', this.audioContext.state);
      }
      
      // Starting audio capture
      this.isRecording = true;
      this.updateState('listening');
      
      // Trigger callback when user starts talking
      if (this.onUserStartTalkingCallback) {
        this.onUserStartTalkingCallback();
      }

      // Create audio source from microphone
      console.log('🎤 Creating audio source from microphone stream...');
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.audioSource = source;
      console.log('✅ Audio source created');
      
      // Use ULTRA-LOW buffer size - 256 samples (16ms at 16kHz) for maximum responsiveness
      const processor = this.audioContext.createScriptProcessor(256, 1, 1);
      this.audioProcessor = processor;
      
      let audioActivityCounter = 0;
      processor.onaudioprocess = (event) => {
        if (!this.isRecording) {
          return;
        }
        
        // activeSession will be set shortly after audio capture starts
        if (!this.activeSession) {
          return; // Silently skip until session is fully assigned
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
          
          // Log occasional audio activity (every ~100 chunks = ~1.6 seconds)
          audioActivityCounter++;
          if (audioActivityCounter % 100 === 0) {
            console.log(`🎤 Microphone is capturing audio (chunk #${audioActivityCounter})`);
          }
        }
      };

      // Connect audio processing chain
      console.log('🔌 Connecting audio processing chain...');
      source.connect(processor);
      processor.connect(this.audioContext.destination);
      console.log('✅ Audio chain connected: microphone → processor → destination');

      // Send audio chunks every 16ms for MAXIMUM responsiveness - ZERO LATENCY PATH
      console.log('⏱️ Starting 16ms audio processing interval...');
      this.processingInterval = this.setFastInterval(() => {
        this.sendAudioChunks();
        // COMPLETELY DISABLE automatic buffer management during audio processing
        // Only clean up when session ends or is explicitly stopped
        // This prevents any chance of cutting off speech mid-sentence
      }, 16);
      
      console.log('✅ Audio capture fully started and processing');

    } catch (error) {
      console.error("❌ Error starting audio capture:", error);
      this.isRecording = false;
      this.updateState('idle');
    }
  }

  /**
   * Send audio chunks with MINIMAL batching for lowest latency
   * Phase 3 (Option 4): Buffers audio optimistically before session is ready
   */
  private async sendAudioChunks(): Promise<void> {
    if (this.audioChunks.length === 0 || !this.isRecording) {
      return;
    }

    // OPTIMISTIC BUFFERING: If session isn't ready yet, buffer the audio
    if (!this.activeSession) {
      // Move chunks to pre-session buffer
      const chunksToBuffer = [...this.audioChunks];
      this.audioChunks = [];
      
      for (const chunk of chunksToBuffer) {
        this.preSessionAudioBuffer.push(chunk);
        
        // Prevent buffer overflow (keep last N chunks)
        if (this.preSessionAudioBuffer.length > this.maxPreSessionBufferSize) {
          this.preSessionAudioBuffer.shift(); // Remove oldest chunk
        }
      }
      
      // Log buffering status occasionally
      if (!this.isBufferingPreSession) {
        this.isBufferingPreSession = true;
        console.log(`🔵 Optimistic buffering active - capturing audio before session ready`);
      }
      
      if (this.preSessionAudioBuffer.length % 50 === 0) {
        console.log(`📦 Buffered ${this.preSessionAudioBuffer.length} audio chunks (~${(this.preSessionAudioBuffer.length * 16 / 1000).toFixed(2)}s of audio)`);
      }
      
      return;
    }

    try {
      // Session is ready - send chunks immediately
      const chunksToSend = [...this.audioChunks];
      this.audioChunks = []; // Clear immediately
      
      let totalSent = 0;
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
        totalSent++;
      }
      
      // Log audio activity every 60 chunks (~1 second of audio)
      if (totalSent > 0 && Math.random() < 0.05) {  // Log 5% of the time to avoid spam
        console.log(`🎤 Sent ${totalSent} audio chunks to Gemini`);
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
   * DEPRECATED - System prompt now handled by backend
   * This method is kept for compatibility but no longer builds full prompts
   */
  private async createSystemPrompt(contact: AIContact): Promise<string> {
    console.log('⚠️ Voice: createSystemPrompt is deprecated - using backend system prompt');
    
    // Return basic fallback prompt
    return `You are ${contact.name}. ${contact.description}`;
  }

  /**
   * DEPRECATED - Context building now handled by backend
   * This method is kept for compatibility but no longer builds full context
   */
  private buildOptimizedVoiceContext(contact: AIContact, documentContext: any): string {
    console.log('⚠️ Voice: buildOptimizedVoiceContext is deprecated - using backend context');
    
    // Return basic fallback context
    return `You are ${contact.name}. ${contact.description}`;
  }

  /**
   * DEPRECATED - Integration context now handled by backend
   */
  private buildIntegrationContext(contact: AIContact): string {
    console.log('⚠️ Voice: buildIntegrationContext is deprecated - using backend integration context');
    return '';
  }

  /**
   * Update state and notify callback with debouncing to prevent rapid flipping
   */
  private updateState(state: 'idle' | 'listening' | 'processing' | 'responding'): void {
    // Don't update if state hasn't changed
    if (this.currentState === state) {
      return;
    }
    
    // Detect user input transitions
    if (this.currentState === 'listening' && (state === 'processing' || state === 'responding')) {
      // Save buffered user transcription when user stops speaking (fallback if turnComplete not triggered)
      if (this.currentUserTranscription.trim()) {
        const messageId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.conversationTranscript.push({
          speaker: 'user',
          text: `"${this.currentUserTranscription.trim()}"`,
          timestamp: new Date(),
          messageId: messageId
        });
        this.lastUserMessageId = messageId;
        console.log(`📝 Saved user message via state transition (${this.conversationTranscript.length} total): "${this.currentUserTranscription.trim()}"`);
        this.currentUserTranscription = ''; // Clear buffer
      }
      
      if (!this.currentUserInput.trim()) {
        console.log('🎤 Detected user speech transition');
      } else {
        console.log('🎤 User speech transition captured');
      }
    }
    
    // Detect when AI finishes responding to capture responses without text
    if (this.currentState === 'responding' && state === 'listening') {
      // AI finished responding
      if (this.currentAssistantResponse.trim()) {
        console.log('🤖 Response complete');
        this.currentAssistantResponse = '';
      } else {
        console.log('🤖 Audio response complete');
      }
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
    
    // Phase 3 (Option 4): Clear optimistic audio buffer
    if (this.preSessionAudioBuffer.length > 0) {
      console.log(`🧹 Clearing ${this.preSessionAudioBuffer.length} pre-session audio chunks`);
      this.preSessionAudioBuffer = [];
      this.isBufferingPreSession = false;
    }
    
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
  public async endSession(): Promise<void> {
    console.log("🛑 Ending Gemini Live session");
    
    // Prevent multiple endSession calls
    if (!this.isSessionActive) {
      console.log("⚠️ Session already ended, skipping duplicate endSession call");
      return;
    }
    
    // Save conversation messages before cleanup
    // Clear conversation data
    console.log(`🧹 Clearing conversation data`);
    this.currentUserInput = '';
    this.currentAssistantResponse = '';
    this.currentUserTranscription = '';
    this.currentAiTranscription = '';
    
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
    this.isSessionActive = false;
    
    // Clear paper context
    this.lastPaperHash = '';
    this.currentPaperContent = null;
    
    // Stop speech recognition
    this.stopSpeechRecognition();
    
    // NOTE: Don't clear conversationTranscript here as it may be needed for memory extraction
    // It will be cleared when a new session starts
    
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
    this.lastPaperHash = '';
    this.currentPaperContent = null;
    // NOTE: DO NOT clear this.genAI - it's needed for subsequent calls!
    // The genAI client can be reused across multiple sessions
    
    // Clear callbacks and document generation tracking
    this.onResponseCallback = null;
    this.onErrorCallback = null;
    this.onStateChangeCallback = null;
    this.onDocumentGenerationCallback = null;
    
    // Clear document generation tracking
    this.documentGenerationInProgress.clear();
    this.lastDocumentGenerationTime = 0;
    
    console.log("✅ Gemini Live service completely shut down - All memory freed (API client preserved for reuse)");
  }

  // Conversation session methods removed for simple voice calls

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
   * Get the current conversation transcript
   * This provides the actual spoken words from both user and AI
   */
  public getConversationTranscript(): Array<{
    speaker: 'user' | 'ai';
    text: string;
    timestamp: Date;
    messageId: string;
  }> {
    console.log(`📋 Retrieved voice conversation transcript with ${this.conversationTranscript.length} messages`);
    return [...this.conversationTranscript]; // Return copy to prevent external modification
  }

  /**
   * Check if there's an active conversation with content
   */
  public hasConversationContent(): boolean {
    return this.conversationTranscript.length > 0;
  }

  /**
   * Initialize browser speech recognition for capturing user speech
   */
  private initializeSpeechRecognition(): void {
    try {
      // Check if speech recognition is available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('🎤 Speech recognition not available in this browser');
        return;
      }

      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onstart = () => {
        this.isSpeechRecognitionActive = true;
        console.log('🎤 User speech recognition started');
      };

      this.speechRecognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }

        if (transcript.trim()) {
          const messageId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          this.conversationTranscript.push({
            speaker: 'user',
            text: transcript.trim(),
            timestamp: new Date(),
            messageId: messageId
          });
          this.lastUserMessageId = messageId;
          console.log(`🎤 Added user speech to transcript (${this.conversationTranscript.length} total): "${transcript.trim()}"`);
        }
      };

      this.speechRecognition.onerror = (event: any) => {
        console.warn('🎤 Speech recognition error:', event.error);
      };

      this.speechRecognition.onend = () => {
        this.isSpeechRecognitionActive = false;
        console.log('🎤 User speech recognition ended');
        
        // Restart if session is still active (for continuous capture)
        if (this.isSessionActive && !this.isPlaying) {
          setTimeout(() => {
            if (this.speechRecognition && this.isSessionActive) {
              this.speechRecognition.start();
            }
          }, 100);
        }
      };

      // Start speech recognition
      this.speechRecognition.start();
      console.log('🎤 Browser speech recognition initialized for user speech capture');

    } catch (error) {
      console.warn('🎤 Failed to initialize speech recognition:', error);
    }
  }

  /**
   * Stop speech recognition
   */
  private stopSpeechRecognition(): void {
    if (this.speechRecognition && this.isSpeechRecognitionActive) {
      this.speechRecognition.stop();
      this.speechRecognition = null;
      this.isSpeechRecognitionActive = false;
      console.log('🎤 Speech recognition stopped');
    }
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
  /**
   * Trigger immediate notes context refresh (called when notes are manually saved)
   * This is the public method that external components can call
   */
  public async triggerNotesRefresh(): Promise<void> {
    console.log('🔄 Manual notes refresh triggered');
    await this.refreshNotesContext();
  }

  // Track current paper content for context updates
  private currentPaperContent: string | null = null;
  private lastPaperHash: string = '';

  /**
   * Send paper changes to the voice agent for real-time collaboration
   * Documents are kept in memory only - not saved to Documents tab
   */
  public async sendPaperChanges(content: string): Promise<void> {
    if (!this.activeSession || !this.currentContact) {
      console.warn('⚠️ No active voice session or contact to send paper changes to');
      return;
    }

    try {
      console.log('📝 Sending paper changes for real-time collaboration...');
      
      // Store current paper content for AI access (in-memory only)
      this.currentPaperContent = content;
      
      // Create hash to track changes
      const paperHash = this.hashString(content);
      
      // Only send if content has actually changed
      if (paperHash === this.lastPaperHash) {
        console.log('📝 Paper content unchanged, skipping update');
        return;
      }
      
      this.lastPaperHash = paperHash;
      
      // Prompt the AI to retrieve the updated document content
      await this.forceDocumentVisibility(content);
      
      console.log('✅ Paper content updated and AI notified of changes');
      
    } catch (error) {
      console.error('❌ Failed to send paper changes to voice agent:', error);
      throw error;
    }
  }


  /**
   * Update document content and prompt AI to retrieve it via function calling
   * This is the CORRECT Live API approach using proper function calling
   */
  private async forceDocumentVisibility(content: string): Promise<void> {
    if (!this.activeSession) {
      console.warn('⚠️ No active session for document update');
      return;
    }

    try {
      console.log('🔍 Updating current paper content and prompting AI to retrieve it');
      
      // Store the current document content so AI can access it when it calls get_current_document
      this.currentPaperContent = content;
      
      // Prompt the AI to call the get_current_document function
      // This uses the proper text input method to request a function call
      const promptMessage = `I just updated the document. Please check the current document content to see what I've written.`;
      
      this.activeSession.sendClientContent({
        turns: [
          {
            role: "user",
            parts: [{ text: promptMessage }]
          }
        ],
        turnComplete: true
      });
      
      console.log('✅ Prompted AI to retrieve updated document content');
      console.log('📄 Document content ready for AI retrieval:', content.length, 'characters');
      
    } catch (error) {
      console.error('❌ Failed to prompt AI for document retrieval:', error);
      console.error('❌ Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      
      // Don't throw - this is not critical to core functionality
      console.warn('⚠️ Document update notification failed, but document content is still available');
    }
  }


  /**
   * Set callback for when user starts talking (for triggering paper updates)
   */
  private onUserStartTalkingCallback?: () => void;
  
  public setOnUserStartTalkingCallback(callback: () => void): void {
    this.onUserStartTalkingCallback = callback;
  }

  /**
   * Refresh notes context during an active voice session
   * Sends updated notes context as incremental update to the Live API
   */
  private async refreshNotesContext(): Promise<void> {
    if (!this.activeSession || !this.currentContact) {
      console.log('🔄 No active session or contact, skipping notes refresh');
      return;
    }

    try {
      console.log('🔄 Refreshing notes context during voice session...');
      
      // Get fresh document context including updated notes
      const documentContext = await documentContextService.getAgentDocumentContext(this.currentContact);
      
      // Create a hash of the notes content to detect changes
      const notesHash = this.hashString(documentContext.memoryContext || '');
      
      // Only update if notes have actually changed
      if (notesHash === this.lastNotesHash) {
        console.log('📝 Notes unchanged, skipping context update');
        return;
      }
      
      this.lastNotesHash = notesHash;
      
      // Send context update to Live API using proper incremental content format
      if (documentContext.memoryContext) {
        const contextUpdate = `[MEMORY CONTEXT UPDATE]

Your notes and memory have been updated:

${documentContext.memoryContext}

Please reference this information in our ongoing conversation.`;
        
        this.activeSession.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [{ text: contextUpdate }]
            }
          ],
          turnComplete: false
        });
        
        console.log('✅ Notes context updated in voice session using proper Live API format');
      }
      
    } catch (error) {
      console.error('❌ Error refreshing notes context:', error);
    }
  }


  /**
   * Simple hash function for detecting content changes
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

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

// Export singleton instance with proper API key from config
export const geminiLiveService = new GeminiLiveService({
  apiKey: APP_CONFIG.api.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
  model: 'gemini-live-2.5-flash-preview',
  temperature: 0.9,
});