import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthProvider } from '../../modules/auth/hooks/useAuth';
import { AuthScreen } from '../../modules/auth';
import { ChatScreen } from '../../modules/chat';
import { CallScreen } from '../../modules/voice';
import { Dashboard, ContactSidebar, SettingsScreen } from '../../modules/ui';
import { AIContact } from '../types/types';
import { contactsService } from '../data/contacts';
import LandingPage from '../../components/LandingPage';
import PricingPage from '../../components/PricingPage';
import SuccessNotice from '../../components/SuccessNotice';

type AppView = 'landing' | 'auth' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings';

function AppContent() {
  const { user, loading: authLoading } = useAuthProvider();
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load contacts when user is authenticated
  useEffect(() => {
    if (user && currentView === 'dashboard') {
      loadContacts();
    }
  }, [user, currentView]);

  // Auto-navigate to dashboard when user is authenticated
  useEffect(() => {
    if (user && (currentView === 'landing' || currentView === 'auth' || currentView === 'pricing')) {
      setCurrentView('dashboard');
    }
  }, [user, currentView]);

  const loadContacts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      console.log('📱 Loading contacts for user:', user.email);
      
      const userContacts = await contactsService.loadUserContacts(user.id);
      setContacts(userContacts);
      
      console.log('✅ Loaded', userContacts.length, 'contacts');
    } catch (err) {
      console.error('❌ Error loading contacts:', err);
      setError('Failed to load your AI agents. Please try refreshing the page.');
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
    setSelectedContact(contact || null);
    setCurrentView('settings');
  };

  const handleHomeClick = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleCreateAgent = () => {
    // Create a new contact template
    const newContact: AIContact = {
      id: 'new',
      name: '',
      description: '',
      initials: 'AI',
      color: '#3b82f6',
      status: 'online',
      lastSeen: 'now',
      voice: 'Puck'
    };
    setSelectedContact(newContact);
    setCurrentView('settings');
  };

  const handleSaveContact = async (contact: AIContact) => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('💾 Saving contact:', contact.name);
      
      const savedContact = await contactsService.saveContact(user.id, contact);
      
      // Update contacts list
      if (contact.id === 'new') {
        setContacts(prev => [...prev, savedContact]);
        setSuccessMessage('AI agent created successfully!');
      } else {
        setContacts(prev => prev.map(c => c.id === contact.id ? savedContact : c));
        setSuccessMessage('AI agent updated successfully!');
      }
      
      setCurrentView('dashboard');
      setSelectedContact(null);
    } catch (err) {
      console.error('❌ Error saving contact:', err);
      setError('Failed to save AI agent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🗑️ Deleting contact:', contactId);
      
      await contactsService.deleteContact(contactId);
      
      setContacts(prev => prev.filter(c => c.id !== contactId));
      setSuccessMessage('AI agent deleted successfully!');
      
      if (selectedContact?.id === contactId) {
        setCurrentView('dashboard');
        setSelectedContact(null);
      }
    } catch (err) {
      console.error('❌ Error deleting contact:', err);
      setError('Failed to delete AI agent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen during auth initialization
  if (authLoading) {
    return (
      <div className="h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error if there's a critical error
  if (error && !user) {
    return (
      <div className="h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-400 mb-4">⚠️ Error</div>
          <p className="text-white mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setCurrentView('landing');
            }}
            className="px-4 py-2 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full transition-colors duration-200"
          >
            Try Again
          </button>
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
            onSuccess={() => setCurrentView('dashboard')}
            onBack={() => setCurrentView('landing')}
          />
        );
      
      case 'dashboard':
        if (!user) return <Navigate to="/auth" replace />;
        return (
          <div className="h-screen flex bg-glass-bg">
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
            <div className="flex-1">
              <Dashboard
                contacts={contacts}
                onChatClick={handleChatClick}
                onCallClick={handleCallClick}
                onSettingsClick={handleSettingsClick}
                onNewChatClick={handleChatClick}
                onCreateAgent={handleCreateAgent}
              />
            </div>
          </div>
        );
      
      case 'chat':
        if (!user || !selectedContact) return <Navigate to="/dashboard" replace />;
        return (
          <div className="h-screen flex bg-glass-bg">
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
            <div className="flex-1">
              <ChatScreen
                contact={selectedContact}
                onBack={handleHomeClick}
                onCall={() => handleCallClick(selectedContact)}
                onSettings={() => handleSettingsClick(selectedContact)}
              />
            </div>
          </div>
        );
      
      case 'call':
        if (!user || !selectedContact) return <Navigate to="/dashboard" replace />;
        return (
          <CallScreen
            contact={selectedContact}
            onEndCall={handleHomeClick}
            onBack={handleHomeClick}
          />
        );
      
      case 'settings':
        if (!user) return <Navigate to="/dashboard" replace />;
        return (
          <SettingsScreen
            contact={selectedContact}
            onBack={handleHomeClick}
            onSave={handleSaveContact}
          />
        );
      
      default:
        return <Navigate to="/landing" replace />;
    }
  };

  return (
    <div className="font-inter">
      {renderCurrentView()}
      
      {/* Success Notice */}
      {successMessage && (
        <SuccessNotice
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
      
      {/* Error Notice */}
      {error && (
        <div className="fixed top-6 right-6 z-50 bg-red-900/90 border border-red-700 text-red-300 px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-glass-panel glass-effect rounded-xl p-6 border border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-[#186799] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-white">Processing...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const authValue = useAuthProvider();

  return (
    <AuthContext.Provider value={authValue}>
      <Router>
        <Routes>
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}