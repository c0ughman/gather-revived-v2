import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, MoreVertical, FileText, ChevronDown, ChevronUp, X } from 'lucide-react';
import { AIContact, CallState } from '../../../core/types/types';
import { DocumentInfo } from '../../fileManagement/types/documents';
import DocumentDisplay from './DocumentDisplay';
import { createAgentGradient } from '../../../core/utils/uiHelpers';

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
  const [showDocuments, setShowDocuments] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentInfo | null>(null);
  const [isDocumentExpanded, setIsDocumentExpanded] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const callDurationRef = useRef<HTMLDivElement>(null);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status text and color
  const getStatusInfo = () => {
    switch (callState.status) {
      case 'connecting':
        return { text: 'Connecting...', color: 'text-yellow-400' };
      case 'connected':
        return { text: 'Connected', color: 'text-green-400' };
      case 'ended':
        return { text: 'Call Ended', color: 'text-red-400' };
      default:
        return { text: 'Unknown', color: 'text-slate-400' };
    }
  };

  const statusInfo = getStatusInfo();

  // Handle document selection from voice commands or AI suggestions
  const handleDocumentSuggestion = (document: DocumentInfo) => {
    setSelectedDocument(document);
    setShowDocuments(true);
    setIsDocumentExpanded(true);
  };

  // Get all available documents (permanent + conversation)
  const allDocuments = contact.documents || [];

  // Calculate main content width based on sidebar visibility
  const mainContentClass = showSidebar ? "left-1/4 right-1/4" : "left-1/4 right-0";

  return (
    <div className="h-full bg-glass-bg flex flex-col font-inter">
      {/* Header - Fixed at top */}
      <div 
        className={`fixed top-0 ${mainContentClass} z-20 border-b border-slate-700 p-4 flex items-center justify-between`}
        style={{
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          backgroundColor: 'rgba(2, 10, 22, 0.08)'
        }}
      >
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden">
              {contact.avatar ? (
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div 
                  className="w-full h-full rounded-xl"
                  style={{ background: createAgentGradient(contact.color) }}
                />
              )}
            </div>
            
            <div>
              <h2 className="text-white font-semibold">{contact.name}</h2>
              <div className="flex items-center space-x-2">
                <span className={`text-sm ${statusInfo.color}`}>
                  {statusInfo.text}
                </span>
                {callState.status === 'connected' && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400 text-sm">
                      {formatDuration(callState.duration)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Documents Button */}
          {allDocuments.length > 0 && (
            <button
              onClick={() => setShowDocuments(!showDocuments)}
              className={`p-2 rounded-full transition-colors duration-200 ${
                showDocuments 
                  ? 'bg-[#186799] text-white' 
                  : 'hover:bg-slate-700 text-slate-400'
              }`}
              title="Show documents"
            >
              <FileText className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Main Call Interface */}
      <div className={`flex-1 pt-20 pb-32 ${showSidebar ? 'w-1/2 mx-auto' : 'w-3/4 ml-1/4'}`}>
        <div className="h-full flex flex-col items-center justify-center p-8">
          {/* Large Avatar */}
          <div className="w-48 h-48 rounded-3xl flex items-center justify-center overflow-hidden mb-8 shadow-2xl">
            {contact.avatar ? (
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-full h-full object-cover rounded-3xl"
              />
            ) : (
              <div 
                className="w-full h-full rounded-3xl"
                style={{ background: createAgentGradient(contact.color) }}
              />
            )}
          </div>

          {/* Contact Info */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">{contact.name}</h1>
            <p className="text-slate-400 text-lg mb-4">{contact.description}</p>
            
            <div className="flex items-center justify-center space-x-4">
              <span className={`text-lg ${statusInfo.color} font-medium`}>
                {statusInfo.text}
              </span>
              {callState.status === 'connected' && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-white text-lg font-mono" ref={callDurationRef}>
                    {formatDuration(callState.duration)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Call Status Indicator */}
          {callState.status === 'connecting' && (
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-4 h-4 bg-yellow-400 rounded-full animate-pulse"></div>
              <span className="text-yellow-400">Establishing connection...</span>
            </div>
          )}

          {callState.status === 'connected' && (
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400">Voice call active</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Display Area */}
      {showDocuments && selectedDocument && (
        <div className={`fixed bottom-32 z-10 ${mainContentClass} transition-all duration-300`}>
          <div 
            className={`bg-glass-panel glass-effect rounded-t-xl border border-slate-700 border-b-0 shadow-2xl transition-all duration-300 ${
              isDocumentExpanded ? 'h-96' : 'h-16'
            }`}
          >
            {/* Document Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-[#186799]" />
                <div>
                  <h3 className="text-white font-medium">{selectedDocument.name}</h3>
                  <p className="text-slate-400 text-sm">
                    {Math.round(selectedDocument.size / 1024)}KB • {selectedDocument.type}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsDocumentExpanded(!isDocumentExpanded)}
                  className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
                  title={isDocumentExpanded ? "Minimize" : "Expand"}
                >
                  {isDocumentExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setSelectedDocument(null);
                    setShowDocuments(false);
                    setIsDocumentExpanded(false);
                  }}
                  className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
                  title="Close document"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Document Content */}
            {isDocumentExpanded && (
              <div className="h-80 overflow-y-auto">
                <DocumentDisplay document={selectedDocument} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents Sidebar */}
      {showDocuments && !selectedDocument && allDocuments.length > 0 && (
        <div className={`fixed bottom-32 right-4 z-10 w-80 transition-all duration-300`}>
          <div className="bg-glass-panel glass-effect rounded-xl border border-slate-700 shadow-2xl max-h-96 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Available Documents</h3>
                <button
                  onClick={() => setShowDocuments(false)}
                  className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <p className="text-slate-400 text-sm mt-1">
                {allDocuments.length} document{allDocuments.length !== 1 ? 's' : ''} available
              </p>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {allDocuments.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleDocumentSuggestion(doc)}
                  className="w-full p-3 text-left hover:bg-slate-700 transition-colors duration-200 border-b border-slate-700 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-[#186799] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-slate-400 text-xs">
                        {Math.round(doc.size / 1024)}KB • {doc.type}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Call Controls - Fixed at bottom */}
      <div className={`fixed bottom-0 z-10 p-6 ${mainContentClass}`}>
        <div className="flex items-center justify-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={onToggleMute}
            className={`p-4 rounded-full transition-all duration-200 ${
              callState.isMuted 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
            title={callState.isMuted ? "Unmute" : "Mute"}
          >
            {callState.isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            className="p-6 bg-red-600 hover:bg-red-700 rounded-full transition-all duration-200 transform hover:scale-105"
            title="End call"
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </button>

          {/* Speaker Button */}
          <button
            onClick={() => setSpeakerEnabled(!speakerEnabled)}
            className={`p-4 rounded-full transition-all duration-200 ${
              speakerEnabled 
                ? 'bg-[#186799] hover:bg-[#1a5a7a]' 
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
            title={speakerEnabled ? "Disable speaker" : "Enable speaker"}
          >
            {speakerEnabled ? (
              <Volume2 className="w-6 h-6 text-white" />
            ) : (
              <VolumeX className="w-6 h-6 text-white" />
            )}
          </button>
        </div>

        {/* Call Status Text */}
        <div className="text-center mt-4">
          <p className="text-slate-400 text-sm">
            {callState.status === 'connecting' && 'Connecting to AI assistant...'}
            {callState.status === 'connected' && 'Voice call in progress'}
            {callState.status === 'ended' && 'Call has ended'}
          </p>
        </div>
      </div>
    </div>
  );
}