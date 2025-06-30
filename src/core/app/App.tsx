import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import { AIContact, Message } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { contactsData } from '../data/contacts';
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
  const [contacts, setContacts] = useState<AIContact[]>(contactsData);
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user && currentView === 'landing') {
      setCurrentView('dashboard');
    }
  }, [user, loading, currentView]);

  const handleGetStarted = () => {
    if (user) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('signup');
    }
  };

  const handleSignUp = () => {
    setCurrentView('signup');
  };

  const handleSignIn = () => {
    setCurrentView('signin');
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
  };

  const handleSignupSuccess = () => {
    setCurrentView('dashboard');
  };

  const handleSigninSuccess = () => {
    setCurrentView('dashboard');
  };

  const handleSelectPlan = (plan: string) => {
    console.log('Selected plan:', plan);
    setCurrentView('dashboard');
  };

  const handleStayFree = () => {
    setCurrentView('dashboard');
  };

  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('chat');
    // Clear conversation documents when starting a new chat
    setConversationDocuments([]);
    // Load existing messages for this contact (in a real app, this would come from a database)
    setMessages([]);
  };

  const handleCallClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('call');
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
      setCurrentView('settings');
    } else {
      // Global settings
      setSelectedContact(null);
      setCurrentView('settings');
    }
  };

  const handleNewChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('chat');
    // Clear messages and conversation documents for new chat
    setMessages([]);
    setConversationDocuments([]);
  };

  const handleBack = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleSendMessage = async (content: string, documents?: DocumentInfo[]) => {
    if (!selectedContact) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: selectedContact.id,
      attachments: documents
    };

    setMessages(prev => [...prev, userMessage]);

    // Add documents to conversation context if provided
    if (documents && documents.length > 0) {
      setConversationDocuments(prev => [...prev, ...documents]);
    }

    // Simulate AI response with document context
    setTimeout(async () => {
      try {
        // Get all available documents for context
        const allDocuments = [
          ...(selectedContact.documents || []),
          ...conversationDocuments,
          ...(documents || [])
        ];

        // Generate context-aware response
        const contextualResponse = await documentContextService.generateContextualResponse(
          content,
          allDocuments,
          selectedContact
        );

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: contextualResponse,
          sender: 'ai',
          timestamp: new Date(),
          contactId: selectedContact.id
        };

        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error('Error generating AI response:', error);
        
        // Fallback response
        const fallbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `I understand you're asking about "${content}". I'm here to help! ${documents && documents.length > 0 ? `I can see you've shared ${documents.length} document(s) with me.` : ''}`,
          sender: 'ai',
          timestamp: new Date(),
          contactId: selectedContact.id
        };

        setMessages(prev => [...prev, fallbackMessage]);
      }
    }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
  };

  const handleSaveContact = (updatedContact: AIContact) => {
    setContacts(prev => prev.map(contact => 
      contact.id === updatedContact.id ? updatedContact : contact
    ));
    setSelectedContact(updatedContact);
  };

  const handleCreateAgent = () => {
    // For now, just show the settings screen to create a new agent
    const newAgent: AIContact = {
      id: Date.now().toString(),
      name: 'New Agent',
      description: 'A helpful AI assistant',
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

  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const handleCloseSidebar = () => {
    setShowSidebar(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-glass-bg flex items-center justify-center">
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
          <div className="h-screen flex overflow-hidden bg-glass-bg">
            {/* Render based on current view */}
            {currentView === 'landing' && (
              <LandingPage 
                onGetStarted={handleGetStarted}
                onSignUp={handleSignUp}
              />
            )}

            {currentView === 'signup' && (
              <SignupPage 
                onSuccess={handleSignupSuccess}
                onBackToLanding={handleBackToLanding}
                onSignIn={handleSignIn}
              />
            )}

            {currentView === 'signin' && (
              <AuthScreen 
                mode="signin"
                onSuccess={handleSigninSuccess}
                onBackToLanding={handleBackToLanding}
                onSwitchToSignup={handleSignUp}
              />
            )}

            {currentView === 'pricing' && (
              <PricingPage 
                onSelectPlan={handleSelectPlan}
                onStayFree={handleStayFree}
              />
            )}

            {user && currentView === 'dashboard' && (
              <>
                {/* Left Sidebar - Contacts */}
                <div className="w-1/4 border-r border-slate-700">
                  <ContactSidebar
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onHomeClick={() => setCurrentView('dashboard')}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>

                {/* Main Content */}
                <div className="flex-1">
                  <Dashboard
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>
              </>
            )}

            {user && currentView === 'chat' && selectedContact && (
              <>
                {/* Left Sidebar - Contacts */}
                <div className="w-1/4 border-r border-slate-700">
                  <ContactSidebar
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onHomeClick={() => setCurrentView('dashboard')}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>

                {/* Main Content - Chat */}
                <div className="flex-1 relative">
                  <ChatScreen
                    contact={selectedContact}
                    messages={messages}
                    conversationDocuments={conversationDocuments}
                    onBack={handleBack}
                    onSendMessage={handleSendMessage}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCallClick={handleCallClick}
                    showSidebar={showSidebar}
                    onToggleSidebar={handleToggleSidebar}
                    onCloseSidebar={handleCloseSidebar}
                  />
                </div>

                {/* Right Sidebar - Settings */}
                {showSidebar && (
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

            {user && currentView === 'call' && selectedContact && (
              <>
                {/* Left Sidebar - Contacts */}
                <div className="w-1/4 border-r border-slate-700">
                  <ContactSidebar
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onHomeClick={() => setCurrentView('dashboard')}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>

                {/* Main Content - Call */}
                <div className="flex-1 relative">
                  <CallScreen
                    contact={selectedContact}
                    onBack={handleBack}
                    onSettingsClick={handleSettingsClick}
                    showSidebar={showSidebar}
                    onToggleSidebar={handleToggleSidebar}
                    onCloseSidebar={handleCloseSidebar}
                  />
                </div>

                {/* Right Sidebar - Settings (only show if sidebar is enabled) */}
                {showSidebar && (
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

            {user && currentView === 'settings' && (
              <>
                {/* Left Sidebar - Contacts */}
                <div className="w-1/4 border-r border-slate-700">
                  <ContactSidebar
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onHomeClick={() => setCurrentView('dashboard')}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>

                {/* Main Content - Settings */}
                <div className="flex-1">
                  {selectedContact ? (
                    <SettingsScreen
                      contact={selectedContact}
                      onBack={handleBack}
                      onSave={handleSaveContact}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <h2 className="text-2xl font-bold text-white mb-4">Global Settings</h2>
                        <p className="text-slate-400">Configure your account and preferences</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {!user && !['landing', 'signup', 'signin', 'pricing'].includes(currentView) && (
              <Navigate to="/" replace />
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}