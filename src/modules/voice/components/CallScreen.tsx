import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff, Settings, Volume2, VolumeX, MoreVertical, FileText } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { CallState } from '../types/voice';
import { geminiLiveService } from '../services/geminiLiveService';
import DocumentDisplay from './DocumentDisplay';

interface CallScreenProps {
  contact: AIContact;
  callState: CallState;
  onBack: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export default function CallScreen({ 
  contact, 
  callState, 
  onBack, 
  onEndCall, 
  onToggleMute,
  showSidebar = true,
  onToggleSidebar
}: CallScreenProps) {
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [responseText, setResponseText] = useState<string>("");
  const [serviceState, setServiceState] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle');
  const [documentContent, setDocumentContent] = useState<string>("");
  const [showDocument, setShowDocument] = useState(false);
  const [documentWordCount, setDocumentWordCount] = useState<number | undefined>(undefined);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [documentHistory, setDocumentHistory] = useState<Array<{
    id: string;
    content: string;
    wordCount?: number;
    timestamp: Date;
  }>>([]);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState<number>(-1);
  const serviceInitialized = useRef(false);
  const initializationInProgress = useRef(false);

  useEffect(() => {
    if (callState.status === 'connecting') {
      setPulseAnimation(true);
      
      // Clear document history for new call
      setDocumentHistory([]);
      setCurrentDocumentIndex(-1);
      setShowDocument(false);
      setDocumentContent("");
      setDocumentWordCount(undefined);
      setIsGeneratingDocument(false);
      
      // Initialize the Gemini Live service when call is connecting
      const initService = async () => {
        if (!serviceInitialized.current && !initializationInProgress.current) {
          initializationInProgress.current = true;
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
              setDocumentWordCount(document.wordCount);
              setShowDocument(true);
            });
            
            // Initialize audio
            const initialized = await geminiLiveService.initialize();
            if (initialized) {
              console.log("✅ Audio initialized, starting session...");
              await geminiLiveService.startSession(contact);
              serviceInitialized.current = true;
              console.log("✅ Service fully initialized");
            } else {
              console.error("❌ Audio initialization failed");
              setResponseText("Could not access microphone. Please check permissions.");
            }
          } catch (error) {
            console.error("❌ Failed to initialize Gemini Live service:", error);
            setResponseText("Failed to start voice chat. Please try again.");
          } finally {
            initializationInProgress.current = false;
          }
        }
      };
      
      initService();
    } else {
      setPulseAnimation(false);
    }
    
    return () => {
      // Enhanced cleanup when component unmounts - prevents memory leaks
      if (serviceInitialized.current) {
        console.log("🧹 CallScreen unmounting - cleaning up voice service");
        
        if (callState.status === 'ended') {
          // If call ended, do complete shutdown to free all resources
          geminiLiveService.shutdown();
        } else {
          // If call still active, just end session properly
          geminiLiveService.endSession();
        }
        
        serviceInitialized.current = false;
        console.log("✅ Voice service cleanup completed");
      }
    };
  }, [contact.id]); // Only depend on contact.id, not callState.status

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callState.status) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'ended':
        return 'Call Ended';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (callState.status) {
      case 'connecting':
        return 'text-yellow-400';
      case 'connected':
        return 'text-green-400';
      case 'ended':
        return 'text-red-400';
      default:
        return 'text-slate-400';
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
        return 'text-[#186799]';
      case 'processing':
        return 'text-yellow-400';
      case 'responding':
        return 'text-green-400';
      default:
        return 'text-slate-400';
    }
  };

  const handleMicToggle = async () => {
    if (callState.status === 'connected') {
      onToggleMute();
    }
  };

  const handleEndCall = () => {
    geminiLiveService.endSession();
    onEndCall();
  };

  const toggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    }
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
    setDocumentWordCount(undefined);
    setIsGeneratingDocument(false);
    setCurrentDocumentIndex(-1);
  };

  const showDocumentAtIndex = (index: number) => {
    if (index >= 0 && index < documentHistory.length) {
      const doc = documentHistory[index];
      setDocumentContent(doc.content);
      setDocumentWordCount(doc.wordCount);
      setCurrentDocumentIndex(index);
      setShowDocument(true);
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
          />
        </div>
      )}

      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-700 bg-glass-panel glass-effect">
        <button
          onClick={onBack}
          className="p-3 rounded-full hover:bg-slate-800 transition-colors duration-200"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="text-center">
          <h2 className="text-white text-xl font-semibold">{contact.name}</h2>
          <p className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
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
        <div className="relative mb-8">
          <div
            className={`w-40 h-40 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 overflow-hidden ${
              pulseAnimation ? 'animate-pulse scale-110' : ''
            } ${
              serviceState === 'listening' ? 'ring-4 ring-[#186799] ring-opacity-75' : ''
            } ${
              serviceState === 'responding' ? 'ring-4 ring-green-400 ring-opacity-75' : ''
            } ${
              serviceState === 'processing' ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''
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
          
          {/* Pulse rings for connecting state */}
          {callState.status === 'connecting' && (
            <>
              <div 
                className="absolute inset-0 rounded-2xl border-4 animate-ping opacity-50"
                style={{ borderColor: contact.color }}
              ></div>
              <div 
                className="absolute inset-0 rounded-2xl border-2 animate-ping opacity-30"
                style={{ borderColor: contact.color, animationDelay: '0.5s' }}
              ></div>
            </>
          )}

          {/* State indicators */}
          {serviceState === 'listening' && (
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#186799] rounded-full flex items-center justify-center animate-pulse">
              <Mic className="w-4 h-4 text-white" />
            </div>
          )}

          {serviceState === 'responding' && (
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
          )}

          {serviceState === 'processing' && (
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center animate-spin">
              <div className="w-3 h-3 bg-white rounded-full"></div>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">{contact.name}</h1>
          <p className="text-slate-300 text-base max-w-md mx-auto leading-relaxed ellipsis-2">
            {contact.description}
          </p>
        </div>

        {/* Status Indicator */}
        <div className="mb-8">
          <div className={`px-6 py-3 rounded-full bg-slate-800 border ${
            callState.status === 'connected' ? 'border-green-500' : 'border-slate-600'
          }`}>
            <span className={`text-lg font-medium ${getServiceStateColor()}`}>
              {getServiceStateText()}
            </span>
          </div>
        </div>
        
        {/* Response Text */}
        {responseText && callState.status === 'connected' && (
          <div className="mb-8 max-w-md bg-slate-800 bg-opacity-70 p-4 rounded-lg border border-slate-700">
            <p className="text-slate-300 text-sm italic">"{responseText}"</p>
          </div>
        )}

        {/* Document Generation Hint */}
        {callState.status === 'connected' && !showDocument && !isGeneratingDocument && (
          <div className="mb-8 max-w-md bg-slate-800 bg-opacity-50 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center space-x-2 text-slate-400 text-sm">
              <FileText className="w-4 h-4" />
              <span>Say "write that down" or "put that on paper" to generate documents</span>
            </div>
          </div>
        )}

        {/* Document Generation Indicator */}
        {isGeneratingDocument && (
          <div className="mb-8 max-w-md bg-blue-900 bg-opacity-50 p-4 rounded-lg border border-blue-700">
            <div className="flex items-center space-x-2 text-blue-300 text-sm">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
              <span>Generating your document...</span>
            </div>
          </div>
        )}

        {/* Document History Indicator */}
        {documentHistory.length > 0 && !showDocument && !isGeneratingDocument && (
          <div className="mb-8 max-w-md bg-slate-800 bg-opacity-50 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-300 text-sm">
                <FileText className="w-4 h-4" />
                <span>{documentHistory.length} document{documentHistory.length > 1 ? 's' : ''} generated</span>
              </div>
              <button
                onClick={() => showDocumentAtIndex(documentHistory.length - 1)}
                className="text-xs text-[#186799] hover:text-[#1a5a7a] px-2 py-1 rounded border border-slate-600 hover:border-slate-500 transition-colors duration-200"
              >
                View Latest
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="pb-8 px-8">
        <div className="flex items-center justify-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={handleMicToggle}
            disabled={callState.status !== 'connected'}
            className={`p-4 rounded-full transition-all duration-200 ${
              callState.isMuted
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-700 hover:bg-slate-600'
            } ${
              callState.status !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
            } shadow-lg hover:shadow-xl hover:scale-105`}
          >
            {callState.isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-6 rounded-full bg-red-600 hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 group"
          >
            <PhoneOff className="w-8 h-8 text-white group-hover:rotate-12 transition-transform duration-200" />
          </button>

          {/* Speaker Button */}
          <button
            disabled={callState.status !== 'connected'}
            className={`p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
              callState.status !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Volume2 className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Control Labels */}
        <div className="flex items-center justify-center space-x-6 mt-4">
          <span className="text-slate-400 text-sm w-16 text-center">
            {callState.isMuted ? 'Unmute' : 'Mute'}
          </span>
          <span className="text-slate-400 text-sm w-20 text-center">End Call</span>
          <span className="text-slate-400 text-sm w-16 text-center">Speaker</span>
        </div>
      </div>
    </div>
  );
}