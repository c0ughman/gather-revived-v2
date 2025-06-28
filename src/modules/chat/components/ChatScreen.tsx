import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Settings, Bot, Loader2, Paperclip, X, MessageSquarePlus, Phone } from 'lucide-react';
import { AIContact, Message } from '../../../core/types/types';
import { DocumentInfo } from '../../fileManagement/types/documents';
import DocumentUpload, { DocumentList } from '../../ui/components/DocumentUpload';

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

  // Helper function to get user bubble gradient based on agent color
  const getUserBubbleGradient = (color: string) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Create a subtle gradient using the agent's color
    const lightR = Math.round(r + (255 - r) * 0.2);
    const lightG = Math.round(g + (255 - g) * 0.2);
    const lightB = Math.round(b + (255 - b) * 0.2);
    
    return `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgb(${lightR}, ${lightG}, ${lightB}) 100%)`;
  };

  // Helper function to render AI message with simple markup support
  const renderAIMessage = (content: string) => {
    // Simple markup parsing
    let formattedContent = content
      // Bold text: **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic text: *text* or _text_
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Code: `code`
      .replace(/`(.*?)`/g, '<code class="bg-slate-700 text-[#186799] px-1 py-0.5 rounded text-sm">$1</code>')
      // Line breaks
      .replace(/\n/g, '<br>');

    return (
      <div 
        className="text-white"
        dangerouslySetInnerHTML={{ __html: formattedContent }}
      />
    );
  };

  // Count total documents available to this AI
  const permanentDocuments = contact.documents?.length || 0;
  const totalConversationDocuments = conversationDocuments.length;
  const pendingDocumentsCount = pendingDocuments.length;

  return (
    <div className="h-full bg-glass-bg flex flex-col font-inter">
      {/* Header - Responsive with better mobile handling */}
      <div className="sticky top-0 z-20 bg-glass-bg/95 backdrop-blur-md border-b border-slate-700 p-3 sm:p-4">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button
            onClick={onBack}
            className="flex-shrink-0 p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
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
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold truncate text-sm sm:text-base">{contact.name}</h2>
              <span className="text-xs text-slate-400 font-inter ml-2 flex-shrink-0">{contact.lastSeen}</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 mt-0.5 text-xs">
              {isTyping ? (
                <span className="flex items-center space-x-1 text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="hidden sm:inline">Analyzing and typing...</span>
                  <span className="sm:hidden">Typing...</span>
                </span>
              ) : (
                <div className="flex items-center space-x-1 sm:space-x-2 text-slate-400 overflow-hidden">
                  <span className="truncate">{contact.lastSeen}</span>
                  {permanentDocuments > 0 && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-[#186799] hidden sm:inline">
                        📚 {permanentDocuments} knowledge doc{permanentDocuments > 1 ? 's' : ''}
                      </span>
                      <span className="text-[#186799] sm:hidden">
                        📚 {permanentDocuments}
                      </span>
                    </>
                  )}
                  {totalConversationDocuments > 0 && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-green-400 hidden sm:inline">
                        💬 {totalConversationDocuments} conversation doc{totalConversationDocuments > 1 ? 's' : ''}
                      </span>
                      <span className="text-green-400 sm:hidden">
                        💬 {totalConversationDocuments}
                      </span>
                    </>
                  )}
                  {pendingDocumentsCount > 0 && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-yellow-400 hidden sm:inline">
                        📎 {pendingDocumentsCount} pending
                      </span>
                      <span className="text-yellow-400 sm:hidden">
                        📎 {pendingDocumentsCount}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              onClick={() => onSettingsClick(contact)}
              className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
            
            <button
              onClick={() => onNewChatClick(contact)}
              className="hidden sm:block p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
              title="Start new conversation"
            >
              <MessageSquarePlus className="w-4 h-4 text-slate-400" />
            </button>
            
            <button
              onClick={() => onCallClick(contact)}
              className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
              title="Start call"
            >
              <Phone className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area - Scrollable with padding for fixed input */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="p-3 sm:p-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl mx-auto mb-6 flex items-center justify-center shadow-lg overflow-hidden">
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
              <h3 className="text-white text-xl sm:text-2xl font-semibold mb-3">{contact.name}</h3>
              <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-6">
                {contact.description.length > 120 
                  ? `${contact.description.substring(0, 120)}...` 
                  : contact.description
                }
              </p>
              <div className="space-y-2">
                {permanentDocuments > 0 && (
                  <p className="text-[#186799] text-xs sm:text-sm">
                    📚 This AI has {permanentDocuments} document{permanentDocuments > 1 ? 's' : ''} in its permanent knowledge base
                  </p>
                )}
                {totalConversationDocuments > 0 && (
                  <p className="text-green-400 text-xs sm:text-sm">
                    💬 This conversation has {totalConversationDocuments} shared document{totalConversationDocuments > 1 ? 's' : ''} available
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4 sm:space-y-6">
            {messages.map((message) => (
              <div key={message.id}>
                {message.sender === 'user' ? (
                  // User message - bubble style with agent color gradient
                  <div className="flex justify-end">
                    <div
                      className="max-w-xs sm:max-w-sm lg:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-2xl text-white shadow-lg"
                      style={{ background: getUserBubbleGradient(contact.color) }}
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
                    </div>
                  </div>
                ) : (
                  // AI message - full width with padding, no background
                  <div className="w-full px-2 sm:px-4 py-2">
                    {renderAIMessage(message.content)}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="w-full px-2 sm:px-4 py-2">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-slate-400 text-sm">
                    AI analyzing{totalConversationDocuments > 0 ? ` ${totalConversationDocuments + permanentDocuments} docs` : ''}...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Document Upload Section - Show above input when expanded */}
      {showDocumentUpload && (
        <div className="relative z-10 p-3 sm:p-4 bg-glass-bg border-t border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium text-sm sm:text-base">Upload Conversation Documents</h3>
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
          
          <p className="text-slate-400 text-xs sm:text-sm mb-4">
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

      {/* Input Area - Fixed at bottom with responsive design */}
      <div className="fixed bottom-0 left-0 right-0 z-10 p-3 sm:p-4 bg-glass-bg/95 backdrop-blur-md border-t border-slate-700">
        <div className="relative max-w-4xl mx-auto">
          <div className="relative flex items-center rounded-full border border-slate-600 focus-within:border-[#186799] transition-colors duration-200 shadow-lg bg-glass-bg/90 backdrop-blur-sm">
            {/* File Upload Button - Inside input */}
            <button
              onClick={() => setShowDocumentUpload(!showDocumentUpload)}
              className={`ml-3 sm:ml-4 p-2 rounded-full transition-colors duration-200 ${
                showDocumentUpload || pendingDocuments.length > 0
                  ? 'text-[#186799] hover:text-[#1a5a7a]'
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
              className="flex-1 bg-transparent text-white px-3 sm:px-4 py-3 sm:py-4 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-400 text-sm sm:text-base"
            />
            
            {/* Send Button - Inside input */}
            <button
              onClick={handleSend}
              disabled={(!inputValue.trim() && pendingDocuments.length === 0) || isTyping}
              className="mr-3 sm:mr-4 p-2 bg-[#186799] hover:bg-[#1a5a7a] disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-full transition-colors duration-200 flex items-center justify-center"
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
            <div className="mt-2 flex items-center justify-center space-x-2 sm:space-x-4 text-xs overflow-x-auto">
              {pendingDocuments.length > 0 && (
                <span className="text-yellow-400 whitespace-nowrap">
                  📎 {pendingDocuments.length} new document{pendingDocuments.length > 1 ? 's' : ''} ready to send
                </span>
              )}
              {totalConversationDocuments > 0 && (
                <span className="text-green-400 whitespace-nowrap">
                  💬 {totalConversationDocuments} conversation document{totalConversationDocuments > 1 ? 's' : ''} available
                </span>
              )}
              {permanentDocuments > 0 && (
                <span className="text-[#186799] whitespace-nowrap">
                  📚 {permanentDocuments} permanent knowledge document{permanentDocuments > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}