import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Settings, FileText, Loader2 } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { geminiLiveService } from '../services/geminiLiveService';
import DocumentDisplay from './DocumentDisplay';
import { DocumentInfo } from '../../fileManagement/types/documents';

interface CallScreenProps {
  contact: AIContact;
  onBack: () => void;
  onSettingsClick: (contact: AIContact) => void;
}

export default function CallScreen({ contact, onBack, onSettingsClick }: CallScreenProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<DocumentInfo | null>(null);
  
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (isConnected) {
        handleEndCall();
      }
    };
  }, [isConnected]);

  const startDurationTimer = () => {
    callStartTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
  };

  const handleStartCall = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      console.log('🎙️ Starting call with:', contact.name);
      
      // Initialize Gemini Live service
      await geminiLiveService.initialize({
        model: 'gemini-2.0-flash-exp',
        voice: contact.voice || 'Puck',
        systemInstruction: `You are ${contact.name}. ${contact.description}`,
        documents: contact.documents || []
      });

      // Set up event listeners
      geminiLiveService.onAudioStart(() => {
        console.log('🎵 AI started speaking');
        setIsAISpeaking(true);
      });

      geminiLiveService.onAudioEnd(() => {
        console.log('🔇 AI stopped speaking');
        setIsAISpeaking(false);
      });

      geminiLiveService.onUserSpeechStart(() => {
        console.log('🎤 User started speaking');
        setIsUserSpeaking(true);
      });

      geminiLiveService.onUserSpeechEnd(() => {
        console.log('🔇 User stopped speaking');
        setIsUserSpeaking(false);
      });

      geminiLiveService.onDocumentReference((document) => {
        console.log('📄 AI referenced document:', document.name);
        setCurrentDocument(document);
        setShowDocuments(true);
      });

      geminiLiveService.onError((error) => {
        console.error('❌ Gemini Live error:', error);
        setConnectionError(error.message);
        setIsConnected(false);
        setIsConnecting(false);
        stopDurationTimer();
      });

      // Start the session
      await geminiLiveService.startSession();
      
      setIsConnected(true);
      setIsConnecting(false);
      startDurationTimer();
      
      console.log('✅ Call connected successfully');
    } catch (error) {
      console.error('❌ Failed to start call:', error);
      setConnectionError(error instanceof Error ? error.message : 'Failed to start call');
      setIsConnecting(false);
    }
  };

  const handleEndCall = async () => {
    console.log('📞 Ending call');
    
    try {
      await geminiLiveService.endSession();
    } catch (error) {
      console.error('Error ending call:', error);
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setIsAISpeaking(false);
    setIsUserSpeaking(false);
    setConnectionError(null);
    stopDurationTimer();
    setCallDuration(0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    geminiLiveService.setMuted(!isMuted);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Note: Speaker control would be handled by the browser's audio context
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  return (
    <div className="h-full bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#186799]/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-600/20 to-[#186799]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="text-center">
          <h1 className="text-xl font-semibold">{contact.name}</h1>
          <p className="text-slate-400 text-sm">
            {isConnecting ? 'Connecting...' : 
             isConnected ? `Connected • ${formatDuration(callDuration)}` : 
             'Ready to call'}
          </p>
        </div>

        <button
          onClick={() => onSettingsClick(contact)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Main Call Interface */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        {/* Contact Avatar */}
        <div className="relative mb-8">
          <div className={`w-48 h-48 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
            isAISpeaking ? 'ring-4 ring-[#186799] ring-opacity-50 scale-105' : ''
          }`}>
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
          
          {/* Speaking Indicator */}
          {isAISpeaking && (
            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-[#186799] rounded-full flex items-center justify-center animate-pulse">
              <Volume2 className="w-6 h-6 text-white" />
            </div>
          )}
        </div>

        {/* Status Text */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">{contact.name}</h2>
          <p className="text-slate-400 mb-4">{contact.description}</p>
          
          {connectionError && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4 max-w-md">
              <p className="text-red-300 text-sm">{connectionError}</p>
            </div>
          )}
          
          {isConnected && (
            <div className="flex items-center justify-center space-x-4 text-sm text-slate-400">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isUserSpeaking ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}></div>
                <span>You</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isAISpeaking ? 'bg-[#186799] animate-pulse' : 'bg-slate-600'}`}></div>
                <span>AI</span>
              </div>
            </div>
          )}
        </div>

        {/* Call Controls */}
        <div className="flex items-center space-x-6">
          {/* Mute Button */}
          {isConnected && (
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-all duration-200 ${
                isMuted 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
          )}

          {/* Main Call Button */}
          <button
            onClick={isConnected ? handleEndCall : handleStartCall}
            disabled={isConnecting}
            className={`p-6 rounded-full transition-all duration-200 transform hover:scale-105 ${
              isConnected 
                ? 'bg-red-600 hover:bg-red-700' 
                : isConnecting
                ? 'bg-slate-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isConnecting ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isConnected ? (
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
                  ? 'bg-white/10 hover:bg-white/20' 
                  : 'bg-slate-600 hover:bg-slate-700'
              }`}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
          )}
        </div>

        {/* Documents Button */}
        {contact.documents && contact.documents.length > 0 && (
          <button
            onClick={() => setShowDocuments(!showDocuments)}
            className="mt-8 flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors duration-200"
          >
            <FileText className="w-4 h-4" />
            <span className="text-sm">Documents ({contact.documents.length})</span>
          </button>
        )}
      </div>

      {/* Document Display */}
      {showDocuments && (
        <DocumentDisplay
          documents={contact.documents || []}
          currentDocument={currentDocument}
          onClose={() => setShowDocuments(false)}
        />
      )}
    </div>
  );
}