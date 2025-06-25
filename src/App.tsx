import React, { useState, useEffect } from 'react';
import ContactSidebar from './components/ContactSidebar';
import SettingsSidebar from './components/SettingsSidebar';
import Dashboard from './components/Dashboard';
import ChatScreen from './modules/chat/ChatScreen';
import CallScreen from './modules/calls/CallScreen';
import SettingsScreen from './components/SettingsScreen';

import { AIContact, Message, Screen, CallState, DocumentInfo } from './types';
import { defaultContacts } from './data/contacts';
import { useLocalStorage } from './hooks/useLocalStorage';
import { geminiService } from './services/geminiService';
import { integrationsService } from './services/integrationsService';
import { getIntegrationById } from './data/integrations';
import { geminiLiveService } from './modules/calls/services/geminiLiveService';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useLocalStorage<AIContact[]>('gatheraround-contacts', defaultContacts);
  const [messages, setMessages] = useLocalStorage<Message[]>('gatheraround-messages', []);
  // Store conversation documents per contact
  const [conversationDocuments, setConversationDocuments] = useLocalStorage<Record<string, DocumentInfo[]>>('gatheraround-conversation-docs', {});
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    duration: 0,
    isMuted: false,
    status: 'ended'
  });

  // Initialize integrations for all contacts on app start
  useEffect(() => {
    console.log('🚀 Initializing integrations for all contacts...');
    
    contacts.forEach(contact => {
      if (contact.integrations) {
        console.log(`📊 Setting up integrations for ${contact.name}:`, contact.integrations.map(i => getIntegrationById(i.integrationId)?.name));
        
        contact.integrations.forEach(integrationInstance => {
          const integration = getIntegrationById(integrationInstance.integrationId);
          if (integration && integrationInstance.config.enabled) {
            console.log(`🔌 Starting periodic execution for ${integration.name} (${contact.name})`);
            
            // Start periodic execution if configured (skip for action integrations)
            if (integration.category !== 'action') {
              integrationsService.startPeriodicExecution(
                contact.id, 
                integration, 
                integrationInstance.config, 
                (contactId, data) => {
                  console.log(`📈 Integration data updated for contact ${contactId} (${integration.name}):`, data.summary || 'Data received');
                }
              );
              
              // Execute immediately if trigger includes chat-start or both
              if (integrationInstance.config.trigger === 'chat-start' || integrationInstance.config.trigger === 'both') {
                console.log(`⚡ Executing ${integration.name} immediately for ${contact.name}`);
                integrationsService.executeIntegration(integration, integrationInstance.config)
                  .then(data => {
                    // Store the data immediately
                    integrationsService.storeIntegrationData(contact.id, integration.id, data);
                    console.log(`✅ Initial execution successful for ${integration.name}:`, data.summary || 'Data received');
                  })
                  .catch(error => {
                    console.error(`❌ Initial execution failed for ${integration.name}:`, error.message);
                  });
              }
            } else {
              console.log(`⚡ Action integration ${integration.name} ready for ${contact.name} (function calling only)`);
            }
          }
        });
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up integrations...');
      integrationsService.stopAllExecution();
    };
  }, [contacts]);

  const handleChatClick = async (contact: AIContact) => {
    console.log(`💬 Starting chat with ${contact.name}`);
    setSelectedContact(contact);
    setCurrentScreen('chat');

    // Execute integrations on chat start if configured (skip action integrations)
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
            // Store the data immediately
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

    // Execute integrations on chat start if configured (skip action integrations)
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
            // Store the data immediately
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
    // If there's an active call, end it first (like hanging up)
    if (callState.isActive && callState.status !== 'ended') {
      console.log(`🔄 Ending current call to start new call with ${contact.name}`);
      handleEndCall();
      
      // Small delay to ensure cleanup completes before starting new call
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
    
    // Initialize Gemini Live service for voice call
    geminiLiveService.initialize().then(initialized => {
      if (initialized) {
        geminiLiveService.startSession(contact).then(() => {
          // Simulate connection
          setTimeout(() => {
            setCallState(prev => ({ ...prev, status: 'connected' }));
          }, 2000);
        });
      } else {
        // Handle initialization failure
        setTimeout(() => {
          setCallState(prev => ({ ...prev, status: 'ended' }));
          handleEndCall();
        }, 2000);
      }
    });
  };

  const handleSendMessage = async (content: string, attachedDocuments?: DocumentInfo[]) => {
    if (!selectedContact) return;

    console.log(`📤 Sending message to ${selectedContact.name}: "${content}"`);
    if (attachedDocuments?.length) {
      console.log(`📎 With ${attachedDocuments.length} attached documents`);
    }

    // Get existing conversation documents for this contact
    const existingConversationDocs = conversationDocuments[selectedContact.id] || [];
    
    // Add new documents to conversation documents if provided
    if (attachedDocuments && attachedDocuments.length > 0) {
      const updatedConversationDocs = [...existingConversationDocs];
      
      // Add only new documents (avoid duplicates)
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
      attachments: attachedDocuments // Only store newly attached documents in the message
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Get chat history for this contact (excluding the message we just added)
      const contactMessages = messages.filter(msg => msg.contactId === selectedContact.id);
      
      // Get ALL conversation documents for this contact (accumulated over time)
      const allConversationDocs = conversationDocuments[selectedContact.id] || [];
      
      // If we just added new documents, include them
      const finalConversationDocs = attachedDocuments && attachedDocuments.length > 0 
        ? [...allConversationDocs, ...attachedDocuments.filter(newDoc => 
            !allConversationDocs.find(doc => doc.id === newDoc.id)
          )]
        : allConversationDocs;
      
      console.log(`🤖 Generating AI response with ${finalConversationDocs.length} conversation documents available`);
      
      // Generate AI response using Gemini with ALL conversation documents
      const aiResponseContent = await geminiService.generateResponse(
        selectedContact, 
        content, 
        contactMessages,
        finalConversationDocs // Pass ALL conversation documents, not just newly attached ones
      );

      // Add AI response after a short delay
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
      
      // Fallback response in case of error
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
    // End the Gemini Live session
    geminiLiveService.endSession();
    
    setCallState(prev => ({ ...prev, status: 'ended', isActive: false }));
    setCurrentScreen('dashboard');
  };

  const handleToggleMute = () => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const handleSettingsClick = (contact?: AIContact) => {
    // Always set the contact if provided, regardless of current screen
    if (contact) {
      setSelectedContact(contact);
    }
    setCurrentScreen('settings');
  };

  const handleSaveContact = (updatedContact: AIContact) => {
    console.log(`💾 Saving contact: ${updatedContact.name}`);
    
    setContacts(prev => 
      prev.map(contact => 
        contact.id === updatedContact.id ? updatedContact : contact
      )
    );
    setSelectedContact(updatedContact);

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
      // Stop all integrations for this contact if none are configured
      console.log(`🛑 Stopping all integrations for ${updatedContact.name}`);
      integrationsService.stopAllExecution();
    }
  };

  const handleBack = () => {
    if (currentScreen === 'call') {
      // From call screen, act like hanging up
      console.log("👈 Back from call - ending call");
      handleEndCall();
    } else if (currentScreen === 'settings') {
      // From settings, always go to that agent's chat
      if (selectedContact) {
        setCurrentScreen('chat');
      } else {
        // If no contact selected, go to dashboard
        setCurrentScreen('dashboard');
      }
    } else if (currentScreen === 'chat') {
      // From chat, always go to dashboard
      setCurrentScreen('dashboard');
      setSelectedContact(null);
    } else {
      // Default behavior for other screens
      setCurrentScreen('dashboard');
      setSelectedContact(null);
    }
  };

  const handleHomeClick = () => {
    setCurrentScreen('dashboard');
    setSelectedContact(null);
  };



  // Get messages for selected contact
  const contactMessages = selectedContact 
    ? messages.filter(msg => msg.contactId === selectedContact.id)
    : [];

  // Get conversation documents for selected contact
  const contactConversationDocuments = selectedContact 
    ? conversationDocuments[selectedContact.id] || []
    : [];

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