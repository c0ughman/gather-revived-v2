import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Mic, MicOff, PhoneOff, Pause, Plus, MoreVertical, FileText } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { CallState } from '../types/voice';
import { geminiLiveService } from '../services/geminiLiveService';
import { memoryService } from '../../../core/services/memoryService';
import DocumentDisplay from './DocumentDisplay';

interface CallScreenProps {
  contact: AIContact;
  callState: CallState;
  onBack: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  onNoteAdded?: () => void;
  isEndingCall?: boolean;
  onCallReady?: () => void; // Callback when call is ready and listening
}

export default function CallScreen({ 
  contact, 
  callState, 
  onBack, 
  onEndCall, 
  onToggleMute,
  showSidebar = true,
  onToggleSidebar,
  onNoteAdded,
  isEndingCall = false,
  onCallReady
}: CallScreenProps) {
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [responseText, setResponseText] = useState<string>("");
  const [serviceState, setServiceState] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle');
  const [documentContent, setDocumentContent] = useState<string>("");
  const [showDocument, setShowDocument] = useState(false);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [documentHistory, setDocumentHistory] = useState<Array<{
    id: string;
    content: string;
    wordCount?: number;
    timestamp: Date;
  }>>([]);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState<number>(-1);
  const [isPaused, setIsPaused] = useState(false);
  const pendingPaperUpdateRef = useRef<{ content: string, hasChanged: boolean } | null>(null);
  const currentEditorContentRef = useRef<string>("");
  const serviceInitialized = useRef(false);
  const initializationInProgress = useRef(false);
  const initializedContactIdRef = useRef<string | null>(null);
  
  // Timers for document sync
  const debounceTimerRef = useRef<number | null>(null);
  const periodicTimerRef = useRef<number | null>(null);
  const lastChangeTimeRef = useRef<number>(0);

  useEffect(() => {
    // Only run initialization if we're connecting and haven't initialized for this contact yet
    const needsInitialization = callState.status === 'connecting' && 
                                 initializedContactIdRef.current !== contact.id &&
                                 !initializationInProgress.current;
    
    if (needsInitialization) {
      console.log(`🎯 Initializing call for contact: ${contact.id}`);
      setPulseAnimation(true);
      
      // Phase 3 (Option 4): Show "Listening..." IMMEDIATELY for optimistic UI
      setServiceState('listening');
      console.log('🎤 OPTIMISTIC UI: Showing "Listening..." immediately - audio buffering active');
      
      // Clear document history for new call
      setDocumentHistory([]);
      setCurrentDocumentIndex(-1);
      setShowDocument(false);
      setDocumentContent("");
      setIsGeneratingDocument(false);
      
      // Initialize the Gemini Live service when call is connecting
      const initService = async () => {
        initializationInProgress.current = true;
        const startTime = Date.now();
        console.log("⏱️ [0ms] Starting call initialization...");
        
        try {
          console.log("🚀 Starting service initialization...");
          
          // Set up event handlers first
          geminiLiveService.onResponse((response) => {
            setResponseText(response.text);
          });
          
          geminiLiveService.onError((error) => {
            console.error("Gemini Live error:", error);
            setResponseText("I'm having trouble with the connection. Let's try again.");
          });
          
          geminiLiveService.onStateChange((state) => {
            console.log(`🔄 Service state changed to: ${state}`);
            setServiceState(state);
            
            // Detect when document generation might be starting
            if (state === 'processing') {
              // Check if the last response text contains document-related keywords
              const lastResponse = responseText.toLowerCase();
              const documentKeywords = [
                'write', 'document', 'paper', 'essay', 'create', 'generate', 
                'put that down', 'write that down', 'make a note', 'take notes',
                'draft', 'compose', 'formulate', 'prepare', 'develop'
              ];
              
              const hasDocumentKeywords = documentKeywords.some(keyword => 
                lastResponse.includes(keyword)
              );
              
              if (hasDocumentKeywords) {
                setIsGeneratingDocument(true);
              }
            }
          });
          
          // Set up document generation callback
          geminiLiveService.onDocumentGeneration((document) => {
            console.log("📄 Document generated:", document);
            setIsGeneratingDocument(false);
            
            // Add new document to history
            const newDocument = {
              id: Date.now().toString(),
              content: document.content,
              wordCount: document.wordCount,
              timestamp: new Date()
            };
            
            setDocumentHistory(prev => [...prev, newDocument]);
            setCurrentDocumentIndex(prev => prev + 1);
            
            // Show the new document
            setDocumentContent(document.content);
            currentEditorContentRef.current = document.content;
            setShowDocument(true);
          });
          
          // Set up callback to send paper updates when user starts talking (fallback for immediate sync)
          const handleUserStartTalking = () => {
            // Check if there are pending changes that haven't been sent yet
            const currentPendingUpdate = pendingPaperUpdateRef.current;
            if (currentPendingUpdate?.hasChanged) {
              console.log('👤 User started talking, sending pending paper update immediately...');
              sendDocumentToAI(currentPendingUpdate.content);
              
              // Clear the debounce timer since we're sending now
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
            }
          };
          
          geminiLiveService.setOnUserStartTalkingCallback(handleUserStartTalking);
          
          // 🔀 PARALLEL EXECUTION: Initialize audio AND start session simultaneously
          const audioStartTime = Date.now();
          console.log(`⏱️ [${audioStartTime - startTime}ms] 🔀 Starting PARALLEL initialization (audio + session)...`);
          
          // Start both operations at the same time
          const [initialized, sessionResult] = await Promise.all([
            geminiLiveService.initialize(),
            (async () => {
              const sessionStartTime = Date.now();
              console.log(`⏱️ [${sessionStartTime - startTime}ms] 🔀 Starting Gemini session (parallel)...`);
              await geminiLiveService.startSession(contact);
              const sessionEndTime = Date.now();
              console.log(`⏱️ [${sessionEndTime - startTime}ms] ✅ Session started (took ${sessionEndTime - sessionStartTime}ms)`);
              return true;
            })()
          ]);
          
          const parallelEndTime = Date.now();
          console.log(`⏱️ [${parallelEndTime - startTime}ms] ✅ PARALLEL operations completed (took ${parallelEndTime - audioStartTime}ms)`);
          
          if (initialized && sessionResult) {
            console.log("✅ Both audio and session ready!");
            
            serviceInitialized.current = true;
            initializedContactIdRef.current = contact.id; // Mark this contact as initialized
            
            // Force listening state immediately (defensive - session should already be listening)
            setServiceState('listening');
            console.log('🎤 Forced listening state for immediate UI feedback');
            
            // Notify parent that call is ready - no artificial delay!
            if (onCallReady) {
              onCallReady();
            }
            
            const totalTime = Date.now() - startTime;
            console.log(`⏱️ ✅ TOTAL TIME: ${totalTime}ms - Service fully initialized and ready to listen`);
            console.log(`🚀 Phase 2 speedup: Operations ran in parallel!`);
          } else {
            console.error("❌ Initialization failed");
            setResponseText("Could not start voice session. Please try again.");
          }
        } catch (error) {
          console.error("❌ Failed to initialize Gemini Live service:", error);
          setResponseText("Failed to start voice chat. Please try again.");
        } finally {
          initializationInProgress.current = false;
        }
      };
      
      initService();
    } else if (callState.status === 'connecting' && !needsInitialization) {
      // Just update animation if already initialized
      setPulseAnimation(true);
    } else {
      setPulseAnimation(false);
    }
    
    return () => {
      // Clean up timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (periodicTimerRef.current) {
        clearInterval(periodicTimerRef.current);
      }
    };
  }, [contact.id, callState.status]); // Depend on both contact.id and callState.status
  
  // Separate effect to handle actual component unmount
  useEffect(() => {
    return () => {
      // This runs only when component actually unmounts
      if (serviceInitialized.current) {
        console.log("🧹 CallScreen unmounting - ending session (not shutdown)");
        // Use endSession instead of shutdown to preserve the API client for next call
        geminiLiveService.endSession();
        serviceInitialized.current = false;
        initializedContactIdRef.current = null;
        console.log("✅ Voice service cleanup completed");
      }
    };
  }, []); // Empty deps = runs only on mount/unmount

  // Keyboard event listener for document navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showDocument) {
        if (event.key === 'Escape') {
          handleCloseDocument();
        } else if (event.key === 'ArrowRight' && documentHistory.length > 1) {
          showNextDocument();
        } else if (event.key === 'ArrowLeft' && documentHistory.length > 1) {
          showPreviousDocument();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDocument, documentHistory.length, currentDocumentIndex]);

  useEffect(() => {
    if (callState.status === 'ended') {
      setIsPaused(false);
    }
  }, [callState.status]);

  const sendDocumentToAI = async (content: string) => {
    if (!content || !content.trim()) {
      console.warn('⚠️ No content to send to AI');
      return;
    }
    
    if (callState.status !== 'connected') {
      console.warn('⚠️ Call not connected, cannot send document update');
      return;
    }
    
    try {
      console.log('📝 Sending document update to AI...', content.substring(0, 100) + '...');
      await geminiLiveService.sendPaperChanges(content);
      console.log('✅ Document update sent to AI successfully');
    } catch (error) {
      console.error('❌ Failed to send document update to AI:', error);
    }
  };

  const getServiceStateText = () => {
    switch (serviceState) {
      case 'idle':
        return 'Ready';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'responding':
        return 'Speaking...';
      default:
        return 'Unknown';
    }
  };

  const getServiceStateColor = () => {
    switch (serviceState) {
      case 'idle':
        return 'text-slate-400';
      case 'listening':
        return 'text-green-400';
      case 'processing':
        return 'text-yellow-400';
      case 'responding':
        return 'text-green-400';
      default:
        return 'text-slate-400';
    }
  };

  const handleMicToggle = async () => {
    onToggleMute();
  };

  const handleEndCall = () => {
    // Don't call endSession here - let App.tsx handle it to avoid double calls
    // Just trigger the parent's onEndCall which will handle everything
    onEndCall();
  };

  const toggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  const handleViewLatestDocument = () => {
    if (documentHistory.length > 0) {
      showDocumentAtIndex(documentHistory.length - 1);
    }
  };

  const handlePauseToggle = () => {
    setIsPaused((prev) => !prev);
  };

  const createAgentGradient = (color: string) => {
    // Parse the color to create a gradient
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    // Create lighter components for gradient
    const lightCompR = Math.min(255, r + 50);
    const lightCompG = Math.min(255, g + 50);
    const lightCompB = Math.min(255, b + 50);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  const handleCloseDocument = () => {
    setShowDocument(false);
    setDocumentContent("");
    setIsGeneratingDocument(false);
    setCurrentDocumentIndex(-1);
  };

  const handleSaveToNotes = async (title: string, content: string) => {
    try {
      console.log('🔧 Attempting to save to notes:', { 
        agentId: contact.id, 
        title: title.substring(0, 50) + '...', 
        contentLength: content.length 
      });
      
      const savedNote = await memoryService.createPaperNote({
        agent_id: contact.id,
        title: title,
        content: content,
        note_type: 'voice_call'
      });
      
      console.log('✅ Document saved to notes successfully:', savedNote.id);
      
      // Notify parent that a note was added so it can refresh the notes list
      if (onNoteAdded) {
        onNoteAdded();
      }
    } catch (error) {
      console.error('❌ Error saving document to notes:', error);
      // Re-throw to let DocumentDisplay show the error
      throw error;
    }
  };

  const showDocumentAtIndex = (index: number) => {
    if (index >= 0 && index < documentHistory.length) {
      const doc = documentHistory[index];
      setDocumentContent(doc.content);
      setCurrentDocumentIndex(index);
      currentEditorContentRef.current = doc.content;
      setShowDocument(true);
    }
  };

  const handlePaperContentChange = (newContent: string, hasChanged: boolean) => {
    // Update the document content locally
    setDocumentContent(newContent);
    
    // Always track current editor content for voice integration
    currentEditorContentRef.current = newContent;
    
    // Update the document in history
    if (currentDocumentIndex >= 0 && currentDocumentIndex < documentHistory.length) {
      setDocumentHistory(prev => {
        const updated = [...prev];
        updated[currentDocumentIndex] = {
          ...updated[currentDocumentIndex],
          content: newContent,
          wordCount: newContent.split(' ').length
        };
        return updated;
      });
    }
    
    // Store pending update if document has been changed
    if (hasChanged) {
      const now = Date.now();
      const update = { content: newContent, hasChanged: true };
      pendingPaperUpdateRef.current = update;
      lastChangeTimeRef.current = now;
      
      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set up 5-second debounced update
      debounceTimerRef.current = window.setTimeout(() => {
        // Double-check that enough time has passed since last change
        const timeSinceLastChange = Date.now() - lastChangeTimeRef.current;
        
        if (timeSinceLastChange >= 4900) { // Allow small margin for timer precision
          sendDocumentToAI(pendingPaperUpdateRef.current?.content || newContent);
        }
        debounceTimerRef.current = null;
      }, 5000);
      
      // Start periodic timer if not already running
      if (!periodicTimerRef.current) {
        periodicTimerRef.current = window.setInterval(() => {
          const currentPending = pendingPaperUpdateRef.current;
          if (currentPending?.hasChanged) {
            sendDocumentToAI(currentPending.content);
          }
        }, 30000);
      }
    } else {
      // Clear pending update if document is back to original
      pendingPaperUpdateRef.current = null;
      
      // Clear timers since no changes to sync
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (periodicTimerRef.current) {
        clearInterval(periodicTimerRef.current);
        periodicTimerRef.current = null;
      }
    }
  };


  const showNextDocument = () => {
    if (currentDocumentIndex < documentHistory.length - 1) {
      showDocumentAtIndex(currentDocumentIndex + 1);
    }
  };

  const showPreviousDocument = () => {
    if (currentDocumentIndex > 0) {
      showDocumentAtIndex(currentDocumentIndex - 1);
    }
  };

  // Calculate main content width based on sidebar visibility
  const mainContentClass = showSidebar ? "w-full" : "w-full";
  const canToggleSidebar = Boolean(onToggleSidebar);
  const latestDocumentAvailable = documentHistory.length > 0;

  return (
    <div className="h-full bg-glass-bg flex flex-col relative">
      {/* Document Display Overlay */}
      {showDocument && (
        <div className="absolute inset-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm">
          <DocumentDisplay
            content={documentContent}
            isVisible={showDocument}
            onClose={handleCloseDocument}
            documentIndex={currentDocumentIndex}
            totalDocuments={documentHistory.length}
            onNextDocument={showNextDocument}
            onPreviousDocument={showPreviousDocument}
            canNavigate={documentHistory.length > 1}
            agentId={contact.id}
            onSaveToNotes={handleSaveToNotes}
            onContentChange={handlePaperContentChange}
          />
        </div>
      )}

      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-structural-strong bg-glass-panel glass-effect">
        <button
          onClick={onBack}
          className="p-3 rounded-full hover:bg-slate-800 transition-colors duration-200"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="text-center">
          <h2 className="text-white text-xl font-semibold">{contact.name}</h2>
          <p className={`text-sm font-medium ${getServiceStateColor()}`}>
            {getServiceStateText()}
          </p>
        </div>
        
        <button 
          onClick={toggleSidebar}
          className="p-3 rounded-full hover:bg-slate-800 transition-colors duration-200"
        >
          <MoreVertical className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      {/* Main Call Area */}
      <div className={`flex-1 flex flex-col items-center justify-center px-8 ${mainContentClass}`}>
        {/* Avatar */}
        <div className="relative mb-10">
          <div
            className={`w-56 h-56 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-300 overflow-hidden ${
              pulseAnimation ? 'animate-pulse scale-110' : ''
            }`}
          >
            {contact.avatar ? (
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <div
                className="w-full h-full rounded-2xl"
                style={{ background: createAgentGradient(contact.color) }}
              />
            )}
          </div>
          
        </div>

        {/* Contact Info */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">{contact.name}</h1>
          {contact.description && (
            <p className="text-slate-300 text-base max-w-md mx-auto leading-relaxed ellipsis-2">
              {contact.description}
            </p>
          )}
        </div>
        
        {/* Response Text */}
        {responseText && callState.status === 'connected' && (
          <div className="mb-8 max-w-md bg-slate-800 bg-opacity-70 p-4 rounded-lg border-card">
            <p className="text-slate-300 text-sm italic">"{responseText}"</p>
          </div>
        )}

        {/* Document Generation Indicator */}
        {isGeneratingDocument && (
          <div className="mb-8 max-w-md bg-blue-900 bg-opacity-50 p-4 rounded-lg border-status-info">
            <div className="flex items-center space-x-2 text-blue-300 text-sm">
              <div className="w-4 h-4 border-spinner-blue rounded-full animate-spin"></div>
              <span>Generating your document...</span>
            </div>
          </div>
        )}

        {/* Document History Indicator */}
        {documentHistory.length > 0 && !showDocument && !isGeneratingDocument && (
          <div className="mb-8 max-w-md bg-slate-800 bg-opacity-50 p-4 rounded-lg border-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-300 text-sm">
                <FileText className="w-4 h-4" />
                <span>{documentHistory.length} document{documentHistory.length > 1 ? 's' : ''} generated</span>
              </div>
              <button
                onClick={() => showDocumentAtIndex(documentHistory.length - 1)}
                className="text-xs text-[#186799] hover:text-[#1a5a7a] px-2 py-1 rounded border-control border-control-hover"
              >
                View Latest
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="pb-8 px-0">
        <div className="w-full flex justify-center">
          <div className="bg-slate-900/70 border-card rounded-3xl px-[5px] py-3 w-fit">
            <div className="grid grid-cols-5 gap-[20px]">
              <button
                onClick={toggleSidebar}
                disabled={!canToggleSidebar}
                aria-label="Add action"
                className={`w-16 h-16 mx-auto flex items-center justify-center rounded-full transition-all duration-200 ${
                  canToggleSidebar
                    ? 'bg-slate-700 hover:bg-slate-600 shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-slate-700 opacity-40 cursor-not-allowed'
                }`}
              >
                <Plus className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={handleViewLatestDocument}
                aria-label="Open notes"
                className={`w-16 h-16 mx-auto flex items-center justify-center rounded-full transition-all duration-200 ${
                  latestDocumentAvailable
                    ? 'bg-slate-700 hover:bg-slate-600 shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 shadow-lg hover:shadow-xl hover:scale-105'
                }`}
              >
                {isGeneratingDocument ? (
                  <div className="w-8 h-8 border-spinner-blue rounded-full animate-spin"></div>
                ) : (
                  <FileText className="w-6 h-6 text-white" />
                )}
              </button>

              <button
                onClick={handlePauseToggle}
                aria-label={isPaused ? 'Resume call' : 'Pause call'}
                className={`group w-16 h-16 mx-auto flex items-center justify-center rounded-full transition-all duration-200 ${
                  isPaused
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-slate-700 hover:bg-slate-600 shadow-lg hover:shadow-xl hover:scale-105'
                }`}
              >
                <Pause className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={handleMicToggle}
                aria-label={callState.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`group w-16 h-16 mx-auto flex items-center justify-center rounded-full transition-all duration-200 ${
                  callState.isMuted
                    ? 'bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-slate-700 hover:bg-slate-600 shadow-lg hover:shadow-xl hover:scale-105'
                }`}
              >
                {callState.isMuted ? (
                  <MicOff className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>

              <button
                onClick={handleEndCall}
                disabled={isEndingCall}
                aria-label="End call"
                className={`group w-16 h-16 mx-auto flex items-center justify-center rounded-full transition-all duration-200 ${
                  isEndingCall
                    ? 'bg-red-800 opacity-50 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl hover:scale-105'
                }`}
              >
                {isEndingCall ? (
                  <div className="w-8 h-8 border-spinner-white rounded-full animate-spin"></div>
                ) : (
                  <PhoneOff className="w-7 h-7 text-white transition-transform duration-200 group-hover:rotate-12" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}