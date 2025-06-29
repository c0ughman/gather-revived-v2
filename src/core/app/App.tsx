import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import { Dashboard, ContactSidebar, SettingsSidebar, SettingsScreen } from '../../modules/ui';
import { ChatScreen } from '../../modules/chat';
import { AIContact, Message, CallState } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { documentContextService } from '../../modules/fileManagement/services/documentContextService';
import { geminiService } from '../../modules/fileManagement/services/geminiService';
import { supabaseService } from '../../modules/database/services/supabaseService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { SubscriptionBadge, ManageSubscriptionButton } from '../../modules/payments';

type ViewType = 'landing' | 'signup' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent' | 'success' | 'login';

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [messages, setMessages] = useLocalStorage<Message[]>('gather-messages', []);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    duration: 0,
    isMuted: false,
    status: 'ended'
  });

  // Load user data when authenticated
  useEffect(() => {
    if (user && !dataLoading) {
      loadUserData();
    }
  }, [user]);

  useEffect(() => {
    if (user && (currentView === 'landing' || currentView === 'signup' || currentView === 'login')) {
      setCurrentView('pricing');
    }
  }, [user, currentView]);

  const loadUserData = async () => {
    if (!user || dataLoading) return;

    try {
      setDataLoading(true);
      console.log('🔄 Loading user data for:', user.email);

      // Test database connection
      const connectionOk = await supabaseService.testConnection();
      if (!connectionOk) {
        console.error('❌ Database connection failed');
        // Continue with empty data for now
        setContacts([]);
        return;
      }

      console.log('✅ Database connection successful');

      // Load user agents from Supabase
      const userAgents = await supabaseService.getUserAgents(user.id);
      console.log('📊 Loaded agents:', userAgents.length);

      // Transform Supabase data to AIContact format
      const transformedContacts: AIContact[] = userAgents.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        initials: agent.initials,
        color: agent.color,
        voice: agent.voice,
        avatar: agent.avatar_url,
        status: agent.status as 'online' | 'busy' | 'offline',
        lastSeen: formatLastSeen(agent.last_seen, agent.last_used_at),
        integrations: agent.agent_integrations?.map((integration: any) => ({
          id: integration.id,
          integrationId: integration.template_id,
          name: integration.name,
          config: integration.config,
          status: integration.status
        })),
        documents: agent.agent_documents?.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.file_type,
          size: doc.file_size,
          uploadedAt: new Date(doc.uploaded_at),
          content: doc.content || '',
          summary: doc.summary,
          extractedText: doc.extracted_text,
          metadata: doc.metadata || {}
        }))
      }));

      setContacts(transformedContacts);
      console.log('✅ User data loaded successfully');

    } catch (error) {
      console.error('❌ Error loading user data:', error);
      // Set empty contacts on error
      setContacts([]);
    } finally {
      setDataLoading(false);
    }
  };

  const formatLastSeen = (lastSeen: string, lastUsedAt: string | null): string => {
    if (lastSeen === 'now') return 'now';
    
    if (lastUsedAt) {
      const lastUsed = new Date(lastUsedAt);
      const now = new Date();
      const diffMs = now.getTime() - lastUsed.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return lastUsed.toLocaleDateString();
    }

    return lastSeen;
  };

  const handleGetStarted = () => {
    setCurrentView('signup');
  };

  const handleSignUp = () => {
    setCurrentView('signup');
  };

  const handleSignIn = () => {
    setCurrentView('login');
  };

  const handleSignupSuccess = () => {
    setCurrentView('pricing');
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
  };

  const handleSelectPlan = (plan: string) => {
    // Here you would implement the logic to set the user's plan
    console.log(`Selected plan: ${plan}`);
    // For now, just redirect to dashboard
    setCurrentView('dashboard');
  };

  const handleStayFree = () => {
    // User chooses to stay with the free plan
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
    setCallState({
      isActive: true,
      duration: 0,
      isMuted: false,
      status: 'connecting'
    });

    // Simulate call connection
    setTimeout(() => {
      setCallState(prev => ({ ...prev, status: 'connected' }));
    }, 2000);
  };

  const handleEndCall = () => {
    setCallState({
      isActive: false,
      duration: 0,
      isMuted: false,
      status: 'ended'
    });
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleToggleMute = () => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
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
      // Get conversation history for this contact
      const contactMessages = messages.filter(m => m.contactId === selectedContact.id);
      const chatHistory = [...contactMessages, userMessage];

      // Generate AI response using the enhanced service
      const response = await geminiService.generateResponse(
        selectedContact,
        content,
        chatHistory,
        conversationDocuments
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, aiMessage]);

      // Update contact's last used timestamp in Supabase
      if (user) {
        try {
          await supabaseService.updateUserAgent(selectedContact.id, {
            last_used_at: new Date().toISOString(),
            last_seen: 'now'
          });

          // Update local state
          setContacts(prev => prev.map(contact => 
            contact.id === selectedContact.id 
              ? { ...contact, lastSeen: 'now' }
              : contact
          ));
        } catch (error) {
          console.warn('Failed to update agent last used time:', error);
        }
      }

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

  const handleSaveContact = async (contact: AIContact) => {
    try {
      if (!user) {
        console.error('No user found for saving contact');
        return;
      }

      console.log('💾 Saving contact:', contact.name);

      // Check if this is a new contact or existing one
      const existingContact = contacts.find(c => c.id === contact.id);
      
      if (existingContact) {
        // Update existing contact in Supabase
        await supabaseService.updateUserAgent(contact.id, {
          name: contact.name,
          description: contact.description,
          initials: contact.initials,
          color: contact.color,
          voice: contact.voice,
          avatar_url: contact.avatar,
          status: contact.status
        });

        console.log('✅ Updated existing contact in Supabase');
      } else {
        // Create new contact in Supabase
        const newAgent = await supabaseService.createUserAgent(user.id, contact);
        contact.id = newAgent.id; // Update with the database ID
        
        console.log('✅ Created new contact in Supabase with ID:', newAgent.id);
      }

      // Update local state
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
      console.log('✅ Contact saved successfully');

    } catch (error) {
      console.error('❌ Error saving contact:', error);
      alert('Failed to save contact. Please try again.');
    }
  };

  const handleCreateNewAgent = () => {
    const newAgent: AIContact = {
      id: `temp_${Date.now()}`, // Temporary ID, will be replaced when saved
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

  // Loading state
  if (loading || dataLoading) {
    return (
      <div className="h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">
            {loading ? 'Loading...' : 'Loading your AI agents...'}
          </p>
          {dataLoading && (
            <p className="text-slate-400 text-sm mt-2">
              Connecting to database...
            </p>
          )}
        </div>
      </div>
    );
  }

  // If not authenticated, show landing page or signup page based on currentView
  if (!user) {
    if (currentView === 'signup') {
      return <SignupPage onSuccess={handleSignupSuccess} onBackToLanding={handleBackToLanding} />;
    } else if (currentView === 'login') {
      return <AuthScreen />;
    } else {
      return <LandingPage onGetStarted={handleGetStarted} onSignUp={handleSignUp} />;
    }
  }

  // Show pricing page after signup
  if (currentView === 'pricing') {
    return <PricingPage onSelectPlan={handleSelectPlan} onStayFree={handleStayFree} />;
  }

  // If authenticated, show the main app
  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
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
                    callState={callState}
                    onBack={handleBack}
                    onEndCall={handleEndCall}
                    onToggleMute={handleToggleMute}
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
                      id: `temp_${Date.now()}`,
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