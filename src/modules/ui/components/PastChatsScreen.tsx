/**
 * Past Chats Screen
 * 
 * Browse through past conversations for a specific agent with search functionality
 * Uses database storage for conversation history
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronRight, MessageSquare, Clock, Star, Phone, MessageCircle, ArrowLeft } from 'lucide-react';
import { conversationHistoryService, ConversationPreview } from '../../../core/services/conversationHistoryService';
import { AIContact } from '../../../core/types/types';

interface PastChatsScreenProps {
  agent: AIContact;
  onBack: () => void;
  onBackToChat: () => void;
  onChatSelect: (sessionId: string) => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export default function PastChatsScreen({ 
  agent, 
  onBack, 
  onBackToChat,
  onChatSelect,
  showSidebar = true,
  onToggleSidebar
}: PastChatsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load conversations for this agent
  useEffect(() => {
    loadConversations();
  }, [agent.id]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessions = await conversationHistoryService.getAgentConversations(agent.id);
      const previews = await conversationHistoryService.createConversationPreviews(sessions);
      setConversations(previews);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      
      // Check if it's a database table missing error
      if (err?.message?.includes('relation "conversation_sessions" does not exist')) {
        setError('Conversation history system not initialized. Database migrations needed.');
      } else {
        setError('Failed to load conversations');
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    return conversations.filter(conv => 
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.preview.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // Handle search with debouncing
  useEffect(() => {
    if (searchQuery) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          if (searchQuery.trim()) {
            // Search in message content
            const sessions = await conversationHistoryService.searchAgentMessages(agent.id, searchQuery);
            const previews = await conversationHistoryService.createConversationPreviews(sessions, searchQuery);
            setConversations(previews);
          } else {
            loadConversations();
          }
        } catch (err) {
          console.error('Error searching conversations:', err);
        }
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsSearching(false);
      loadConversations();
    }
  }, [searchQuery, agent.id]);

  const handleChatClick = (sessionId: string) => {
    onChatSelect(sessionId);
  };

  const getConversationIcon = (type: 'chat' | 'voice' | 'mixed') => {
    switch (type) {
      case 'voice':
        return <Phone className="w-3 h-3" />;
      case 'mixed':
        return <div className="flex space-x-1"><MessageCircle className="w-2 h-2" /><Phone className="w-2 h-2" /></div>;
      default:
        return <MessageCircle className="w-3 h-3" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-glass-bg">
      {/* Header with Search Bar and Back Arrow */}
      <div className="p-4 border-b border-structural">
        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            {/* Back Arrow */}
            <button
              onClick={onBackToChat}
              className="flex items-center justify-center w-12 h-12 bg-slate-700/30 hover:bg-slate-600/50 rounded-full transition-colors duration-200 flex-shrink-0"
              title="Back to Chat"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search past conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-700/30 text-white pl-12 pr-4 py-3 rounded-full focus:outline-none transition-colors duration-200 font-inter"
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-spinner-blue-thin"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-spinner-brand"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <div className="text-red-400 mb-2">Error loading conversations</div>
              <div className="text-sm text-slate-500 mb-4">{error}</div>
              <button 
                onClick={loadConversations}
                className="px-4 py-2 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-2">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
              <p className="text-slate-500 text-sm">
                {searchQuery 
                  ? 'Try adjusting your search terms' 
                  : `Start chatting with ${agent.name} to see conversations here`
                }
              </p>
            </div>
          ) : (
            <>
              {filteredConversations.map((conversation, index) => (
                <React.Fragment key={conversation.id}>
                  <div 
                    className="cursor-pointer hover:bg-slate-700/20 p-4 rounded-lg transition-colors group"
                    onClick={() => handleChatClick(conversation.id)}
                  >
                    <div className="flex items-start space-x-4">
                      {/* Conversation Type Icon */}
                      <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 flex-shrink-0">
                        {getConversationIcon(conversation.conversationType)}
                      </div>

                      {/* Conversation Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title and Timestamp */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-white font-medium truncate">
                              {conversation.title}
                            </h3>
                            {conversation.isStarred && (
                              <Star className="w-4 h-4 text-yellow-400 fill-current flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-slate-400 text-sm flex-shrink-0 ml-4">
                            <Clock className="w-3 h-3" />
                            <span>{conversationHistoryService.formatTimestamp(conversation.lastMessageAt)}</span>
                          </div>
                        </div>

                        {/* Conversation Stats */}
                        <div className="text-sm text-slate-400 mb-2">
                          {conversation.conversationType} • {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
                        </div>

                        {/* Preview Text */}
                        <div className="text-sm text-slate-300 leading-relaxed">
                          {conversation.searchMatch ? (
                            <div 
                              dangerouslySetInnerHTML={{ 
                                __html: conversation.searchMatch.highlighted 
                              }} 
                            />
                          ) : (
                            <div className="line-clamp-2">
                              {conversation.preview}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Arrow Button */}
                      <div className="flex-shrink-0 flex items-center">
                        <div className="p-2 text-slate-400 group-hover:text-white group-hover:bg-slate-700/50 rounded-lg transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Divider Line */}
                  {index < filteredConversations.length - 1 && (
                    <div className="border-t border-structural-light my-0"></div>
                  )}
                </React.Fragment>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}