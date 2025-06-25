import React, { useState, useMemo } from 'react';
import { 
  Bot, MessageSquare, Phone, Settings, Sparkles, Users, Zap, Brain, 
  Search, TrendingUp, Bell, Globe, Rss, Newspaper,
  Mic, MessageCircle, Sliders, Grid3x3, Filter, Star, Clock, 
  BarChart3, Bookmark, CheckCircle2
} from 'lucide-react';
import { AIContact } from '../types';
import { sourceIntegrations, actionIntegrations } from '../data/integrations';

interface DashboardProps {
  contacts: AIContact[];
  onChatClick: (contact: AIContact) => void;
  onCallClick: (contact: AIContact) => void;
  onSettingsClick: (contact?: AIContact) => void;
  onNewChatClick: (contact: AIContact) => void;
}

export default function Dashboard({ 
  contacts, 
  onChatClick, 
  onCallClick, 
  onSettingsClick,
  onNewChatClick 
}: DashboardProps) {
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [integrationSearchQuery, setIntegrationSearchQuery] = useState('');

  // Get frequently used agents (first 4 for hero section)
  const frequentAgents = contacts.slice(0, 4);
  
  // Get recent agents based on last seen
  const recentAgents = useMemo(() => {
    return [...contacts]
      .sort((a, b) => {
        if (a.lastSeen === 'now') return -1;
        if (b.lastSeen === 'now') return 1;
        return 0;
      })
      .slice(0, 6);
  }, [contacts]);

  // Filter agents for search
  const filteredAgents = useMemo(() => {
    if (!agentSearchQuery.trim()) return contacts;
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
      contact.description.toLowerCase().includes(agentSearchQuery.toLowerCase())
    );
  }, [contacts, agentSearchQuery]);

  // All integrations
  const allIntegrations = [...sourceIntegrations, ...actionIntegrations];
  
  // Filter integrations for search
  const filteredIntegrations = useMemo(() => {
    if (!integrationSearchQuery.trim()) return allIntegrations;
    return allIntegrations.filter(integration => 
      integration.name.toLowerCase().includes(integrationSearchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(integrationSearchQuery.toLowerCase()) ||
      integration.tags?.some(tag => tag.toLowerCase().includes(integrationSearchQuery.toLowerCase()))
    );
  }, [integrationSearchQuery, allIntegrations]);

  // Calculate stats
  const stats = {
    totalAgents: contacts.length,
    activeAgents: contacts.filter(c => c.status === 'online').length,
    totalIntegrations: contacts.reduce((sum, c) => sum + (c.integrations?.length || 0), 0),
    activeIntegrations: contacts.reduce((sum, c) => 
      sum + (c.integrations?.filter(i => i.status === 'active').length || 0), 0
    )
  };

  const getIconForIntegration = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      Globe, Rss, Newspaper, TrendingUp, Bot, Zap, Bell
    };
    const IconComponent = iconMap[iconName] || Globe;
    return <IconComponent className="w-5 h-5" />;
  };



  // Helper function to create radial gradient for agents without avatars
  const createAgentGradient = (color: string) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Create complementary color by shifting hue and make it lighter
    const compR = Math.round(255 - r * 0.3); // Softer complement
    const compG = Math.round(255 - g * 0.3);
    const compB = Math.round(255 - b * 0.3);
    
    // Make complementary color lighter than the main color
    const lightCompR = Math.round(compR + (255 - compR) * 0.8);
    const lightCompG = Math.round(compG + (255 - compG) * 0.8);
    const lightCompB = Math.round(compB + (255 - compB) * 0.8);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  return (
    <div className="h-full bg-slate-900 overflow-y-auto">
      {/* Header Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-slate-900"></div>
        
        <div className="relative px-8 pt-8 pb-12">
          <div className="max-w-6xl mx-auto">
            {/* Greeting */}
            <div className="mb-8">
              <div className="flex items-center space-x-4 mb-4">
                {/* Logo - commented out */}
                {/* <img
                  src="/media/gather-logo-dark.png"
                  alt="Gather Logo"
                  className="w-24 h-24 object-contain"
                /> */}
                <div>
                  <h1 className="text-4xl font-bold text-white">Good morning, Emmanuel</h1>
                  <p className="text-slate-400 text-lg">Ready to chat with your AI companions?</p>
          </div>
          </div>
        </div>

        {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-blue-600/20">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.totalAgents}</div>
                    <div className="text-slate-400 text-sm">AI Agents</div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-green-600/20">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.activeAgents}</div>
                    <div className="text-slate-400 text-sm">Online Now</div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-purple-600/20">
                    <Grid3x3 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.totalIntegrations}</div>
                    <div className="text-slate-400 text-sm">Integrations</div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-orange-600/20">
                    <Zap className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.activeIntegrations}</div>
                    <div className="text-slate-400 text-sm">Active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Frequently Used Agents */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Frequently Used</h2>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {frequentAgents.map((agent) => (
                <div key={agent.id} className="group relative">
                  <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-200 hover:transform hover:scale-105">
                    <div className="flex flex-col items-center text-center space-y-4">
                                             <div className="w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden">
                         {agent.avatar ? (
                           <img
                             src={agent.avatar}
                             alt={agent.name}
                             className="w-full h-full object-cover rounded-2xl"
                           />
                         ) : (
                           <div 
                             className="w-full h-full rounded-2xl"
                             style={{ background: createAgentGradient(agent.color) }}
                           />
                         )}
                </div>
                <div>
                        <h3 className="font-semibold text-white mb-1">{agent.name}</h3>
                        <p className="text-slate-400 text-sm line-clamp-2">{agent.description}</p>
                      </div>
                      <div className="flex space-x-2 w-full">
                        <button 
                          onClick={() => onChatClick(agent)}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg p-2 text-slate-300 hover:text-white transition-colors"
                        >
                          <MessageCircle className="w-4 h-4 mx-auto" />
                        </button>
                        <button 
                          onClick={() => onCallClick(agent)}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg p-2 text-slate-300 hover:text-white transition-colors"
                        >
                          <Mic className="w-4 h-4 mx-auto" />
                        </button>
                        <button 
                          onClick={() => onSettingsClick(agent)}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg p-2 text-slate-300 hover:text-white transition-colors"
                        >
                          <Sliders className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>



          {/* Recent Activity */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {recentAgents.slice(0, 6).map((agent) => (
                <div key={`recent-${agent.id}`} className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                  <div className="flex items-center space-x-3">
                                         <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                       {agent.avatar ? (
                         <img
                           src={agent.avatar}
                           alt={agent.name}
                           className="w-full h-full object-cover rounded-lg"
                         />
                       ) : (
                         <div 
                           className="w-full h-full rounded-lg"
                           style={{ background: createAgentGradient(agent.color) }}
                         />
                       )}
                     </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{agent.name}</h4>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-green-400' : 'bg-slate-400'}`}></div>
                        <span className="text-slate-400 text-sm">{agent.lastSeen}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Agents Library - positioned 3/4 down the screen */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Agents Library</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={agentSearchQuery}
                  onChange={(e) => setAgentSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <div key={`library-${agent.id}`} className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-200 group">
                  <div className="flex items-start space-x-4">
                                         <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                       {agent.avatar ? (
                         <img
                           src={agent.avatar}
                           alt={agent.name}
                           className="w-full h-full object-cover rounded-xl"
                         />
                       ) : (
                         <div 
                           className="w-full h-full rounded-xl"
                           style={{ background: createAgentGradient(agent.color) }}
                         />
                       )}
                     </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-white">{agent.name}</h3>
                        <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-green-400' : 'bg-slate-400'}`}></div>
                      </div>
                      <p className="text-slate-400 text-sm mb-4 line-clamp-2">{agent.description}</p>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => onChatClick(agent)}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onCallClick(agent)}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onSettingsClick(agent)}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Integrations Library */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Integrations Library</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search integrations..."
                  value={integrationSearchQuery}
                  onChange={(e) => setIntegrationSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
            </div>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredIntegrations.map((integration) => (
                <div key={integration.id} className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-200 group">
                  <div className="flex items-start space-x-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: integration.color }}
                    >
                      {getIconForIntegration(integration.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white mb-2">{integration.name}</h3>
                      <p className="text-slate-400 text-sm mb-3 line-clamp-2">{integration.description}</p>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        integration.category === 'source' 
                          ? 'bg-blue-600/20 text-blue-400' 
                          : 'bg-green-600/20 text-green-400'
                      }`}>
                        {integration.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
            </div>
          </div>


    </div>
  );
}