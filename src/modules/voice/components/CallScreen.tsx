import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, ArrowLeft, MoreVertical, X } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { geminiLiveService } from '../services/geminiLiveService';
import DocumentDisplay from './DocumentDisplay';

interface CallScreenProps {
  contact: AIContact;
  onBack: () => void;
  onEndCall: () => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export default function CallScreen({ 
  contact, 
  onBack, 
  onEndCall,
  showSidebar = true,
  onToggleSidebar
}: CallScreenProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{
    speaker: 'user' | 'ai';
    text: string;
    timestamp: Date;
  }>>([]);

  const callStartTimeRef = useRef<Date | null>(null);
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

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start call
  const handleStartCall = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      await geminiLiveService.startCall({
        voice: contact.voice || 'Puck',
        systemInstructions: `You are ${contact.name}, ${contact.description}. Speak naturally and conversationally.`,
        onTranscriptUpdate: (transcript) => {
          setCurrentTranscript(transcript);
        },
        onAISpeaking: (speaking) => {
          setIsAISpeaking(speaking);
        },
        onConversationUpdate: (history) => {
          setConversationHistory(history);
        }
      });

      setIsConnected(true);
      setIsConnecting(false);
      callStartTimeRef.current = new Date();
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - callStartTimeRef.current.getTime()) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to start call:', err);
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setIsConnecting(false);
    }
  };

  // End call
  const handleEndCall = async () => {
    try {
      await geminiLiveService.endCall();
    } catch (err) {
      console.error('Error ending call:', err);
    }

    setIsConnected(false);
    setIsConnecting(false);
    setCallDuration(0);
    callStartTimeRef.current = null;
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    onEndCall();
  };

  // Toggle mute
  const handleToggleMute = async () => {
    try {
      if (isMuted) {
        await geminiLiveService.unmute();
      } else {
        await geminiLiveService.mute();
      }
      setIsMuted(!isMuted);
    } catch (err) {
      console.error('Error toggling mute:', err);
    }
  };

  // Toggle speaker
  const handleToggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Note: Actual speaker control would depend on browser APIs
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (isConnected) {
        geminiLiveService.endCall().catch(console.error);
      }
    };
  }, [isConnected]);

  // Calculate main content width based on sidebar visibility
  const mainContentClass = showSidebar ? "left-1/4 right-1/4" : "left-1/4 right-0";

  return (
    <div className="h-full bg-glass-bg flex flex-col font-inter">
      {/* Header - Fixed at top */}
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
          <p className="text-slate-400 text-sm truncate">
            {isConnected ? `Call duration: ${formatDuration(callDuration)}` : 
             isConnecting ? 'Connecting...' : 'Ready to call'}
          </p>
        </div>
        
        <div className="flex items-center space-x-1">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
              title={showSidebar ? "Hide sidebar" : "Show sidebar"}
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Main Call Interface */}
      <div className={`flex-1 pt-20 ${showSidebar ? 'w-1/2 mx-auto' : 'w-3/4 ml-1/4'}`}>
        <div className="h-full flex flex-col items-center justify-center p-8">
          {/* Contact Avatar - Large */}
          <div className="relative mb-8">
            <div className={`w-48 h-48 rounded-full flex items-center justify-center overflow-hidden ${
              isConnected && isAISpeaking ? 'ring-4 ring-green-400 ring-opacity-50 animate-pulse' : ''
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
            
            {/* Status indicator */}
            <div className={`absolute bottom-4 right-4 w-8 h-8 rounded-full border-4 border-glass-bg ${
              isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-slate-500'
            }`}></div>
          </div>

          {/* Contact Info */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">{contact.name}</h1>
            <p className="text-slate-400 text-lg mb-4">{contact.description}</p>
            
            {/* Call Status */}
            <div className="text-center">
              {isConnecting && (
                <p className="text-yellow-400 text-lg">Connecting...</p>
              )}
              {isConnected && (
                <div>
                  <p className="text-green-400 text-lg mb-2">Connected</p>
                  <p className="text-slate-300 text-xl font-mono">{formatDuration(callDuration)}</p>
                </div>
              )}
              {!isConnected && !isConnecting && (
                <p className="text-slate-400 text-lg">Ready to start call</p>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg">
              <p className="text-red-300 text-center">{error}</p>
            </div>
          )}

          {/* Current Transcript */}
          {isConnected && currentTranscript && (
            <div className="mb-6 p-4 bg-slate-800 bg-opacity-50 rounded-lg max-w-md">
              <p className="text-slate-300 text-center italic">"{currentTranscript}"</p>
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center space-x-6">
            {/* Mute Button */}
            {isConnected && (
              <button
                onClick={handleToggleMute}
                className={`p-4 rounded-full transition-colors duration-200 ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>
            )}

            {/* Main Call Button */}
            {!isConnected ? (
              <button
                onClick={handleStartCall}
                disabled={isConnecting}
                className="p-6 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-full transition-colors duration-200"
              >
                <Phone className="w-8 h-8 text-white" />
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                className="p-6 bg-red-600 hover:bg-red-700 rounded-full transition-colors duration-200"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
            )}

            {/* Speaker Button */}
            {isConnected && (
              <button
                onClick={handleToggleSpeaker}
                className={`p-4 rounded-full transition-colors duration-200 ${
                  isSpeakerOn 
                    ? 'bg-slate-700 hover:bg-slate-600' 
                    : 'bg-slate-600 hover:bg-slate-500'
                }`}
              >
                {isSpeakerOn ? (
                  <Volume2 className="w-6 h-6 text-white" />
                ) : (
                  <VolumeX className="w-6 h-6 text-white" />
                )}
              </button>
            )}
          </div>

          {/* Voice Info */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Voice: {contact.voice || 'Puck'}
            </p>
          </div>
        </div>
      </div>

      {/* Conversation History - Fixed at bottom */}
      {isConnected && conversationHistory.length > 0 && (
        <div className={`fixed bottom-0 ${mainContentClass} z-10 p-4`}>
          <div 
            className="max-h-32 overflow-y-auto rounded-lg border border-slate-700 p-4"
            style={{
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(2, 10, 22, 0.8)',
            }}
          >
            <h4 className="text-white text-sm font-medium mb-2">Conversation</h4>
            <div className="space-y-2">
              {conversationHistory.slice(-3).map((entry, index) => (
                <div key={index} className="text-xs">
                  <span className={`font-medium ${
                    entry.speaker === 'user' ? 'text-blue-300' : 'text-green-300'
                  }`}>
                    {entry.speaker === 'user' ? 'You' : contact.name}:
                  </span>
                  <span className="text-slate-300 ml-2">{entry.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document Display for AI Context */}
      {contact.documents && contact.documents.length > 0 && (
        <DocumentDisplay 
          documents={contact.documents}
          className="fixed bottom-4 left-4 max-w-xs"
        />
      )}
    </div>
  );
}