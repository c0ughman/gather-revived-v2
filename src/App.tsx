import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import AuthScreen from './components/AuthScreen';
import ContactSidebar from './components/ContactSidebar';
import SettingsSidebar from './components/SettingsSidebar';
import Dashboard from './components/Dashboard';
import ChatScreen from './modules/chat/ChatScreen';
import CallScreen from './modules/calls/CallScreen';
import SettingsScreen from './components/SettingsScreen';

import { AIContact, Message, Screen, CallState, DocumentInfo } from './types';
import { supabaseService } from './services/supabaseService';
import { geminiService } from './services/geminiService';
import { integrationsService } from './services/integrationsService';
import { getIntegrationById } from './data/integrations';
import { geminiLiveService } from './modules/calls/services/geminiLiveService';

function App() {
  const { user, loading: authLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<Record<string, DocumentInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    duration: 0,
    isMuted: false,
    status: 'ended'
  });

  // Load user data when authenticated
  useEffect(() => {
    if (user) {
      console.log('User authenticated, loading data for:', user.email);
      loadUserData();
    } else {
      console.log('No user, clearing data');
      setContacts([]);
      setMessages([]);
      setConversationDocuments({});
      setLoading(false);
    }
  }, [user]);

  // Update call duration - MOVED TO TOP LEVEL
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.isActive && callState.status === 'connected') {
      interval = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState.isActive, callState.status]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Loading user data for:', user.id);
      
      // Ensure user profile exists (this should already be handled by useAuth)
      let profile = await supabaseService.getUserProfile(user.id);
      if (!profile) {
        console.log('Creating user profile...');
        profile = await supabaseService.createUserProfile(user.id, user.email?.split('@')[0]);
      }

      console.log('User profile loaded:', profile);

      // Load user agents
      const agents = await supabaseService.getUserAgents(user.id);
      console.log('Loaded agents:', agents);
      
      // Transform database agents to AIContact format
      const transformedContacts: AIContact[] = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        initials: agent.initials,
        color: agent.color,
        description: agent.description,
        status: agent.status as 'online' | 'busy' | 'offline',
        lastSeen: agent.last_seen || 'now',
        voice: agent.voice,
        avatar: agent.avatar_url,
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
          metadata: doc.metadata
        }))
      }));

      setContacts(transformedContacts);
      console.log('Contacts set:', transformedContacts);
      
      // Initialize integrations for loaded contacts
      transformedContacts.forEach(contact => {
        if (contact.integrations) {
          contact.integrations.forEach(integrationInstance => {
            const integration = getIntegrationById(integrationInstance.integrationId);
            if (integration && integrationInstance.config.enabled && integration.category !== 'action') {
              integrationsService.startPeriodicExecution(
                contact.id, 
                integration, 
                integrationInstance.config, 
                (contactId, data) => {
                  console.log(`📈 Integration data updated for contact ${contactId} (${integration.name}):`, data.summary || 'Data received');
                }
              );
            }
          });
        }
      });

    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = async (contact: AIContact) => {
    console.log(`💬 Starting chat with ${contact.name}`);
    setSelectedContact(contact);
    setCurrentScreen('chat');

    // Execute integrations on chat start if configured
    if (contact.integrations) {
      for (const integrationInstance of contact.integrations) {
        const integration = getIntegrationById(integrationInstance.integrationId);
        if (integration && 
            integration.category !== 'action' &&
            integrationInstance.config.enabled && 
            (integrationInstance.config.trigger === 'chat-start' || integrationInstance.config.trigger === 'both')) {
          console.log(`🔄 Executing integration ${integration.name} on chat start...`);
          try {
            const data = await integrationsService.executeIntegration(integration, integrationInstance.config);
            integrationsService.storeIntegrationData(contact.id, integration.id, data);
            console.log(`✅ Chat-start execution successful for ${integration.name}:`, data.summary || 'Data received');
          } catch (error) {
            console.error(`❌ Failed to execute integration ${integration.name}:`, error.message);
          }
        }
      }
    }
  };

  const handleNewChatClick = async (contact: AIContact) => {
    console.log(`🆕 Starting new chat with ${contact.name}`);
    
    // Clear messages for this contact to start fresh
    setMessages(prev => prev.filter(msg => msg.contactId !== contact.id));
    
    // Clear conversation documents for this contact
    setConversationDocuments(prev => {
      const updated = { ...prev };
      delete updated[contact.id];
      return updated;
    });
    
    // Start new chat
    setSelectedContact(contact);
    setCurrentScreen('chat');

    // Execute integrations on chat start if configured
    if (contact.integrations) {
      for (const integrationInstance of contact.integrations) {
        const integration = getIntegrationById(integrationInstance.integrationId);
        if (integration && 
            integration.category !== 'action' &&
            integrationInstance.config.enabled && 
            (integrationInstance.config.trigger === 'chat-start' || integrationInstance.config.trigger === 'both')) {
          console.log(`🔄 Executing integration ${integration.name} on new chat start...`);
          try {
            const data = await integrationsService.executeIntegration(integration, integrationInstance.config);
            integrationsService.storeIntegrationData(contact.id, integration.id, data);
            console.log(`✅ New chat execution successful for ${integration.name}:`, data.summary || 'Data received');
          } catch (error) {
            console.error(`❌ Failed to execute integration ${integration.name}:`, error.message);
          }
        }
      }
    }
  };

  const handleCallClick = (contact: AIContact) => {
    if (callState.isActive && callState.status !== 'ended') {
      console.log(`🔄 Ending current call to start new call with ${contact.name}`);
      handleEndCall();
      
      setTimeout(() => {
        startNewCall(contact);
      }, 200);
    } else {
      startNewCall(contact);
    }
  };

  const startNewCall = (contact: AIContact) => {
    console.log(`📞 Starting fresh call with ${contact.name}`);
    setSelectedContact(contact);
    setCallState({
      isActive: true,
      duration: 0,
      isMuted: false,
      status: 'connecting'
    });
    setCurrentScreen('call');
    
    geminiLiveService.initialize().then(initialized => {
      if (initialized) {
        geminiLiveService.startSession(contact).then(() => {
          setTimeout(() => {
            setCallState(prev => ({ ...prev, status: 'connected' }));
          }, 2000);
        });
      } else {
        setTimeout(() => {
          setCallState(prev => ({ ...prev, status: 'ended' }));
          handleEndCall();
        }, 2000);
      }
    });
  };

  const handleSendMessage = async (content: string, attachedDocuments?: DocumentInfo[]) => {
    if (!selectedContact || !user) return;

    console.log(`📤 Sending message to ${selectedContact.name}: "${content}"`);
    if (attachedDocuments?.length) {
      console.log(`📎 With ${attachedDocuments.length} attached documents`);
    }

    const existingConversationDocs = conversationDocuments[selectedContact.id] || [];
    
    if (attachedDocuments && attachedDocuments.length > 0) {
      const updatedConversationDocs = [...existingConversationDocs];
      
      attachedDocuments.forEach(newDoc => {
        if (!updatedConversationDocs.find(doc => doc.id === newDoc.id)) {
          updatedConversationDocs.push(newDoc);
        }
      });
      
      setConversationDocuments(prev => ({
        ...prev,
        [selectedContact.id]: updatedConversationDocs
      }));
      
      console.log(`📎 Added ${attachedDocuments.length} new documents to conversation. Total: ${updatedConversationDocs.length}`);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: selectedContact.id,
      attachments: attachedDocuments
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const contactMessages = messages.filter(msg => msg.contactId === selectedContact.id);
      const allConversationDocs = conversationDocuments[selectedContact.id] || [];
      
      const finalConversationDocs = attachedDocuments && attachedDocuments.length > 0 
        ? [...allConversationDocs, ...attachedDocuments.filter(newDoc => 
            !allConversationDocs.find(doc => doc.id === newDoc.id)
          )]
        : allConversationDocs;
      
      console.log(`🤖 Generating AI response with ${finalConversationDocs.length} conversation documents available`);
      
      const aiResponseContent = await geminiService.generateResponse(
        selectedContact, 
        content, 
        contactMessages,
        finalConversationDocs
      );

      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: aiResponseContent,
          sender: 'ai',
          timestamp: new Date(),
          contactId: selectedContact.id
        };
        setMessages(prev => [...prev, aiResponse]);
        console.log(`🤖 AI response added: "${aiResponseContent}"`);
      }, 1000 + Math.random() * 1000);
    } catch (error) {
      console.error('❌ Error generating AI response:', error);
      
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          sender: 'ai',
          timestamp: new Date(),
          contactId: selectedContact.id
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1500);
    }
  };

  const handleEndCall = () => {
    geminiLiveService.endSession();
    setCallState(prev => ({ ...prev, status: 'ended', isActive: false }));
    setCurrentScreen('dashboard');
  };

  const handleToggleMute = () => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
    }
    setCurrentScreen('settings');
  };

  const handleSaveContact = async (updatedContact: AIContact) => {
    if (!user) return;

    console.log(`💾 Saving contact: ${updatedContact.name}`);
    
    try {
      if (updatedContact.id.startsWith('new-')) {
        // Create new agent
        const newAgent = await supabaseService.createUserAgent(user.id, updatedContact);
        const transformedContact = {
          ...updatedContact,
          id: newAgent.id
        };
        setContacts(prev => [...prev, transformedContact]);
        setSelectedContact(transformedContact);
      } else {
        // Update existing agent
        await supabaseService.updateUserAgent(updatedContact.id, {
          name: updatedContact.name,
          description: updatedContact.description,
          initials: updatedContact.initials,
          color: updatedContact.color,
          voice: updatedContact.voice,
          avatar_url: updatedContact.avatar,
          status: updatedContact.status
        });
        
        setContacts(prev => 
          prev.map(contact => 
            contact.id === updatedContact.id ? updatedContact : contact
          )
        );
        setSelectedContact(updatedContact);
      }

      // Restart integrations with new configuration
      if (updatedContact.integrations) {
        console.log(`🔄 Restarting integrations for ${updatedContact.name}`);
        
        updatedContact.integrations.forEach(integrationInstance => {
          const integration = getIntegrationById(integrationInstance.integrationId);
          if (integration && integrationInstance.config.enabled && integration.category !== 'action') {
            integrationsService.startPeriodicExecution(
              updatedContact.id, 
              integration, 
              integrationInstance.config, 
              (contactId, data) => {
                console.log(`📈 Integration data updated for contact ${contactId} (${integration.name}):`, data.summary || 'Data received');
              }
            );
          }
        });
      } else {
        console.log(`🛑 Stopping all integrations for ${updatedContact.name}`);
        integrationsService.stopAllExecution();
      }
    } catch (error) {
      console.error('Failed to save contact:', error);
    }
  };

  const handleBack = () => {
    if (currentScreen === 'call') {
      console.log("👈 Back from call - ending call");
      handleEndCall();
    } else if (currentScreen === 'settings') {
      if (selectedContact) {
        setCurrentScreen('chat');
      } else {
        setCurrentScreen('dashboard');
      }
    } else if (currentScreen === 'chat') {
      setCurrentScreen('dashboard');
      setSelectedContact(null);
    } else {
      setCurrentScreen('dashboard');
      setSelectedContact(null);
    }
  };

  const handleHomeClick = () => {
    setCurrentScreen('dashboard');
    setSelectedContact(null);
  };

  const handleCreateAgent = () => {
    const newAgent: AIContact = {
      id: `new-${Date.now()}`,
      name: 'New Agent',
      initials: 'NA',
      color: '#3b82f6',
      description: 'A new AI assistant ready to be customized.',
      status: 'online',
      lastSeen: 'now',
      voice: 'Puck'
    };
    
    setSelectedContact(newAgent);
    setCurrentScreen('settings');
  };

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!user) {
    return <AuthScreen />;
  }

  // Show loading screen while loading user data
  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your agents...</p>
        </div>
      </div>
    );
  }

  // Get messages for selected contact
  const contactMessages = selectedContact 
    ? messages.filter(msg => msg.contactId === selectedContact.id)
    : [];

  // Get conversation documents for selected contact
  const contactConversationDocuments = selectedContact 
    ? conversationDocuments[selectedContact.id] || []
    : [];

  const renderMainContent = () => {
    switch (currentScreen) {
      case 'dashboard':
        return (
          <Dashboard 
            contacts={contacts}
            onChatClick={handleChatClick}
            onCallClick={handleCallClick}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCreateAgent={handleCreateAgent}
          />
        );

      case 'chat':
        return selectedContact ? (
          <ChatScreen
            contact={selectedContact}
            messages={contactMessages}
            conversationDocuments={contactConversationDocuments}
            onBack={handleBack}
            onSendMessage={handleSendMessage}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCallClick={handleCallClick}
          />
        ) : (
          <Dashboard 
            contacts={contacts}
            onChatClick={handleChatClick}
            onCallClick={handleCallClick}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCreateAgent={handleCreateAgent}
          />
        );
      case 'call':
        return selectedContact ? (
          <CallScreen
            contact={selectedContact}
            callState={callState}
            onBack={handleBack}
            onEndCall={handleEndCall}
            onToggleMute={handleToggleMute}
          />
        ) : (
          <Dashboard 
            contacts={contacts}
            onChatClick={handleChatClick}
            onCallClick={handleCallClick}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCreateAgent={handleCreateAgent}
          />
        );
      case 'settings':
        return selectedContact ? (
          <SettingsScreen
            contact={selectedContact}
            onBack={handleBack}
            onSave={handleSaveContact}
          />
        ) : (
          <Dashboard 
            contacts={contacts}
            onChatClick={handleChatClick}
            onCallClick={handleCallClick}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCreateAgent={handleCreateAgent}
          />
        );
      default:
        return (
          <Dashboard 
            contacts={contacts}
            onChatClick={handleChatClick}
            onCallClick={handleCallClick}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCreateAgent={handleCreateAgent}
          />
        );
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex font-inter overflow-hidden">
      {/* Left Sidebar - Contacts - 25% */}
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
      
      {/* Main Content - Chat/Call/Dashboard */}
      <div className={currentScreen === 'dashboard' ? 'flex-1' : 'w-1/2'}>
        {renderMainContent()}
      </div>

      {/* Right Sidebar - Settings - 25% (only show when not on dashboard) */}
      {currentScreen !== 'dashboard' && (
        <div className="w-1/4 bg-slate-800 border-l border-slate-700">
          <SettingsSidebar
            contact={selectedContact}
            onSave={handleSaveContact}
          />
        </div>
      )}
    </div>
  );
}

export default App;