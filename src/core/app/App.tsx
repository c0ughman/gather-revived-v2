import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthProvider } from '../../modules/auth/hooks/useAuth';
import { supabaseService } from '../../modules/database/services/supabaseService';
import { AIContact } from '../types/types';

// Import components
import LandingPage from '../../components/LandingPage';
import PricingPage from '../../components/PricingPage';
import SuccessNotice from '../../components/SuccessNotice';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import ChatScreen from '../../modules/chat/components/ChatScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';
import { Dashboard, ContactSidebar, SettingsScreen } from '../../modules/ui';

type AppView = 'landing' | 'pricing' | 'auth' | 'dashboard' | 'chat' | 'call' | 'settings';

function AppContent() {
  const { user, loading: authLoading } = useAuthProvider();
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccessNotice, setShowSuccessNotice] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Load user data when authenticated
  useEffect(() => {
    if (user && !authLoading) {
      loadUserData();
    } else if (!user && !authLoading) {
      // User is not authenticated, reset to landing
      setContacts([]);
      setSelectedContact(null);
      if (currentView !== 'landing' && currentView !== 'pricing' && currentView !== 'auth') {
        setCurrentView('landing');
      }
    }
  }, [user, authLoading]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Loading user data for:', user.email);

      // Test database connection first
      const connectionOk = await supabaseService.testConnection();
      if (!connectionOk) {
        console.error('Database connection failed');
        // Show empty state instead of falling back to sample data
        setContacts([]);
        setCurrentView('dashboard');
        return;
      }

      // Load user profile
      let profile = await supabaseService.getUserProfile(user.id);
      if (!profile) {
        console.log('Creating user profile...');
        profile = await supabaseService.createUserProfile(user.id, {
          display_name: user.email?.split('@')[0] || 'User',
          email: user.email
        });
      }

      // Load user agents
      const userAgents = await supabaseService.getUserAgents(user.id);
      console.log('Loaded agents:', userAgents);
      
      setContacts(userAgents);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Error loading user data:', error);
      // Show empty state instead of falling back to sample data
      setContacts([]);
      setCurrentView('dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleGetStarted = () => {
    if (user) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('pricing');
    }
  };

  const handleSkipToPro = () => {
    setCurrentView('auth');
  };

  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('chat');
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

  const handleHomeClick = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleCreateAgent = () => {
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
      if (!user) return;

      // Check if this is a new contact (no existing ID in contacts array)
      const existingIndex = contacts.findIndex(c => c.id === contact.id);
      
      if (existingIndex >= 0) {
        // Update existing contact
        await supabaseService.updateUserAgent(contact.id, contact);
        const updatedContacts = [...contacts];
        updatedContacts[existingIndex] = contact;
        setContacts(updatedContacts);
        
        setSuccessMessage('Agent updated successfully!');
      } else {
        // Create new contact
        const newAgent = await supabaseService.createUserAgent(user.id, contact);
        const newContact: AIContact = {
          ...contact,
          id: newAgent.id
        };
        setContacts(prev => [newContact, ...prev]);
        
        setSuccessMessage('Agent created successfully!');
      }
      
      setShowSuccessNotice(true);
      setCurrentView('dashboard');
      setSelectedContact(null);
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Failed to save agent. Please try again.');
    }
  };

  const handleNewChatClick = (contact: AIContact) => {
    handleChatClick(contact);
  };

  // Show loading screen during auth check
  if (authLoading || loading) {
    return (
      <div className="h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'landing':
        return <LandingPage onGetStarted={handleGetStarted} />;
      
      case 'pricing':
        return <PricingPage onSkipToPro={handleSkipToPro} />;
      
      case 'auth':
        return (
          <AuthScreen 
            onSuccess={() => {
              setSuccessMessage('Welcome to Gather! Your account has been created.');
              setShowSuccessNotice(true);
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

  return (
    <>
      {renderCurrentView()}
      
      {/* Success Notice */}
      {showSuccessNotice && (
        <SuccessNotice
          message={successMessage}
          onClose={() => setShowSuccessNotice(false)}
        />
      )}
    </>
  );
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