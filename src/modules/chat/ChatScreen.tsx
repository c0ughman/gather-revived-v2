import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Settings, Bot, Loader2, Paperclip, X, MessageSquarePlus, Phone } from 'lucide-react';
import { AIContact, Message, DocumentInfo } from '../../types';
import DocumentUpload, { DocumentList } from '../../components/DocumentUpload';

interface ChatScreenProps {
  contact: AIContact;
  messages: Message[];
  conversationDocuments: DocumentInfo[]; // All conversation documents accumulated over time
  onBack: () => void;
  onSendMessage: (content: string, documents?: DocumentInfo[]) => void;
  onSettingsClick: (contact: AIContact) => void;
  onNewChatClick: (contact: AIContact) => void;
  onCallClick: (contact: AIContact) => void;
}

export default function ChatScreen({ 
  contact, 
  messages, 
  conversationDocuments,
  onBack, 
  onSendMessage, 
  onSettingsClick, 
  onNewChatClick,
  onCallClick 
}: ChatScreenProps) {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<DocumentInfo[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Check if AI is currently generating a response
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.sender === 'user') {
      setIsTyping(true);
      // Set a timeout to stop typing indicator if no response comes
      const timeout = setTimeout(() => {
        setIsTyping(false);
      }, 10000); // 10 seconds timeout

      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim() || pendingDocuments.length > 0) {
      onSendMessage(inputValue.trim(), pendingDocuments.length > 0 ? pendingDocuments : undefined);
      setInputValue('');
      setPendingDocuments([]);
      setShowDocumentUpload(false);
      setUploadError(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDocumentUploaded = (document: DocumentInfo) => {
    setPendingDocuments(prev => [...prev, document]);
    setUploadError(null);
  };

  const handleDocumentError = (error: string) => {
    setUploadError(error);
  };

  const handleRemoveDocument = (documentId: string) => {
    setPendingDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Helper function to create radial gradient for agents without avatars
  const createAgentGradient = (color: string) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Create complementary color by shifting hue and make it lighter
    const compR = Math.round(255 - r * 0.3); // Softer complement
    const compG = Math.round(255 - g * 0.3);
    const compB = Math.round(255 - b * 0.3);
    
    // Make complementary color lighter than the main color
    const lightCompR = Math.round(compR + (255 - compR) * 0.8);
    const lightCompG = Math.round(compG + (255 - compG) * 0.8);
    const lightCompB = Math.round(compB + (255 - compB) * 0.8);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  // Count total documents available to this AI
  const permanentDocuments = contact.documents?.length || 0;
  const totalConversationDocuments = conversationDocuments.length;
  const pendingDocumentsCount = pendingDocuments.length;

  return (
    <div className="h-full bg-slate-900 flex flex-col font-inter">
      {/* Header - Fixed at top with higher z-index */}
      <div className="relative z-20 bg-slate-800 border-b border-slate-700 p-4 flex items-center space-x-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-700 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
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
            {isTyping ? (
              <span className="flex items-center space-x-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Analyzing and typing...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <span>{contact.lastSeen}</span>
                {permanentDocuments > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-blue-400">
                      📚 {permanentDocuments} knowledge doc{permanentDocuments > 1 ? 's' : ''}
                    </span>
                  </>
                )}
                {totalConversationDocuments > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-green-400">
                      💬 {totalConversationDocuments} conversation doc{totalConversationDocuments > 1 ? 's' : ''}
                    </span>
                  </>
                )}
                {pendingDocumentsCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-400">
                      📎 {pendingDocumentsCount} pending
                    </span>
                  </>
                )}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onSettingsClick(contact)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors duration-200"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-slate-400" />
          </button>
          
          <button
            onClick={() => onNewChatClick(contact)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors duration-200"
            title="Start new conversation"
          >
            <MessageSquarePlus className="w-5 h-5 text-slate-400" />
          </button>
          
          <button
            onClick={() => onCallClick(contact)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors duration-200"
            title="Start call"
          >
            <Phone className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Messages Area - Scrollable with padding for fixed input */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="p-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
                          <div className="w-24 h-24 rounded-xl mx-auto mb-6 flex items-center justify-center shadow-lg overflow-hidden">
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
              <h3 className="text-white text-2xl font-semibold mb-3">{contact.name}</h3>
              <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed mb-6">
                {contact.description.length > 120 
                  ? `${contact.description.substring(0, 120)}...` 
                  : contact.description
                }
              </p>
              <div className="space-y-2">
                {permanentDocuments > 0 && (
                  <p className="text-blue-400 text-sm">
                    📚 This AI has {permanentDocuments} document{permanentDocuments > 1 ? 's' : ''} in its permanent knowledge base
                  </p>
                )}
                {totalConversationDocuments > 0 && (
                  <p className="text-green-400 text-sm">
                    💬 This conversation has {totalConversationDocuments} shared document{totalConversationDocuments > 1 ? 's' : ''} available
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-white'
                  } shadow-lg`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Show attached documents (only newly attached in this message) */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-opacity-20 border-white">
                      <p className="text-xs opacity-75 mb-1">📎 New documents shared:</p>
                      {message.attachments.map((doc) => (
                        <div key={doc.id} className="text-xs opacity-90 bg-black bg-opacity-20 rounded px-2 py-1 mb-1">
                          📄 {doc.name} ({Math.round(doc.size / 1024)}KB)
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className={`text-xs mt-1 ${
                    message.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-700 text-white px-4 py-2 rounded-2xl max-w-xs shadow-lg">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-xs text-slate-400">
                      AI analyzing{totalConversationDocuments > 0 ? ` ${totalConversationDocuments + permanentDocuments} docs` : ''}...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Document Upload Section - Show above input when expanded */}
      {showDocumentUpload && (
        <div className="relative z-10 p-4 bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Upload Conversation Documents</h3>
            <button
              onClick={() => {
                setShowDocumentUpload(false);
                setUploadError(null);
              }}
              className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          
          <p className="text-slate-400 text-sm mb-4">
            These documents will be available throughout this conversation. For permanent knowledge, use Settings.
          </p>
          
          {uploadError && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg">
              <p className="text-red-300 text-sm">{uploadError}</p>
            </div>
          )}
          
          <DocumentUpload
            onDocumentUploaded={handleDocumentUploaded}
            onError={handleDocumentError}
            className="mb-4"
          />
          
          <DocumentList
            documents={pendingDocuments}
            onRemoveDocument={handleRemoveDocument}
          />
        </div>
      )}

      {/* Input Area - Fixed at bottom */}
      <div className="fixed bottom-0 left-1/4 right-1/4 z-10 p-4">
        <div className="relative max-w-4xl mx-auto">
          <div className="relative flex items-center bg-slate-700 rounded-full border border-slate-600 focus-within:border-blue-500 transition-colors duration-200 shadow-lg">
            {/* File Upload Button - Inside input */}
            <button
              onClick={() => setShowDocumentUpload(!showDocumentUpload)}
              className={`ml-4 p-2 rounded-full transition-colors duration-200 ${
                showDocumentUpload || pendingDocuments.length > 0
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              title="Upload conversation documents"
            >
              <Paperclip className="w-4 h-4" />
              {pendingDocuments.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingDocuments.length}
                </span>
              )}
            </button>
            
            {/* Input Field */}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${contact.name}...`}
              disabled={isTyping}
              className="flex-1 bg-transparent text-white px-4 py-4 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-400"
            />
            
            {/* Send Button - Inside input */}
            <button
              onClick={handleSend}
              disabled={(!inputValue.trim() && pendingDocuments.length === 0) || isTyping}
              className="mr-4 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-full transition-colors duration-200 flex items-center justify-center"
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          
          {/* Status indicators below input */}
          {(pendingDocuments.length > 0 || totalConversationDocuments > 0 || permanentDocuments > 0) && (
            <div className="mt-2 flex items-center justify-center space-x-4 text-xs">
              {pendingDocuments.length > 0 && (
                <span className="text-yellow-400">
                  📎 {pendingDocuments.length} new document{pendingDocuments.length > 1 ? 's' : ''} ready to send
                </span>
              )}
              {totalConversationDocuments > 0 && (
                <span className="text-green-400">
                  💬 {totalConversationDocuments} conversation document{totalConversationDocuments > 1 ? 's' : ''} available
                </span>
              )}
              {permanentDocuments > 0 && (
                <span className="text-blue-400">
                  📚 {permanentDocuments} permanent knowledge document{permanentDocuments > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Show existing conversation documents */}
      {totalConversationDocuments > 0 && !showDocumentUpload && (
        <div className="fixed bottom-20 left-1/4 right-1/4 z-10 p-4">
          <div className="bg-slate-800 bg-opacity-90 backdrop-blur-sm rounded-lg border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white text-sm font-medium">Conversation Documents ({totalConversationDocuments})</h4>
              <button
                onClick={() => setShowDocumentUpload(true)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Add more
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {conversationDocuments.slice(0, 5).map((doc) => (
                <div key={doc.id} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                  📄 {doc.name}
                </div>
              ))}
              {totalConversationDocuments > 5 && (
                <div className="text-xs text-slate-400 px-2 py-1">
                  +{totalConversationDocuments - 5} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}