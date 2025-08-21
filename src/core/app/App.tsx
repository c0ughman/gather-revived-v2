import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import DocumentDisplay from '../../modules/voice/components/DocumentDisplay';
import { geminiLiveService } from '../../modules/voice';
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import { Dashboard, ContactSidebar, SettingsSidebar, SettingsScreen } from '../../modules/ui';
import { ChatScreen } from '../../modules/chat';
import MemoryScreen from '../../modules/ui/components/MemoryScreen';
import PastChatsScreen from '../../modules/ui/components/PastChatsScreen';
import { NotesTabRef } from '../../modules/ui/components/NotesTab';
import { AIContact, Message, CallState } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { documentContextService } from '../../modules/fileManagement/services/documentContextService';
import { enhancedAiService } from '../../modules/fileManagement/services/enhancedAiService';
import { memoryService } from '../services/memoryService';
import { conversationSessionManager } from '../services/conversationSessionManager';
import { voiceApiService } from '../services/voiceApiService';
import { supabaseService } from '../../modules/database';
import { supabase } from '../../modules/database/lib/supabase';
import { integrationsService, getIntegrationById } from '../../modules/integrations';
import { documentApiService } from '../services/documentApiService';
import { IntegrationInstance } from '../../modules/integrations/types/integrations';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { SubscriptionBadge, ManageSubscriptionButton } from '../../modules/payments';

type ViewType = 'landing' | 'signup' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent' | 'success' | 'login' | 'memory' | 'past-chats';

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [messages, setMessages] = useLocalStorage<Message[]>('gather-messages', []);
  const [conversationDocuments, setConversationDocuments] = useState<Record<string, DocumentInfo[]>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    duration: 0,
    isMuted: false,
    status: 'ended'
  });
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Ref for notes tab to refresh notes when needed
  const notesTabRef = useRef<NotesTabRef>(null);
  
  // Note viewing state
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [showNoteDocument, setShowNoteDocument] = useState(false);
  
  // Shared state for settings synchronization
  const [settingsFormData, setSettingsFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    voice: 'Puck',
    avatar: ''
  });
  const [settingsIntegrations, setSettingsIntegrations] = useState<IntegrationInstance[]>([]);
  const [settingsDocuments, setSettingsDocuments] = useState<DocumentInfo[]>([]);
  const [settingsHasChanges, setSettingsHasChanges] = useState(false);
  const [isCleaningDocuments, setIsCleaningDocuments] = useState(false);
  

  // Update call duration
  useEffect(() => {
    let interval: number;
    if (callState.isActive && callState.status === 'connected') {
      interval = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState.isActive, callState.status]);

  // Setup conversation session management
  useEffect(() => {
    // Handle app/tab close
    const handleBeforeUnload = () => {
      conversationSessionManager.handleAppClose();
    };

    // Handle page visibility change (tab switch, window minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        conversationSessionManager.handleScreenLeave();
      }
    };

    // Debug functions for testing (remove in production)
    (window as any).debugSession = conversationSessionManager.getCurrentSessionInfo.bind(conversationSessionManager);
    (window as any).debugTriggerMemoryExtraction = conversationSessionManager.debugTriggerMemoryExtraction.bind(conversationSessionManager);
    
    (window as any).debugCreateTestConversation = async () => {
      if (!user || !selectedContact) {
        console.log('❌ Need authenticated user and selected contact');
        return;
      }

      try {
        console.log('🧪 Creating test conversation...');
        
        // Create test session
        const { data: session, error: sessionError } = await supabase
          .from('conversation_sessions')
          .insert({
            agent_id: selectedContact.id,
            user_id: user.id,
            title: 'Test Conversation',
            conversation_type: 'chat',
            message_count: 2,
            started_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
            last_message_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
            ended_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (sessionError) {
          console.error('❌ Error creating test session:', sessionError);
          return;
        }

        console.log('✅ Created test session:', session.id);

        // Create test messages
        const testMessages = [
          {
            session_id: session.id,
            content: 'Hello, this is a test message from the user.',
            role: 'user',
            message_type: 'text',
            created_at: new Date(Date.now() - 300000).toISOString()
          },
          {
            session_id: session.id,
            content: 'Hello! This is a test response from the AI assistant.',
            role: 'assistant',
            message_type: 'text',
            created_at: new Date(Date.now() - 60000).toISOString()
          }
        ];

        const { error: messagesError } = await supabase
          .from('conversation_messages')
          .insert(testMessages);

        if (messagesError) {
          console.error('❌ Error creating test messages:', messagesError);
          return;
        }

        console.log('✅ Created test conversation with 2 messages');
        console.log('🔄 You can now check the past chats to see if it appears');

      } catch (error) {
        console.error('❌ Error creating test conversation:', error);
      }
    };

    (window as any).debugCheckDatabase = async () => {
      if (!user) {
        console.log('❌ Need authenticated user');
        return;
      }

      try {
        console.log('🔍 Checking database status...');
        console.log('👤 Current user:', user.id);
        
        // Check if conversation_sessions table exists and has data
        const { data: sessions, error: sessionsError } = await supabase
          .from('conversation_sessions')
          .select('*')
          .limit(5);

        if (sessionsError) {
          console.error('❌ Error querying conversation_sessions:', sessionsError);
          return;
        }

        console.log(`📊 Total conversations in database: ${sessions.length}`);
        console.log('📋 Sample conversations:', sessions);

        // Check if there are any conversations for current user
        const { data: userSessions, error: userSessionsError } = await supabase
          .from('conversation_sessions')
          .select('*')
          .eq('user_id', user.id);

        if (userSessionsError) {
          console.error('❌ Error querying user conversations:', userSessionsError);
          return;
        }

        console.log(`👤 Your conversations: ${userSessions.length}`);
        console.log('📋 Your conversations:', userSessions);

        // Check if there are any agents
        const { data: agents, error: agentsError } = await supabase
          .from('user_agents')
          .select('id, name')
          .eq('user_id', user.id);

        if (agentsError) {
          console.error('❌ Error querying agents:', agentsError);
          return;
        }

        console.log(`🤖 Your agents: ${agents.length}`);
        console.log('🤖 Agent list:', agents);

        if (selectedContact) {
          console.log(`🎯 Currently selected agent: ${selectedContact.id} (${selectedContact.name})`);
          
          // Check conversations for selected agent
          const { data: agentConversations, error: agentError } = await supabase
            .from('conversation_sessions')
            .select('*')
            .eq('agent_id', selectedContact.id)
            .eq('user_id', user.id);

          if (agentError) {
            console.error('❌ Error querying agent conversations:', agentError);
            return;
          }

          console.log(`💬 Conversations with ${selectedContact.name}: ${agentConversations.length}`);
          console.log('💬 Agent conversations:', agentConversations);
        }

      } catch (error) {
        console.error('❌ Error checking database:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Load messages for selected contact from database
  useEffect(() => {
    if (selectedContact && user) {
      loadMessagesFromDatabase(selectedContact.id);
    }
  }, [selectedContact, user]);

  // Load user data when authenticated
  useEffect(() => {
    if (user && !dataLoading) {
      loadUserData();
      
      // Register document generation callback for paper tool
      geminiLiveService.onDocumentGeneration((document) => {
        console.log('📄 Document generated from voice call:', {
          contentLength: document.content.length,
          wordCount: document.wordCount
        });
        
        // Create a new document info object
        const documentInfo: DocumentInfo = {
          id: `voice-doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `Voice Generated Document ${new Date().toLocaleString()}`,
          type: 'text/markdown',
          size: new Blob([document.content]).size,
          uploadedAt: new Date(),
          content: document.content,
          summary: `Generated from voice call${document.wordCount ? ` (${document.wordCount} words)` : ''}`,
          extractedText: document.content,
          metadata: {
            source: 'voice-call',
            wordCount: document.wordCount,
            generatedAt: new Date().toISOString()
          }
        };
        
        // Add to conversation documents - use a callback to get current state
        setConversationDocuments(prev => {
          // Find the currently active contact from the current state
          const currentContactId = Object.keys(prev).find(id => 
            prev[id] && prev[id].length >= 0 // Just check if this contact has a document array
          ) || 'default';
          
          return {
            ...prev,
            [currentContactId]: [...(prev[currentContactId] || []), documentInfo]
          };
        });
        
        console.log('✅ Document generated and will be added to active conversation');
      });
      
    } else if (!user) {
      setContacts([]);
      setMessages([]);
      setConversationDocuments({});
      
      // Save any active session before logout
      conversationSessionManager.handleAppClose();
      
      // Clear callbacks when user logs out
      geminiLiveService.onDocumentGeneration(() => {});
    }
  }, [user]);

  // Load messages for selected contact from database
  const loadMessagesFromDatabase = async (agentId: string) => {
    try {
      // For now, keep using localStorage until we fully migrate
      // In future versions, this will load from database
      const existingMessages = messages.filter(m => m.contactId === agentId);
      console.log(`📩 Loaded ${existingMessages.length} messages for agent ${agentId}`);
    } catch (error) {
      console.error('Error loading messages from database:', error);
    }
  };

  // Load messages from a specific conversation session
  const loadMessagesFromSession = async (sessionId: string) => {
    try {
      console.log(`📖 Loading messages from session: ${sessionId}`);
      
      // Get session details
      const { data: session, error: sessionError } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('Error loading session:', sessionError);
        alert(`Failed to load conversation: ${sessionError.message}`);
        return;
      }

      if (!session) {
        console.error('Session not found:', sessionId);
        alert('Conversation not found');
        return;
      }

      // Get messages for this session
      const { data: sessionMessages, error: messagesError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error loading session messages:', messagesError);
        alert(`Failed to load messages: ${messagesError.message}`);
        return;
      }

      // Convert database messages to app format
      const convertedMessages: Message[] = (sessionMessages || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.role === 'user' ? 'user' : 'ai',
        timestamp: new Date(msg.created_at),
        contactId: session.agent_id,
        attachments: msg.attachments || []
      }));

      console.log(`📨 Converting ${sessionMessages?.length || 0} database messages to app format`);
      console.log('Session details:', session);
      console.log('Database messages:', sessionMessages);
      console.log('Converted messages:', convertedMessages);

      // Find and select the agent for this session
      const agent = contacts.find(c => c.id === session.agent_id);
      if (!agent) {
        console.error('Agent not found for session:', session.agent_id);
        alert('Agent not found for this conversation');
        return;
      }

      console.log(`🎯 About to set ${convertedMessages.length} messages in React state`);
      console.log('🎯 Sample message:', convertedMessages[0]);
      
      // Set the agent first
      setSelectedContact(agent);
      
      // Clear current messages and load session messages
      setMessages(convertedMessages);
      
      // Change to chat view AFTER setting messages
      setCurrentView('chat');
      
      console.log(`✅ Loaded ${convertedMessages.length} messages from session and set in React state`);
      
      // Force a re-render by logging the current state
      setTimeout(() => {
        console.log('🔍 Messages in state after timeout:', messages.length);
      }, 100);

    } catch (error) {
      console.error('Error loading messages from session:', error);
      alert(`Failed to load conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (user && (currentView === 'landing' || currentView === 'signup' || currentView === 'login')) {
      setCurrentView('dashboard');
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
        total_messages: agent.total_messages,
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
      
      // Document context will be loaded on-demand during voice sessions for better performance
      
      // Integration initialization (scheduling removed - integrations now execute on-demand only)

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

  const handleChatClick = async (contact: AIContact) => {
    // Start new conversation session
    if (user) {
      conversationSessionManager.startSession(contact, user.id);
    }
    
    setSelectedContact(contact);
    setCurrentView('chat');
    
    // Initialize shared settings state with contact data for sidebar
    setSettingsFormData({
      name: contact.name,
      description: contact.description,
      color: contact.color,
      voice: contact.voice || 'Puck',
      avatar: contact.avatar || ''
    });
    setSettingsIntegrations(contact.integrations || []);
    setSettingsDocuments(contact.documents || []);
    setSettingsHasChanges(false);
    
    // Load conversation documents for this contact
    const contactMessages = messages.filter(m => m.contactId === contact.id);
    const allAttachments = contactMessages.flatMap(m => m.attachments || []);
    setConversationDocuments(prev => ({
      ...prev,
      [contact.id]: allAttachments
    }));

    // Integration execution moved to backend - all integrations now execute on-demand during conversations
  };

  const handleCallClick = (contact: AIContact) => {
    // Initialize shared settings state with contact data for sidebar
    setSettingsFormData({
      name: contact.name,
      description: contact.description,
      color: contact.color,
      voice: contact.voice || 'Puck',
      avatar: contact.avatar || ''
    });
    setSettingsIntegrations(contact.integrations || []);
    setSettingsDocuments(contact.documents || []);
    setSettingsHasChanges(false);
    
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
    setCurrentView('call');
    
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

  const handleEndCall = async () => {
    try {
      // Get conversation transcript from voice session before ending
      if (selectedContact && user) {
        console.log(`🎙️ Voice call ending, getting transcript for memory extraction...`);
        try {
          const transcript = await voiceApiService.getConversationTranscript();
          if (transcript.messages.length > 0) {
            // Save voice conversation and extract memories
            await conversationSessionManager.saveVoiceConversation(
              selectedContact,
              user.id,
              transcript
            );
            console.log(`✅ Voice conversation saved with ${transcript.messages.length} messages`);
          } else {
            console.log(`📝 Voice call had no messages to save`);
          }
        } catch (transcriptError) {
          console.error('❌ Error getting voice transcript for memory extraction:', transcriptError);
          // Continue ending call even if transcript fails
        }
      }

      await geminiLiveService.endSession();
      setCallState({
        isActive: false,
        duration: 0,
        isMuted: false,
        status: 'ended'
      });
      setCurrentView('dashboard');
      setSelectedContact(null);
    } catch (error) {
      console.error('❌ Error ending call:', error);
      // Even if there are errors, still end the call
      setCallState({
        isActive: false,
        duration: 0,
        isMuted: false,
        status: 'ended'
      });
      setCurrentView('dashboard');
      setSelectedContact(null);
    }
  };

  const handleToggleMute = () => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const handleNoteAdded = () => {
    // Refresh notes when a new note is added
    if (notesTabRef.current) {
      notesTabRef.current.refreshNotes();
    }
  };

  const handleViewNote = (note: any) => {
    setViewingNote(note);
    setShowNoteDocument(true);
  };

  const handleCloseNoteDocument = () => {
    setShowNoteDocument(false);
    setViewingNote(null);
  };

  const handleMemoryClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('memory');
  };

  const handlePastChatsClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('past-chats');
  };

  const handleBackToChat = () => {
    setCurrentView('chat');
  };

  const handleChatSelect = async (sessionId: string) => {
    console.log('🔍 handleChatSelect called with sessionId:', sessionId);
    console.log('🔍 Current messages before loading:', messages.length);
    try {
      // Load the specific conversation session and continue where it left off
      await loadMessagesFromSession(sessionId);
      console.log('🔍 Messages after loadMessagesFromSession:', messages.length);
    } catch (error) {
      console.error('❌ Error in handleChatSelect:', error);
      alert(`Failed to load conversation: ${error}`);
    }
  };


  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
      
      // Initialize shared settings state with contact data
      setSettingsFormData({
        name: contact.name,
        description: contact.description,
        color: contact.color,
        voice: contact.voice || 'Puck',
        avatar: contact.avatar || ''
      });
      setSettingsIntegrations(contact.integrations || []);
      setSettingsDocuments(contact.documents || []);
      setSettingsHasChanges(false);
      
      setCurrentView('settings');
    }
  };

  const handleNewChatClick = async (contact: AIContact) => {
    // Save current session before starting new chat
    conversationSessionManager.saveCurrentSession();
    
    // Clear messages for this contact to start fresh
    const otherMessages = messages.filter(m => m.contactId !== contact.id);
    setMessages(otherMessages);
    
    // Clear conversation documents for this contact
    setConversationDocuments(prev => {
      const updated = { ...prev };
      delete updated[contact.id];
      return updated;
    });
    
    handleChatClick(contact);
  };

  const handleBack = () => {
    if (currentView === 'call') {
      handleEndCall();
    } else {
      setCurrentView('dashboard');
    setSelectedContact(null);
    }
  };

  const handleHomeClick = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleCreateAgent = () => {
    const newAgent: AIContact = {
      id: `temp_${Date.now()}`,
      name: 'New AI Assistant',
      description: 'A helpful AI assistant ready to be customized.',
      initials: 'AI',
      color: '#3b82f6',
      status: 'online',
      lastSeen: 'now',
      voice: 'Puck'
    };
    setSelectedContact(newAgent);
    
    // Initialize shared settings state
    setSettingsFormData({
      name: newAgent.name,
      description: newAgent.description,
      color: newAgent.color,
      voice: newAgent.voice || 'Puck',
      avatar: newAgent.avatar || ''
    });
    setSettingsIntegrations([]);
    setSettingsDocuments([]);
    setSettingsHasChanges(false);
    
    setCurrentView('create-agent');
  };

  const handleToggleSidebar = () => {
    setShowSidebar(prev => !prev);
  };

  // Settings synchronization functions
  const handleSettingsFormChange = (field: string, value: string) => {
    setSettingsFormData(prev => ({ ...prev, [field]: value }));
    setSettingsHasChanges(true);
  };

  const handleSettingsIntegrationsChange = (integrations: IntegrationInstance[]) => {
    console.log('🔄 Settings integrations changed:', integrations);
    setSettingsIntegrations(integrations);
    setSettingsHasChanges(true);
  };

  const handleSettingsDocumentsChange = (documents: DocumentInfo[]) => {
    // Prevent re-entrancy
    if (isCleaningDocuments) {
      console.log('🚫 Skipping document cleanup - already in progress');
      setSettingsDocuments(documents);
      setSettingsHasChanges(true);
      return;
    }
    
    // If documents are being removed, clean up localStorage messages that reference them
    if (selectedContact && documents.length < settingsDocuments.length) {
      const removedDocuments = settingsDocuments.filter(
        oldDoc => !documents.find(newDoc => newDoc.id === oldDoc.id)
      );
      
      if (removedDocuments.length > 0) {
        setIsCleaningDocuments(true);
        console.log(`🧹 Cleaning up ${removedDocuments.length} documents from localStorage messages`);
        
        // Remove the documents from any message attachments
        setMessages(prevMessages => 
          prevMessages.map(message => {
            if (message.contactId === selectedContact.id && message.attachments) {
              const filteredAttachments = message.attachments.filter(
                attachment => !removedDocuments.find(removedDoc => removedDoc.id === attachment.id)
              );
              
              return {
                ...message,
                attachments: filteredAttachments.length > 0 ? filteredAttachments : undefined
              };
            }
            return message;
          })
        );
        
        console.log(`✅ Cleaned up localStorage messages for ${removedDocuments.length} deleted documents`);
        setIsCleaningDocuments(false);
      }
    }
    
    setSettingsDocuments(documents);
    setSettingsHasChanges(true);
  };

  const handleSettingsSave = (contact: AIContact) => {
    console.log('💾 Saving contact with integrations:', settingsIntegrations);
    
    const updatedContact: AIContact = {
      ...contact,
      name: settingsFormData.name.trim(),
      description: settingsFormData.description.trim(),
      color: settingsFormData.color,
      voice: settingsFormData.voice,
      avatar: settingsFormData.avatar,
      initials: settingsFormData.name.trim().split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
      integrations: settingsIntegrations.length > 0 ? settingsIntegrations : undefined,
      documents: settingsDocuments.length > 0 ? settingsDocuments : undefined
    };
    
    console.log('📦 Updated contact:', updatedContact);
    handleSaveContact(updatedContact);
    setSettingsHasChanges(false);
  };

  // Old memory generation system removed - now using conversationSessionManager for intelligent extraction

  // Function to add mock memory data for testing - REMOVE IN PRODUCTION
  const addMockMemoryData = async (agentId: string) => {
    try {
      console.log('🧠 Adding mock memory data for agent:', agentId);

      // Add mock medium-term memories
      const mockMemories = [
        {
          agent_id: agentId,
          content: 'User: Hi Donald, I\'m working on a React project and need help with state management.\nAI: I\'d be happy to help you with React state management! What specific challenges are you facing?',
          summary: 'User needs help with React state management in their project',
          topic: 'React Development',
          keywords: ['react', 'state', 'management', 'project', 'development'],
          importance_score: 0.8
        },
        {
          agent_id: agentId,
          content: 'User: Can you explain how useEffect works in React?\nAI: useEffect is a React Hook that lets you perform side effects in function components. It runs after every render by default.',
          summary: 'Explained useEffect Hook functionality and usage patterns',
          topic: 'React Hooks',
          keywords: ['useEffect', 'hooks', 'react', 'components', 'render'],
          importance_score: 0.7
        },
        {
          agent_id: agentId,
          content: 'User: I love working with TypeScript! It makes my code so much safer.\nAI: TypeScript is fantastic! The type safety really helps catch errors early and makes refactoring much more confident.',
          summary: 'User expressed enthusiasm for TypeScript development',
          topic: 'TypeScript',
          keywords: ['typescript', 'safety', 'development', 'refactoring'],
          importance_score: 1.0 // Pinned memory
        },
        {
          agent_id: agentId,
          content: 'User: What\'s the best way to handle API calls in React?\nAI: There are several approaches: you can use fetch with useEffect, libraries like axios, or data fetching libraries like React Query or SWR.',
          summary: 'Discussed API call patterns and data fetching strategies',
          topic: 'API Integration',
          keywords: ['fetch', 'axios', 'react-query', 'hooks'],
          importance_score: 0.6
        },
        {
          agent_id: agentId,
          content: 'User: I\'m building a memory system for AI agents.\nAI: That sounds like a fascinating project! Memory systems can really enhance the conversational experience by providing context and continuity.',
          summary: 'User is working on AI agent memory system development',
          topic: 'AI Development',
          keywords: ['memory', 'system', 'agents', 'context', 'continuity'],
          importance_score: 0.9
        }
      ];

      const { data: memories, error: memoryError } = await supabase
        .from('agent_medium_memories')
        .insert(mockMemories)
        .select();

      if (memoryError) {
        console.error('Error adding memories:', memoryError);
        return;
      }

      console.log(`✅ Added ${memories.length} medium-term memories`);

      // Add mock topic frequency data
      const mockTopics = [
        {
          agent_id: agentId,
          topic: 'React Development',
          frequency_count: 5,
          last_mentioned_at: new Date().toISOString()
        },
        {
          agent_id: agentId,
          topic: 'React Hooks',
          frequency_count: 3,
          last_mentioned_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        },
        {
          agent_id: agentId,
          topic: 'TypeScript',
          frequency_count: 4,
          last_mentioned_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        },
        {
          agent_id: agentId,
          topic: 'API Integration',
          frequency_count: 2,
          last_mentioned_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
        },
        {
          agent_id: agentId,
          topic: 'AI Development',
          frequency_count: 1,
          last_mentioned_at: new Date().toISOString()
        }
      ];

      const { data: topics, error: topicError } = await supabase
        .from('agent_memory_topics')
        .insert(mockTopics)
        .select();

      if (topicError) {
        console.error('Error adding topics:', topicError);
        return;
      }

      console.log(`✅ Added ${topics.length} topic frequency entries`);

      // Add a mock paper note
      const mockPaperNote = {
        agent_id: agentId,
        title: 'React Best Practices',
        content: 'Key points discussed:\n- Always use keys in lists\n- Keep components small and focused\n- Use TypeScript for better development experience\n- Consider using React Query for data fetching\n- Implement proper error boundaries',
        note_type: 'summary',
        tags: ['react', 'best-practices', 'development'],
        is_pinned: true
      };

      const { data: note, error: noteError } = await supabase
        .from('agent_paper_notes')
        .insert(mockPaperNote)
        .select();

      if (noteError) {
        console.error('Error adding paper note:', noteError);
        return;
      }

      console.log('✅ Added paper note');

      // Initialize memory usage tracking
      const { error: usageError } = await supabase
        .from('agent_memory_usage')
        .insert({
          agent_id: agentId
        });

      if (usageError && !usageError.message.includes('duplicate')) {
        console.error('Error initializing memory usage:', usageError);
      } else {
        console.log('✅ Memory usage tracking initialized');
      }

      console.log('🎉 Mock memory data added successfully!');
      alert('Mock memory data added! You can now test the memory system by clicking the Brain icon next to Donald Agent.');

    } catch (error) {
      console.error('❌ Error adding mock data:', error);
      alert('Error adding mock data. Check the console for details.');
    }
  };

  const handleSendMessage = async (content: string, documents?: DocumentInfo[]) => {
    if (!selectedContact || !user) return;

    const existingConversationDocs = conversationDocuments[selectedContact.id] || [];

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: selectedContact.id,
      attachments: documents
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Add user message to conversation session
    conversationSessionManager.addMessage(userMessage);


    // Add new documents to conversation documents
    if (documents && documents.length > 0) {
      try {
        console.log(`💾 Saving ${documents.length} conversation documents to Supabase`);
        
        // Save each document to Supabase
        for (const doc of documents) {
          await documentContextService.saveConversationDocument(selectedContact, doc);
        }
        
        const updatedConversationDocs = [...existingConversationDocs];
        
        documents.forEach(newDoc => {
          if (!updatedConversationDocs.find(doc => doc.id === newDoc.id)) {
            updatedConversationDocs.push(newDoc);
          }
        });
        
        setConversationDocuments(prev => ({
          ...prev,
          [selectedContact.id]: updatedConversationDocs
        }));
        
        console.log(`✅ Saved conversation documents to Supabase`);
      } catch (error) {
        console.error('❌ Failed to save conversation documents:', error);
        // Continue with the conversation even if document saving fails
      }
    }

    try {
      // Get conversation history for this contact
      const contactMessages = messages.filter(m => m.contactId === selectedContact.id);
      const chatHistory = [...contactMessages, userMessage];

      // Get fresh document context from Supabase for AI (includes memory)
      const documentContext = await documentContextService.getAgentDocumentContext(selectedContact);

      // Debug: Log memory context inclusion
      console.log('🧠 Memory context included:', !!documentContext.memoryContext);
      if (documentContext.memoryContext) {
        console.log('🧠 Memory context preview:', documentContext.memoryContext.substring(0, 200) + '...');
      }

      // Create an enhanced contact object with full context including memory
      const enhancedContact = {
        ...selectedContact,
        description: documentContext.formattedContext // This includes memory + documents
      };

      console.log('📝 Enhanced context preview:', enhancedContact.description.substring(0, 300) + '...');

      // Generate AI response using the enhanced service with memory-enriched context
      const response = await enhancedAiService.generateResponse(
        enhancedContact,
        content,
        chatHistory,
        documentContext.allDocuments
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Add AI message to conversation session
      conversationSessionManager.addMessage(aiMessage);


      // Memory extraction now happens automatically when session ends via conversationSessionManager

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
      
      // Add error message to conversation session
      conversationSessionManager.addMessage(errorMessage);
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
      
      if (existingContact && !contact.id.startsWith('temp_') && !contact.id.startsWith('new-')) {
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

        // Handle integrations updates
        // Delete all existing integrations first
        if (existingContact?.integrations) {
          for (const integration of existingContact.integrations) {
            try {
              await supabaseService.deleteAgentIntegration(integration.id);
            } catch (error) {
              console.error(`Failed to delete integration ${integration.id}:`, error);
            }
          }
        }

        // Create new integrations if any
        if (contact.integrations) {

          // Create new integrations
          const savedIntegrations = [];
          for (const integration of contact.integrations) {
            try {
              const savedIntegration = await supabaseService.createAgentIntegration(contact.id, integration);
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
          
          contact.integrations = savedIntegrations;
        }

        // Handle documents updates
        if (contact.documents) {
          // For simplicity, we'll delete all existing documents and recreate them
          if (existingContact?.documents) {
            for (const document of existingContact.documents) {
              try {
                await documentApiService.deleteDocument(document.id);
              } catch (error) {
                console.error(`Failed to delete document ${document.id}:`, error);
              }
            }
          }

          // Create new documents
          const savedDocuments = [];
          for (const document of contact.documents) {
            try {
              const savedDocument = await supabaseService.createAgentDocument(contact.id, document);
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
          
          contact.documents = savedDocuments;
        }

        console.log('✅ Updated existing contact in Supabase');
      } else {
        // Create new contact in Supabase
        const newAgent = await supabaseService.createUserAgent(user.id, contact);
        contact.id = newAgent.id; // Update with the database ID

        // Save integrations if any
        if (contact.integrations && contact.integrations.length > 0) {
          const savedIntegrations = [];
          for (const integration of contact.integrations) {
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
          
          contact.integrations = savedIntegrations;
        }

        // Save documents if any
        if (contact.documents && contact.documents.length > 0) {
          const savedDocuments = [];
          for (const document of contact.documents) {
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
          
          contact.documents = savedDocuments;
        }
        
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

      // Integration scheduling removed - all integrations now execute on-demand only

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
      return <SignupPage onSuccess={handleSignupSuccess} onBackToLanding={handleBackToLanding} onSignIn={handleSignIn} />;
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

  // Get messages for selected contact
  const contactMessages = selectedContact 
    ? messages.filter(msg => msg.contactId === selectedContact.id)
    : [];

  // Get conversation documents for selected contact
  const contactConversationDocuments = selectedContact 
    ? conversationDocuments[selectedContact.id] || []
    : [];

  // If authenticated, show the main app
  return (
    <Router>
      <Routes>
        <Route path="/success" element={<SuccessPage />} />
        <Route path="*" element={
          <div className="h-screen flex bg-glass-bg">

            {/* Left Sidebar - Contacts */}
            <div className="w-80 border-r border-slate-700">
                  <ContactSidebar
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onMemoryClick={handleMemoryClick}
                    onSettingsClick={handleSettingsClick}
                onHomeClick={handleHomeClick}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>

            {/* Main Content Area */}
            <div className="flex-1 flex h-full">
                <div className={`h-full ${((currentView === 'chat' && showSidebar) || (currentView === 'call' && showSidebar) || (currentView === 'past-chats' && showSidebar) || currentView === 'settings' || currentView === 'create-agent') ? 'flex-1' : 'w-full'}`}>
                {currentView === 'dashboard' && (
                  <Dashboard
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onMemoryClick={handleMemoryClick}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCreateAgent={handleCreateAgent}
                    onAddMockMemory={addMockMemoryData}
                  />
            )}

            {currentView === 'chat' && selectedContact && (
                  <ChatScreen
                    contact={selectedContact}
                    messages={contactMessages}
                    conversationDocuments={contactConversationDocuments}
                    onBack={handleBack}
                    onSendMessage={handleSendMessage}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCallClick={handleCallClick}
                    onMemoryClick={handleMemoryClick}
                    onPastChatsClick={handlePastChatsClick}
                    onChatSelect={handleChatSelect}
                    showSidebar={showSidebar}
                    onToggleSidebar={handleToggleSidebar}
                  />
                )}
                
            {currentView === 'call' && selectedContact && (
                <CallScreen
                  contact={selectedContact}
                    callState={callState}
                  onBack={handleBack}
                    onEndCall={handleEndCall}
                    onToggleMute={handleToggleMute}
                    showSidebar={showSidebar}
                    onToggleSidebar={handleToggleSidebar}
                    onNoteAdded={handleNoteAdded}
                />
            )}

            {currentView === 'settings' && selectedContact && (
              <SettingsScreen
                contact={selectedContact}
                onBack={handleBack}
                onSave={handleSettingsSave}
                formData={settingsFormData}
                integrations={settingsIntegrations}
                documents={settingsDocuments}
                hasChanges={settingsHasChanges}
                onFormChange={handleSettingsFormChange}
                onIntegrationsChange={handleSettingsIntegrationsChange}
                onDocumentsChange={handleSettingsDocumentsChange}
              />
            )}

            {currentView === 'create-agent' && selectedContact && (
                  <SettingsScreen
                    contact={selectedContact}
                    onBack={handleBack}
                    onSave={(contact) => {
                      handleSettingsSave(contact);
                      setCurrentView('dashboard');
                    }}
                    formData={settingsFormData}
                    integrations={settingsIntegrations}
                    documents={settingsDocuments}
                    hasChanges={settingsHasChanges}
                    onFormChange={handleSettingsFormChange}
                    onIntegrationsChange={handleSettingsIntegrationsChange}
                    onDocumentsChange={handleSettingsDocumentsChange}
                  />
                )}

            {currentView === 'memory' && selectedContact && (
              <MemoryScreen
                contact={selectedContact}
                onBack={handleBack}
              />
            )}

            {currentView === 'past-chats' && selectedContact && (
              <PastChatsScreen
                agent={selectedContact}
                onBack={handleBack}
                onBackToChat={handleBackToChat}
                onChatSelect={handleChatSelect}
                showSidebar={showSidebar}
                onToggleSidebar={handleToggleSidebar}
              />
            )}

                </div>

              {/* Right Sidebar - Settings (when in chat view, call view, past-chats view, settings view, or create-agent view) */}
              {((currentView === 'chat' && showSidebar) || (currentView === 'call' && showSidebar) || (currentView === 'past-chats' && showSidebar) || currentView === 'settings' || currentView === 'create-agent') && (
                <div className="w-80 border-l border-slate-700 z-20 relative">
                    <SettingsSidebar
                    contact={selectedContact}
                    onSave={handleSettingsSave}
                    formData={settingsFormData}
                    integrations={settingsIntegrations}
                    documents={settingsDocuments}
                    hasChanges={settingsHasChanges}
                    onFormChange={handleSettingsFormChange}
                    onIntegrationsChange={handleSettingsIntegrationsChange}
                    onDocumentsChange={handleSettingsDocumentsChange}
                    onViewNote={handleViewNote}
                    notesTabRef={notesTabRef}
                    />
                  </div>
                )}
              </div>
              
              {/* Note Document Display Overlay - Only covers main content area */}
              {showNoteDocument && viewingNote && (
                <div 
                  className="absolute inset-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm"
                  style={{
                    left: showSidebar ? '20rem' : '20rem', // 80px for left sidebar
                    right: showSidebar ? '20rem' : '0', // 80px for right sidebar if shown
                  }}
                >
                  <div className="w-full h-full p-[7px]">
                    <div className="w-full h-full shadow-2xl border border-gray-200 overflow-hidden rounded-[20px] flex flex-col relative" 
                         style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fefcfc 50%, #fdf9f9 100%)' }}>
                      
                      {/* Close Button */}
                      <button
                        onClick={handleCloseNoteDocument}
                        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300 shadow-sm"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>

                      {/* Header */}
                      <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                          <h1 className="text-xl font-bold text-gray-900">{viewingNote.title || 'Note'}</h1>
                          <button
                            onClick={async () => {
                              try {
                                await memoryService.deletePaperNote(viewingNote.id);
                                setShowNoteDocument(false);
                                setViewingNote(null);
                                if (notesTabRef.current) {
                                  notesTabRef.current.refreshNotes();
                                }
                              } catch (error) {
                                console.error('Error deleting note:', error);
                              }
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors duration-200"
                            title="Delete"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(viewingNote.created_at).toLocaleDateString()} • {viewingNote.content ? viewingNote.content.split(' ').length : 0} words
                          {viewingNote.note_type && ` • ${viewingNote.note_type}`}
                          {viewingNote.is_pinned && ' • Pinned'}
                        </p>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-6 overflow-y-auto">
                        <div className="prose prose-gray max-w-none">
                          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {viewingNote.content}
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="p-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Note from {selectedContact?.name}</span>
                          <span>{viewingNote.content?.length || 0} characters</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>
        } />
      </Routes>
    </Router>
  );
}