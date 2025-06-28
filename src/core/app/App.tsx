import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';
import LandingPage from '../../components/LandingPage';
import { Dashboard, ContactSidebar, SettingsSidebar, SettingsScreen } from '../../modules/ui';
import { ChatScreen } from '../../modules/chat';
import { AIContact, Message } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { documentContextService } from '../../modules/fileManagement/services/documentContextService';
import { geminiService } from '../../modules/fileManagement/services/geminiService';
import { supabaseService } from '../../modules/database/services/supabaseService';
import { useLocalStorage } from '../hooks/useLocalStorage';

type ViewType = 'landing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent';

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useLocalStorage<AIContact[]>('gather-contacts', []);
  const [messages, setMessages] = useLocalStorage<Message[]>('gather-messages', []);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);

  // Show landing page if not authenticated
  const showLandingPage = !loading && !user;

  useEffect(() => {
    if (user && currentView === 'landing') {
      setCurrentView('dashboard');
    }
  }, [user, currentView]);

  const handleGetStarted = () => {
    setCurrentView('dashboard');
  };

  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('chat');
    
    // Load conversation documents for this contact
    const contactMessages = messages.filter(m => m.contactId === contact.id);
    const allAttachments = contactMessages.flatMap(m => m.attachments || []);
    setConversationDocuments(allAttachments);
  };

  const handleCallClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('call');
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
      setCurrentView('settings');
    }
  };

  const handleNewChatClick = (contact: AIContact) => {
    // Clear messages for this contact to start fresh
    const otherMessages = messages.filter(m => m.contactId !== contact.id);
    setMessages(otherMessages);
    setConversationDocuments([]);
    handleChatClick(contact);
  };

  const handleBack = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleHomeClick = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleCreateAgent = () => {
    setCurrentView('create-agent');
  };

  const handleSendMessage = async (content: string, documents?: DocumentInfo[]) => {
    if (!selectedContact) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: selectedContact.id,
      attachments: documents
    };

    setMessages(prev => [...prev, userMessage]);

    // Add new documents to conversation documents
    if (documents && documents.length > 0) {
      setConversationDocuments(prev => [...prev, ...documents]);
    }

    try {
      // Prepare context for AI
      const allDocuments = [
        ...(selectedContact.documents || []),
        ...conversationDocuments,
        ...(documents || [])
      ];

      const context = await documentContextService.prepareContext(allDocuments);
      const conversationHistory = messages
        .filter(m => m.contactId === selectedContact.id)
        .concat(userMessage)
        .slice(-10)
        .map(m => `${m.sender}: ${m.content}`)
        .join('\n');

      const prompt = `You are ${selectedContact.name}, an AI assistant with the following description: ${selectedContact.description}

${context ? `Here is relevant context from documents:\n${context}\n` : ''}

Conversation history:
${conversationHistory}

Please respond as ${selectedContact.name} in a helpful and engaging way. Keep your response concise but informative.`;

      const response = await geminiService.generateResponse(prompt);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, aiMessage]);

      // Update contact's last used timestamp
      setContacts(prev => prev.map(contact => 
        contact.id === selectedContact.id 
          ? { ...contact, lastSeen: 'now', lastUsedAt: new Date() }
          : contact
      ));

    } catch (error) {
      console.error('Error generating AI response:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSaveContact = (contact: AIContact) => {
    setContacts(prev => {
      const existingIndex = prev.findIndex(c => c.id === contact.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = contact;
        return updated;
      } else {
        return [...prev, contact];
      }
    });
    setSelectedContact(contact);
  };

  const handleCreateNewAgent = () => {
    const newAgent: AIContact = {
      id: Date.now().toString(),
      name: 'New AI Assistant',
      description: 'A helpful AI assistant ready to be customized.',
      initials: 'AI',
      color: '#3b82f6',
      status: 'online',
      lastSeen: 'now',
      voice: 'Puck'
    };
    
    setSelectedContact(newAgent);
    setCurrentView('settings');
  };

  // Show landing page for non-authenticated users
  if (showLandingPage) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  if (loading) {
    return (
      <div className="h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="*" element={<AuthScreen />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="*" element={
          <div className="h-screen flex bg-glass-bg">
            {/* Left Sidebar - Contacts */}
            <div className="w-80 border-r border-slate-700">
              <ContactSidebar
                contacts={contacts}
                onChatClick={handleChatClick}
                onCallClick={handleCallClick}
                onSettingsClick={handleSettingsClick}
                onHomeClick={handleHomeClick}
                onCreateAgent={handleCreateAgent}
              />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex">
              <div className="flex-1">
                {currentView === 'dashboard' && (
                  <Dashboard
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCreateAgent={handleCreateAgent}
                  />
                )}
                
                {currentView === 'chat' && selectedContact && (
                  <ChatScreen
                    contact={selectedContact}
                    messages={messages.filter(m => m.contactId === selectedContact.id)}
                    conversationDocuments={conversationDocuments}
                    onBack={handleBack}
                    onSendMessage={handleSendMessage}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCallClick={handleCallClick}
                  />
                )}
                
                {currentView === 'call' && selectedContact && (
                  <CallScreen
                    contact={selectedContact}
                    onBack={handleBack}
                    onEndCall={handleBack}
                  />
                )}
                
                {currentView === 'settings' && selectedContact && (
                  <SettingsScreen
                    contact={selectedContact}
                    onBack={handleBack}
                    onSave={handleSaveContact}
                  />
                )}
                
                {currentView === 'create-agent' && (
                  <SettingsScreen
                    contact={{
                      id: Date.now().toString(),
                      name: 'New AI Assistant',
                      description: 'A helpful AI assistant ready to be customized.',
                      initials: 'AI',
                      color: '#3b82f6',
                      status: 'online',
                      lastSeen: 'now',
                      voice: 'Puck'
                    }}
                    onBack={handleBack}
                    onSave={(contact) => {
                      handleSaveContact(contact);
                      setCurrentView('dashboard');
                    }}
                  />
                )}
              </div>

              {/* Right Sidebar - Settings (when in chat view) */}
              {currentView === 'chat' && (
                <div className="w-80 border-l border-slate-700">
                  <SettingsSidebar
                    contact={selectedContact}
                    onSave={handleSaveContact}
                  />
                </div>
              )}
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}