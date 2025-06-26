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
import { IntegrationsService } from './services/integrationsService';
import { getIntegrationById } from './data/integrations';
import { geminiLiveService } from './modules/calls/services/geminiLiveService';

function App() {
  const { user, loading: authLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<Record<string, DocumentInfo[]>>({});
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    duration: 0,
    isMuted: false,
    status: 'ended'
  });

  // Update call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.isActive && callState.status === 'connected') {
      interval = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState.isActive, callState.status]);

  // Load user data when authenticated
  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      setContacts([]);
      setMessages([]);
      setConversationDocuments({});
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      const agents = await supabaseService.getUserAgents(user.id);
      
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
      
      // Initialize integrations
      transformedContacts.forEach(contact => {
        if (contact.integrations) {
          contact.integrations.forEach(integrationInstance => {
            const integration = getIntegrationById(integrationInstance.integrationId);
            if (integration && integrationInstance.config.enabled && integration.category !== 'action') {
              IntegrationsService.startPeriodicExecution(
                contact.id, 
                integration, 
                integrationInstance.config, 
                (contactId, data) => {
                  console.log(`Integration data updated for contact ${contactId}`);
                }
              );
            }
          });
        }
      });

    } catch (error) {
      console.error('Failed to load user data:', error);
      setContacts([]);
    }
  };

  const handleChatClick = async (contact: AIContact) => {
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
          try {
            const data = await IntegrationsService.executeIntegration(integration, integrationInstance.config);
            IntegrationsService.storeIntegrationData(contact.id, integration.id, data);
          } catch (error) {
            console.error(`Failed to execute integration ${integration.name}:`, error);
          }
        }
      }
    }
  };

  const handleNewChatClick = async (contact: AIContact) => {
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
          try {
            const data = await IntegrationsService.executeIntegration(integration, integrationInstance.config);
            IntegrationsService.storeIntegrationData(contact.id, integration.id, data);
          } catch (error) {
            console.error(`Failed to execute integration ${integration.name}:`, error);
          }
        }
      }
    }
  };

  const handleCallClick = (contact: AIContact) => {
    if (callState.isActive && callState.status !== 'ended') {
      handleEndCall();
      setTimeout(() => {
        startNewCall(contact);
      }, 200);
    } else {
      startNewCall(contact);
    }
  };

  const startNewCall = (contact: AIContact) => {
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
      }, 1000 + Math.random() * 1000);
    } catch (error) {
      console.error('Error generating AI response:', error);
      
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

    try {
      if (updatedContact.id.startsWith('new-')) {
        // Create new agent in Supabase
        const newAgent = await supabaseService.createUserAgent(user.id, {
          name: updatedContact.name,
          description: updatedContact.description,
          initials: updatedContact.initials,
          color: updatedContact.color,
          voice: updatedContact.voice,
          avatar: updatedContact.avatar,
          status: updatedContact.status || 'online'
        });

        // Create the transformed contact with the real ID
        const transformedContact: AIContact = {
          ...updatedContact,
          id: newAgent.id
        };

        // Save integrations if any
        if (updatedContact.integrations && updatedContact.integrations.length > 0) {
          const savedIntegrations = [];
          for (const integration of updatedContact.integrations) {
            try {
              const savedIntegration = await supabaseService.createAgentIntegration(newAgent.id, integration);
              savedIntegrations.push({
                id: savedIntegration.id,
                integrationId: integration.integrationId,
                name: integration.name,
                config: integration.config,
                status: savedIntegration.status
              });
            } catch (integrationError) {
              console.error(`Failed to save integration ${integration.name}:`, integrationError);
            }
          }
          
          transformedContact.integrations = savedIntegrations;
        }

        // Save documents if any
        if (updatedContact.documents && updatedContact.documents.length > 0) {
          const savedDocuments = [];
          for (const document of updatedContact.documents) {
            try {
              const savedDocument = await supabaseService.createAgentDocument(newAgent.id, document);
              savedDocuments.push({
                id: savedDocument.id,
                name: document.name,
                type: document.type,
                size: document.size,
                uploadedAt: new Date(savedDocument.uploaded_at),
                content: document.content,
                summary: document.summary,
                extractedText: document.extractedText,
                metadata: document.metadata
              });
            } catch (documentError) {
              console.error(`Failed to save document ${document.name}:`, documentError);
            }
          }
          
          transformedContact.documents = savedDocuments;
        }

        // Add to local state
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

        // Handle integrations updates
        if (updatedContact.integrations) {
          // For simplicity, we'll delete all existing integrations and recreate them
          const existingContact = contacts.find(c => c.id === updatedContact.id);
          if (existingContact?.integrations) {
            for (const integration of existingContact.integrations) {
              try {
                await supabaseService.deleteAgentIntegration(integration.id);
              } catch (error) {
                console.error(`Failed to delete integration ${integration.id}:`, error);
              }
            }
          }

          // Create new integrations
          const savedIntegrations = [];
          for (const integration of updatedContact.integrations) {
            try {
              const savedIntegration = await supabaseService.createAgentIntegration(updatedContact.id, integration);
              savedIntegrations.push({
                id: savedIntegration.id,
                integrationId: integration.integrationId,
                name: integration.name,
                config: integration.config,
                status: savedIntegration.status
              });
            } catch (error) {
              console.error(`Failed to save integration ${integration.name}:`, error);
            }
          }
          
          updatedContact.integrations = savedIntegrations;
        }

        // Handle documents updates
        if (updatedContact.documents) {
          // For simplicity, we'll delete all existing documents and recreate them
          const existingContact = contacts.find(c => c.id === updatedContact.id);
          if (existingContact?.documents) {
            for (const document of existingContact.documents) {
              try {
                await supabaseService.deleteAgentDocument(document.id);
              } catch (error) {
                console.error(`Failed to delete document ${document.id}:`, error);
              }
            }
          }

          // Create new documents
          const savedDocuments = [];
          for (const document of updatedContact.documents) {
            try {
              const savedDocument = await supabaseService.createAgentDocument(updatedContact.id, document);
              savedDocuments.push({
                id: savedDocument.id,
                name: document.name,
                type: document.type,
                size: document.size,
                uploadedAt: new Date(savedDocument.uploaded_at),
                content: document.content,
                summary: document.summary,
                extractedText: document.extractedText,
                metadata: document.metadata
              });
            } catch (error) {
              console.error(`Failed to save document ${document.name}:`, error);
            }
          }
          
          updatedContact.documents = savedDocuments;
        }
        
        // Update local state
        setContacts(prev => 
          prev.map(contact => 
            contact.id === updatedContact.id ? updatedContact : contact
          )
        );
        setSelectedContact(updatedContact);
      }

      // Restart integrations with new configuration
      if (updatedContact.integrations) {
        updatedContact.integrations.forEach(integrationInstance => {
          const integration = getIntegrationById(integrationInstance.integrationId);
          if (integration && integrationInstance.config.enabled && integration.category !== 'action') {
            IntegrationsService.startPeriodicExecution(
              updatedContact.id, 
              integration, 
              integrationInstance.config, 
              (contactId, data) => {
                console.log(`Integration data updated for contact ${contactId}`);
              }
            );
          }
        });
      } else {
        IntegrationsService.stopAllExecution();
      }
      
    } catch (error) {
      console.error('Failed to save contact:', error);
      alert(`Failed to save agent: ${error.message || error}`);
    }
  };

  const handleBack = () => {
    if (currentScreen === 'call') {
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