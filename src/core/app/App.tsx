import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AIContact, Message } from '../types/types';
import { contacts as initialContacts } from '../data/contacts';
import { DocumentInfo } from '../modules/fileManagement/types/documents';

// Components
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import AuthScreen from '../modules/auth/components/AuthScreen';
import Dashboard from '../modules/ui/components/Dashboard';
import ContactSidebar from '../modules/ui/components/ContactSidebar';
import SettingsSidebar from '../modules/ui/components/SettingsSidebar';
import ChatScreen from '../modules/chat/components/ChatScreen';
import CallScreen from '../modules/voice/components/CallScreen';
import OAuthCallback from '../modules/oauth/components/OAuthCallback';

export default function App() {
  const { user, loading } = useAuth();
  const [contacts, setContacts] = useLocalStorage<AIContact[]>('ai-contacts', initialContacts);
  const [messages, setMessages] = useLocalStorage<Message[]>('chat-messages', []);
  const [conversationDocuments, setConversationDocuments] = useLocalStorage<DocumentInfo[]>('conversation-documents', []);
  
  // UI State
  const [currentView, setCurrentView] = useState<'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings'>('landing');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    if (!loading) {
      if (user) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('landing');
      }
    }
  }, [user, loading]);

  // Message handlers
  const handleSendMessage = (content: string, documents?: DocumentInfo[]) => {
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

    // Add documents to conversation documents if provided
    if (documents && documents.length > 0) {
      setConversationDocuments(prev => {
        const existingIds = new Set(prev.map(doc => doc.id));
        const newDocuments = documents.filter(doc => !existingIds.has(doc.id));
        return [...prev, ...newDocuments];
      });
    }

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I understand you said: "${content}". How can I help you further?`,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  // Contact handlers
  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('chat');
    setShowSettingsSidebar(false);
  };

  const handleCallClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('call');
    setShowSettingsSidebar(false);
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
      setCurrentView('settings');
    } else {
      setShowSettingsSidebar(!showSettingsSidebar);
    }
  };

  const handleNewChatClick = (contact: AIContact) => {
    // Clear messages for this contact
    setMessages(prev => prev.filter(msg => msg.contactId !== contact.id));
    // Clear conversation documents
    setConversationDocuments([]);
    handleChatClick(contact);
  };

  const handleCreateAgent = () => {
    const newAgent: AIContact = {
      id: Date.now().toString(),
      name: 'New AI Assistant',
      description: 'A helpful AI assistant ready to chat',
      initials: 'NA',
      color: '#3b82f6',
      status: 'online',
      lastSeen: 'now',
      total_messages: 0,
      total_conversations: 0
    };
    
    setContacts(prev => [...prev, newAgent]);
    setSelectedContact(newAgent);
    setCurrentView('settings');
  };

  const handleSaveContact = (updatedContact: AIContact) => {
    setContacts(prev => prev.map(contact => 
      contact.id === updatedContact.id ? updatedContact : contact
    ));
    setSelectedContact(updatedContact);
    setCurrentView('dashboard');
  };

  const handleBack = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
    setShowSettingsSidebar(false);
  };

  const handleHomeClick = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
    setShowSettingsSidebar(false);
  };

  const handleToggleSidebar = () => {
    setShowSettingsSidebar(!showSettingsSidebar);
  };

  const handleCloseSidebar = () => {
    setShowSettingsSidebar(false);
  };

  // Get messages for selected contact
  const contactMessages = selectedContact 
    ? messages.filter(msg => msg.contactId === selectedContact.id)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/*" element={
          <div className="h-screen bg-slate-900 flex overflow-hidden">
            {!user ? (
              // Unauthenticated views
              <>
                {currentView === 'landing' && (
                  <LandingPage 
                    onGetStarted={() => setCurrentView('signup')}
                    onSignUp={() => setCurrentView('signup')}
                  />
                )}
                {currentView === 'signup' && (
                  <SignupPage 
                    onSuccess={() => setCurrentView('dashboard')}
                    onBackToLanding={() => setCurrentView('landing')}
                    onSignIn={() => setCurrentView('signin')}
                  />
                )}
                {currentView === 'signin' && (
                  <AuthScreen 
                    onSuccess={() => setCurrentView('dashboard')}
                    onBackToLanding={() => setCurrentView('landing')}
                    onSignUp={() => setCurrentView('signup')}
                  />
                )}
                {currentView === 'pricing' && (
                  <PricingPage 
                    onSelectPlan={() => setCurrentView('dashboard')}
                    onStayFree={() => setCurrentView('dashboard')}
                  />
                )}
              </>
            ) : (
              // Authenticated views
              <>
                {/* Left Sidebar - Contact List */}
                <div className="w-1/4 border-r border-slate-700">
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
                <div className={`flex-1 ${showSettingsSidebar ? 'w-1/2' : 'w-3/4'}`}>
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
                      messages={contactMessages}
                      conversationDocuments={conversationDocuments}
                      onBack={handleBack}
                      onSendMessage={handleSendMessage}
                      onSettingsClick={handleSettingsClick}
                      onNewChatClick={handleNewChatClick}
                      onCallClick={handleCallClick}
                      showSidebar={showSettingsSidebar}
                      onToggleSidebar={handleToggleSidebar}
                      onCloseSidebar={handleCloseSidebar}
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
                    <div className="h-full">
                      <div className="h-full">
                        {/* Settings content would go here */}
                        <div className="p-8">
                          <h1 className="text-2xl font-bold text-white mb-4">Settings for {selectedContact.name}</h1>
                          <button
                            onClick={handleBack}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Back to Dashboard
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Sidebar - Settings (when shown) */}
                {showSettingsSidebar && (
                  <div className="w-1/4 border-l border-slate-700">
                    <SettingsSidebar
                      contact={selectedContact}
                      onSave={handleSaveContact}
                      onClose={handleCloseSidebar}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}