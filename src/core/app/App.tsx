import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthProvider } from '../../modules/auth/hooks/useAuth';
import { supabaseService } from '../../modules/database/services/supabaseService';
import { AIContact } from '../types/types';

// Import components
import LandingPage from '../../components/LandingPage';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import ChatScreen from '../../modules/chat/components/ChatScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';
import { Dashboard, ContactSidebar, SettingsScreen } from '../../modules/ui';

// Import sample data
import { sampleContacts } from '../data/contacts';

type AppView = 'landing' | 'auth' | 'dashboard' | 'chat' | 'call' | 'settings';

function AppContent() {
  const { user, loading: authLoading } = useAuthProvider();
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('🔍 App State Debug:', {
      user: user ? { id: user.id, email: user.email } : null,
      authLoading,
      currentView,
      contactsCount: contacts.length,
      dataLoaded
    });
  }, [user, authLoading, currentView, contacts.length, dataLoaded]);

  // Load user data when authenticated
  useEffect(() => {
    if (user && !authLoading && !dataLoaded) {
      console.log('🚀 User authenticated, loading data...');
      loadUserData();
    } else if (!user && !authLoading) {
      // User is not authenticated, reset state
      console.log('❌ User not authenticated, resetting state');
      setContacts([]);
      setSelectedContact(null);
      setDataLoaded(false);
      if (currentView !== 'landing' && currentView !== 'auth') {
        setCurrentView('landing');
      }
    }
  }, [user, authLoading, dataLoaded]);

  const loadUserData = async () => {
    if (!user) {
      console.log('❌ No user found, cannot load data');
      return;
    }

    try {
      setLoading(true);
      console.log('📊 Loading user data for:', user.email);

      // Test database connection first
      console.log('🔍 Testing database connection...');
      const connectionOk = await supabaseService.testConnection();
      
      if (!connectionOk) {
        console.error('❌ Database connection failed, using sample data');
        setContacts(sampleContacts);
        setCurrentView('dashboard');
        setDataLoaded(true);
        return;
      }

      console.log('✅ Database connection successful');

      // Load user profile
      console.log('👤 Loading user profile...');
      let profile = await supabaseService.getUserProfile(user.id);
      
      if (!profile) {
        console.log('🆕 Creating new user profile...');
        profile = await supabaseService.createUserProfile(user.id, {
          display_name: user.email?.split('@')[0] || 'User',
          email: user.email
        });
        console.log('✅ User profile created:', profile);
      } else {
        console.log('✅ User profile loaded:', profile);
      }

      // Load user agents
      console.log('🤖 Loading user agents...');
      const userAgents = await supabaseService.getUserAgents(user.id);
      console.log('✅ Loaded agents:', userAgents);
      
      setContacts(userAgents);
      setCurrentView('dashboard');
      setDataLoaded(true);
      
      console.log('🎉 User data loading complete!');
      
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      
      // Show more detailed error information
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      
      // Fall back to sample data for development
      console.log('🔄 Falling back to sample data');
      setContacts(sampleContacts);
      setCurrentView('dashboard');
      setDataLoaded(true);
      
    } finally {
      setLoading(false);
    }
  };

  const handleGetStarted = () => {
    console.log('🚀 Get Started clicked, user:', user ? 'authenticated' : 'not authenticated');
    if (user) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('auth');
    }
  };

  const handleChatClick = (contact: AIContact) => {
    console.log('💬 Chat clicked for contact:', contact.name);
    setSelectedContact(contact);
    setCurrentView('chat');
  };

  const handleCallClick = (contact: AIContact) => {
    console.log('📞 Call clicked for contact:', contact.name);
    setSelectedContact(contact);
    setCurrentView('call');
  };

  const handleSettingsClick = (contact?: AIContact) => {
    console.log('⚙️ Settings clicked for contact:', contact?.name || 'none');
    if (contact) {
      setSelectedContact(contact);
      setCurrentView('settings');
    }
  };

  const handleHomeClick = () => {
    console.log('🏠 Home clicked');
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleCreateAgent = () => {
    console.log('➕ Create agent clicked');
    // Create a new agent with default values
    const newAgent: AIContact = {
      id: `agent_${Date.now()}`,
      name: 'New AI Assistant',
      description: 'A helpful AI assistant ready to be customized',
      initials: 'AI',
      color: '#3b82f6',
      voice: 'Puck',
      status: 'online',
      lastSeen: 'now'
    };

    setSelectedContact(newAgent);
    setCurrentView('settings');
  };

  const handleSaveContact = async (contact: AIContact) => {
    try {
      if (!user) {
        console.error('❌ No user found, cannot save contact');
        return;
      }

      console.log('💾 Saving contact:', contact.name);

      // Check if this is a new contact (no existing ID in contacts array)
      const existingIndex = contacts.findIndex(c => c.id === contact.id);
      
      if (existingIndex >= 0) {
        // Update existing contact
        console.log('🔄 Updating existing contact');
        await supabaseService.updateUserAgent(contact.id, contact);
        const updatedContacts = [...contacts];
        updatedContacts[existingIndex] = contact;
        setContacts(updatedContacts);
        
        console.log('✅ Contact updated successfully');
      } else {
        // Create new contact
        console.log('🆕 Creating new contact');
        const newAgent = await supabaseService.createUserAgent(user.id, contact);
        const newContact: AIContact = {
          ...contact,
          id: newAgent.id
        };
        setContacts(prev => [newContact, ...prev]);
        
        console.log('✅ Contact created successfully');
      }
      
      setCurrentView('dashboard');
      setSelectedContact(null);
      
    } catch (error) {
      console.error('❌ Error saving contact:', error);
      alert('Failed to save agent. Please try again.');
    }
  };

  const handleNewChatClick = (contact: AIContact) => {
    handleChatClick(contact);
  };

  // Show loading screen during auth check or data loading
  if (authLoading || loading) {
    return (
      <div className="h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">
            {authLoading ? 'Checking authentication...' : 'Loading your data...'}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            {authLoading ? 'Please wait...' : 'Setting up your workspace...'}
          </p>
        </div>
      </div>
    );
  }

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'landing':
        return <LandingPage onGetStarted={handleGetStarted} />;
      
      case 'auth':
        return (
          <AuthScreen 
            onSuccess={() => {
              console.log('✅ Authentication successful');
              // Don't set view here, let the useEffect handle it
            }}
          />
        );
      
      case 'dashboard':
        return (
          <div className="h-screen flex bg-glass-bg">
            <div className="w-80 flex-shrink-0">
              <ContactSidebar
                contacts={contacts}
                onChatClick={handleChatClick}
                onCallClick={handleCallClick}
                onSettingsClick={handleSettingsClick}
                onHomeClick={handleHomeClick}
                onCreateAgent={handleCreateAgent}
              />
            </div>
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
          </div>
        );
      
      case 'chat':
        return selectedContact ? (
          <div className="h-screen flex bg-glass-bg">
            <div className="w-80 flex-shrink-0">
              <ContactSidebar
                contacts={contacts}
                onChatClick={handleChatClick}
                onCallClick={handleCallClick}
                onSettingsClick={handleSettingsClick}
                onHomeClick={handleHomeClick}
                onCreateAgent={handleCreateAgent}
              />
            </div>
            <div className="flex-1">
              <ChatScreen
                contact={selectedContact}
                onBack={handleHomeClick}
              />
            </div>
          </div>
        ) : (
          <Navigate to="/dashboard" replace />
        );
      
      case 'call':
        return selectedContact ? (
          <CallScreen
            contact={selectedContact}
            onEndCall={handleHomeClick}
          />
        ) : (
          <Navigate to="/dashboard" replace />
        );
      
      case 'settings':
        return selectedContact ? (
          <SettingsScreen
            contact={selectedContact}
            onBack={handleHomeClick}
            onSave={handleSaveContact}
          />
        ) : (
          <Navigate to="/dashboard" replace />
        );
      
      default:
        return <LandingPage onGetStarted={handleGetStarted} />;
    }
  };

  return renderCurrentView();
}

export default function App() {
  const authValue = useAuthProvider();

  return (
    <AuthContext.Provider value={authValue}>
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}