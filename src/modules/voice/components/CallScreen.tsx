import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Settings, MoreVertical, X } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { geminiLiveService } from '../services/geminiLiveService';
import DocumentDisplay from './DocumentDisplay';

interface CallScreenProps {
  contact: AIContact;
  onBack: () => void;
  onSettingsClick: (contact: AIContact) => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  onCloseSidebar?: () => void;
}

export default function CallScreen({ 
  contact, 
  onBack, 
  onSettingsClick,
  showSidebar = true,
  onToggleSidebar,
  onCloseSidebar
}: CallScreenProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to create radial gradient for agents without avatars
  const createAgentGradient = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const compR = Math.round(255 - r * 0.3);
    const compG = Math.round(255 - g * 0.3);
    const compB = Math.round(255 - b * 0.3);
    
    const lightCompR = Math.round(compR + (255 - compR) * 0.8);
    const lightCompG = Math.round(compG + (255 - compG) * 0.8);
    const lightCompB = Math.round(compB + (255 - compB) * 0.8);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    try {
      setConnectionStatus('connecting');
      setError(null);
      
      await geminiLiveService.connect({
        voice: contact.voice || 'Puck',
        systemInstruction: `You are ${contact.name}. ${contact.description}`,
        onTranscript: setTranscript,
        onResponse: setAiResponse,
        onListening: setIsListening,
        onError: (err) => {
          setError(err);
          setConnectionStatus('error');
        }
      });
      
      setIsConnected(true);
      setConnectionStatus('connected');
      callStartTimeRef.current = Date.now();
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setConnectionStatus('error');
    }
  };

  const endCall = async () => {
    try {
      await geminiLiveService.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setTranscript('');
      setAiResponse('');
      setCallDuration(0);
      callStartTimeRef.current = null;
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end call');
    }
  };

  const toggleMute = async () => {
    try {
      if (isMuted) {
        await geminiLiveService.unmute();
      } else {
        await geminiLiveService.mute();
      }
      setIsMuted(!isMuted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle mute');
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const toggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        geminiLiveService.disconnect();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isConnected]);

  // Calculate main content positioning based on sidebar visibility
  const mainContentClass = showSidebar ? "left-1/4 right-1/4" : "left-1/4 right-0";

  return (
    <div className="h-full bg-glass-bg flex flex-col font-inter">
      {/* Header - Fixed at top with responsive width */}
      <div 
        className={`fixed top-0 ${mainContentClass} z-20 border-b border-slate-700 p-3 flex items-center space-x-3`}
        style={{
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          backgroundColor: 'rgba(2, 10, 22, 0.08)'
        }}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        
        <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
          {contact.avatar ? (
            <img
              src={contact.avatar}
              alt={contact.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div 
              className="w-full h-full rounded-lg"
              style={{ background: createAgentGradient(contact.color) }}
            />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold truncate">{contact.name}</h2>
          <p className="text-slate-400 text-sm truncate mt-0.5">
            {isConnected ? (
              <span className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span>Connected • {formatDuration(callDuration)}</span>
              </span>
            ) : connectionStatus === 'connecting' ? (
              'Connecting...'
            ) : (
              'Voice call'
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onSettingsClick(contact)}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={toggleSidebar}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            <MoreVertical className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Main Call Interface - Responsive width based on sidebar */}
      <div className={`flex-1 pt-20 ${showSidebar ? 'pr-1/4' : ''}`}>
        <div className={`h-full flex flex-col items-center justify-center px-8 ${showSidebar ? 'max-w-4xl mx-auto' : 'max-w-6xl mx-auto'}`}>
          {/* Contact Avatar */}
          <div className="mb-8">
            <div className={`${isConnected ? 'w-48 h-48' : 'w-32 h-32'} rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${isListening ? 'ring-4 ring-green-400 ring-opacity-50' : ''}`}>
              {contact.avatar ? (
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div 
                  className="w-full h-full rounded-full"
                  style={{ background: createAgentGradient(contact.color) }}
                />
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">{contact.name}</h1>
            <p className="text-slate-400 text-lg max-w-md">
              {isConnected ? (
                <span className="flex items-center justify-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span>Connected • {formatDuration(callDuration)}</span>
                </span>
              ) : connectionStatus === 'connecting' ? (
                'Connecting to voice call...'
              ) : connectionStatus === 'error' ? (
                <span className="text-red-400">Connection failed</span>
              ) : (
                'Ready to start voice call'
              )}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg max-w-md">
              <p className="text-red-300 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Transcript and Response Display */}
          {isConnected && (transcript || aiResponse) && (
            <div className="mb-8 w-full max-w-2xl">
              {transcript && (
                <div className="mb-4 p-4 bg-slate-800 bg-opacity-50 rounded-lg border border-slate-700">
                  <h3 className="text-white font-medium mb-2">You said:</h3>
                  <p className="text-slate-300">{transcript}</p>
                </div>
              )}
              {aiResponse && (
                <div className="p-4 bg-[#186799] bg-opacity-20 rounded-lg border border-[#186799] border-opacity-50">
                  <h3 className="text-white font-medium mb-2">{contact.name} responded:</h3>
                  <p className="text-slate-300">{aiResponse}</p>
                </div>
              )}
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center space-x-6">
            {/* Mute Button */}
            {isConnected && (
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all duration-200 ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
            )}

            {/* Main Call Button */}
            <button
              onClick={isConnected ? endCall : startCall}
              disabled={connectionStatus === 'connecting'}
              className={`p-6 rounded-full transition-all duration-200 transform hover:scale-105 ${
                isConnected 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : connectionStatus === 'connecting'
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
              title={isConnected ? 'End Call' : connectionStatus === 'connecting' ? 'Connecting...' : 'Start Call'}
            >
              {isConnected ? (
                <PhoneOff className="w-8 h-8" />
              ) : (
                <Phone className="w-8 h-8" />
              )}
            </button>

            {/* Speaker Button */}
            {isConnected && (
              <button
                onClick={toggleSpeaker}
                className={`p-4 rounded-full transition-all duration-200 ${
                  isSpeakerOn 
                    ? 'bg-[#186799] hover:bg-[#1a5a7a] text-white' 
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title={isSpeakerOn ? 'Turn off speaker' : 'Turn on speaker'}
              >
                {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              </button>
            )}
          </div>

          {/* Voice Instructions */}
          {!isConnected && connectionStatus !== 'connecting' && (
            <div className="mt-8 text-center max-w-md">
              <p className="text-slate-400 text-sm">
                Click the call button to start a voice conversation with {contact.name}. 
                Make sure your microphone is enabled.
              </p>
            </div>
          )}

          {/* Listening Indicator */}
          {isConnected && isListening && (
            <div className="mt-6 flex items-center space-x-2 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm">Listening...</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Display - Show when sidebar is visible */}
      {showSidebar && contact.documents && contact.documents.length > 0 && (
        <div className="fixed right-0 top-0 bottom-0 w-1/4 bg-glass-panel glass-effect border-l border-slate-700">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Documents</h3>
              {onCloseSidebar && (
                <button
                  onClick={onCloseSidebar}
                  className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
                  title="Close sidebar"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              <DocumentDisplay documents={contact.documents} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}