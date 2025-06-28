import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { ContactSidebar } from './ContactSidebar';
import { ChatScreen } from '../../chat/components/ChatScreen';
import CallScreen from '../../voice/components/CallScreen';
import { SettingsScreen } from './SettingsScreen';
import { IntegrationsLibrary } from './IntegrationsLibrary';
import { DocumentUpload } from './DocumentUpload';
import { supabaseService } from '../../database/services/supabaseService';
import type { UserAgent } from '../../database/types/database';

export function Dashboard() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<'chat' | 'call' | 'settings' | 'integrations' | 'documents'>('chat');
  const [selectedAgent, setSelectedAgent] = useState<UserAgent | null>(null);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAgents();
    }
  }, [user]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const userAgents = await supabaseService.getUserAgents(user!.id);
      setAgents(userAgents);
      
      // Select first agent by default
      if (userAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(userAgents[0]);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentSelect = (agent: UserAgent) => {
    setSelectedAgent(agent);
    setActiveView('chat');
  };

  const handleAgentUpdate = () => {
    loadAgents();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <ContactSidebar
        agents={agents}
        selectedAgent={selectedAgent}
        onAgentSelect={handleAgentSelect}
        onAgentUpdate={handleAgentUpdate}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      
      <div className="flex-1 flex flex-col">
        {activeView === 'chat' && selectedAgent && (
          <ChatScreen agent={selectedAgent} />
        )}
        {activeView === 'call' && selectedAgent && (
          <CallScreen agent={selectedAgent} />
        )}
        {activeView === 'settings' && (
          <SettingsScreen />
        )}
        {activeView === 'integrations' && (
          <IntegrationsLibrary />
        )}
        {activeView === 'documents' && selectedAgent && (
          <DocumentUpload agent={selectedAgent} />
        )}
      </div>
    </div>
  );
}