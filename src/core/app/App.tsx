import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AIContact, Message } from '../types/types';
import { contactsData } from '../data/contacts';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { documentContextService } from '../../modules/fileManagement/services/documentContextService';

// Components
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import Dashboard from '../../modules/ui/components/Dashboard';
import ContactSidebar from '../../modules/ui/components/ContactSidebar';
import SettingsSidebar from '../../modules/ui/components/SettingsSidebar';
import SettingsScreen from '../../modules/ui/components/SettingsScreen';
import ChatScreen from '../../modules/chat/components/ChatScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';

type AppView = 'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings';

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useLocalStorage<AIContact[]>('ai-contacts', contactsData);
  const [messages, setMessages] = useLocalStorage<Message[]>('chat-messages', []);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (!loading && user) {
      if (currentView === 'landing' || currentView === 'signup' || currentView === 'signin') {
        setCurrentView('dashboard');
      }
    }
  }, [user, loading, currentView]);

  // Navigation handlers
  const handleGetStarted = () => setCurrentView('signup');
  const handleSignUp = () => setCurrentView('signup');
  const handleSignIn = () => setCurrentView('signin');
  const handleBackToLanding = () => setCurrentView('landing');
  const handleSelectPlan = () => setCurrentView('dashboard');
  const handleStayFree = () => setCurrentView('dashboard');
  const handleHomeClick = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
    setShowRightSidebar(false);
  };

  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('chat');
    setShowRightSidebar(true);
    
    // Load conversation documents for this contact
    const contactMessages = messages.filter(m => m.contactId === contact.id);
    const allDocuments: DocumentInfo[] = [];
    contactMessages.forEach(message => {
      if (message.attachments) {
        allDocuments.push(...message.attachments);
      }
    });
    setConversationDocuments(allDocuments);
  };

  const handleCallClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('call');
    setShowRightSidebar(true);
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
      setCurrentView('settings');
      setShowRightSidebar(true);
    } else {
      setCurrentView('settings');
      setSelectedContact(null);
      setShowRightSidebar(false);
    }
  };

  const handleNewChatClick = (contact: AIContact) => {
    // Clear messages for this contact to start fresh
    const otherMessages = messages.filter(m => m.contactId !== contact.id);
    setMessages(otherMessages);
    setConversationDocuments([]);
    handleChatClick(contact);
  };

  const handleCreateAgent = () => {
    const newContact: AIContact = {
      id: Date.now().toString(),
      name: 'New AI Assistant',
      description: 'A helpful AI assistant ready to be customized.',
      initials: 'NA',
      color: '#3b82f6',
      status: 'online',
      lastSeen: 'now',
      total_messages: 0,
      total_conversations: 0,
      voice: 'Puck'
    };
    
    setContacts(prev => [...prev, newContact]);
    setSelectedContact(newContact);
    setCurrentView('settings');
    setShowRightSidebar(true);
  };

  const handleSendMessage = (content: string, attachments?: DocumentInfo[]) => {
    if (!selectedContact) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: selectedContact.id,
      attachments
    };

    setMessages(prev => [...prev, userMessage]);

    // Add attachments to conversation documents
    if (attachments && attachments.length > 0) {
      setConversationDocuments(prev => {
        const newDocs = attachments.filter(att => 
          !prev.some(doc => doc.id === att.id)
        );
        return [...prev, ...newDocs];
      });
    }

    // Simulate AI response
    setTimeout(() => {
      // Prepare context for AI
      const contactDocuments = selectedContact.documents || [];
      const allAvailableDocuments = [...contactDocuments, ...conversationDocuments];
      const context = documentContextService.prepareContext(allAvailableDocuments, content);
      
      let aiResponse = `I understand you're asking about "${content}". `;
      
      if (context.relevantDocuments.length > 0) {
        aiResponse += `Based on the ${context.relevantDocuments.length} relevant document(s) I have access to, `;
      }
      
      if (selectedContact.integrations && selectedContact.integrations.length > 0) {
        const activeIntegrations = selectedContact.integrations.filter(i => i.status === 'active');
        if (activeIntegrations.length > 0) {
          aiResponse += `I can also pull data from ${activeIntegrations.length} connected integration(s). `;
        }
      }
      
      aiResponse += "How can I help you further with this?";

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, aiMessage]);

      // Update contact stats
      setContacts(prev => prev.map(contact => 
        contact.id === selectedContact.id 
          ? { 
              ...contact, 
              total_messages: (contact.total_messages || 0) + 2,
              last_used_at: new Date().toISOString()
            }
          : contact
      ));
    }, 1000 + Math.random() * 2000);
  };

  const handleSaveContact = (updatedContact: AIContact) => {
    setContacts(prev => prev.map(contact => 
      contact.id === updatedContact.id ? updatedContact : contact
    ));
    setSelectedContact(updatedContact);
  };

  const handleToggleRightSidebar = () => {
    setShowRightSidebar(prev => !prev);
  };

  const handleCloseRightSidebar = () => {
    setShowRightSidebar(false);
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screens for non-authenticated users
  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/pricing" element={
            <PricingPage 
              onSelectPlan={handleSelectPlan}
              onStayFree={handleStayFree}
            />
          } />
          <Route path="*" element={
            <>
              {currentView === 'landing' && (
                <LandingPage 
                  onGetStarted={handleGetStarted}
                  onSignUp={handleSignUp}
                />
              )}
              {currentView === 'signup' && (
                <SignupPage 
                  onSuccess={() => setCurrentView('dashboard')}
                  onBackToLanding={handleBackToLanding}
                  onSignIn={handleSignIn}
                />
              )}
              {currentView === 'signin' && (
                <AuthScreen 
                  onSuccess={() => setCurrentView('dashboard')}
                  onBackToLanding={handleBackToLanding}
                  onSignUp={handleSignUp}
                />
              )}
            </>
          } />
        </Routes>
      </Router>
    );
  }

  // Calculate layout classes based on sidebar visibility
  const getMainContentClasses = () => {
    if (showLeftSidebar && showRightSidebar) {
      return "left-1/4 right-1/4"; // Both sidebars visible
    } else if (showLeftSidebar && !showRightSidebar) {
      return "left-1/4 right-0"; // Only left sidebar
    } else if (!showLeftSidebar && showRightSidebar) {
      return "left-0 right-1/4"; // Only right sidebar
    } else {
      return "left-0 right-0"; // No sidebars
    }
  };

  const getContentContainerClasses = () => {
    if (showLeftSidebar && showRightSidebar) {
      return "w-1/2 mx-auto"; // Centered between both sidebars
    } else if (showLeftSidebar && !showRightSidebar) {
      return "w-3/4 ml-1/4"; // Offset from left sidebar
    } else if (!showLeftSidebar && showRightSidebar) {
      return "w-3/4 mr-1/4"; // Offset from right sidebar
    } else {
      return "w-full"; // Full width when no sidebars
    }
  };

  // Main authenticated app layout
  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="*" element={
          <div className="h-screen bg-glass-bg flex overflow-hidden">
            {/* Left Sidebar - Contact List */}
            {showLeftSidebar && (
              <div className="fixed left-0 top-0 bottom-0 w-1/4 z-30">
                <ContactSidebar
                  contacts={contacts}
                  onChatClick={handleChatClick}
                  onCallClick={handleCallClick}
                  onSettingsClick={handleSettingsClick}
                  onHomeClick={handleHomeClick}
                  onCreateAgent={handleCreateAgent}
                />
              </div>
            )}

            {/* Main Content Area */}
            <div className={`fixed top-0 bottom-0 z-10 ${getMainContentClasses()}`}>
              <div className="h-full">
                {currentView === 'dashboard' && (
                  <div className={getContentContainerClasses()}>
                    <Dashboard
                      contacts={contacts}
                      onChatClick={handleChatClick}
                      onCallClick={handleCallClick}
                      onSettingsClick={handleSettingsClick}
                      onNewChatClick={handleNewChatClick}
                      onCreateAgent={handleCreateAgent}
                    />
                  </div>
                )}

                {currentView === 'chat' && selectedContact && (
                  <ChatScreen
                    contact={selectedContact}
                    messages={messages.filter(m => m.contactId === selectedContact.id)}
                    conversationDocuments={conversationDocuments}
                    onBack={handleHomeClick}
                    onSendMessage={handleSendMessage}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCallClick={handleCallClick}
                    showSidebar={showRightSidebar}
                    onToggleSidebar={handleToggleRightSidebar}
                  />
                )}

                {currentView === 'call' && selectedContact && (
                  <CallScreen
                    contact={selectedContact}
                    onBack={handleHomeClick}
                    onEndCall={handleHomeClick}
                    showSidebar={showRightSidebar}
                    onToggleSidebar={handleToggleRightSidebar}
                  />
                )}

                {currentView === 'settings' && (
                  <SettingsScreen
                    contact={selectedContact!}
                    onBack={handleHomeClick}
                    onSave={handleSaveContact}
                  />
                )}
              </div>
            </div>

            {/* Right Sidebar - Settings */}
            {showRightSidebar && (
              <div className="fixed right-0 top-0 bottom-0 w-1/4 z-30">
                <SettingsSidebar
                  contact={selectedContact}
                  onSave={handleSaveContact}
                  onClose={handleCloseRightSidebar}
                />
              </div>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}