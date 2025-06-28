import React, { useState } from 'react';
import { MessageCircle, Phone, Users, Search, Home, Plus } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { useAuth } from '../../auth/hooks/useAuth';

interface ContactSidebarProps {
  contacts: AIContact[];
  onChatClick: (contact: AIContact) => void;
  onCallClick: (contact: AIContact) => void;
  onSettingsClick: (contact?: AIContact) => void;
  onHomeClick: () => void;
  onCreateAgent: () => void;
}

export default function ContactSidebar({ 
  contacts, 
  onChatClick, 
  onCallClick, 
  onSettingsClick, 
  onHomeClick,
  onCreateAgent 
}: ContactSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const { user } = useAuth();

  const createAgentGradient = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const compR = Math.round(255 - r * 0.3);
    const compG = Math.round(255 - g * 0.3);
    const compB = Math.round(255 - b * 0.3);
    
    const lightCompR = Math.round(compR + (255 - compR) * 0.8);
    const lightCompG = Math.round(compG + (255 - compG) * 0.8);
    const lightCompB = Math.round(compB + (255 - compB) * 0.8);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  const getComplexityIndicators = (contact: AIContact) => {
    const indicators = [];
    
    // Count documents (blue dots)
    const documentCount = contact.documents?.length || 0;
    for (let i = 0; i < Math.min(documentCount, 8); i++) {
      indicators.push({ type: 'document', color: '#3b82f6' });
    }
    
    // Count source integrations (green dots)
    const sourceIntegrations = contact.integrations?.filter(integration => {
      const sourceIds = ['http-requests', 'google-news', 'rss-feeds', 'financial-markets', 'notion-oauth-source'];
      return sourceIds.includes(integration.integrationId) && integration.config.enabled;
    }) || [];
    
    for (let i = 0; i < Math.min(sourceIntegrations.length, 6); i++) {
      indicators.push({ type: 'source', color: '#10b981' });
    }
    
    // Count action integrations (red dots)
    const actionIntegrations = contact.integrations?.filter(integration => {
      const actionIds = ['api-request-tool', 'domain-checker-tool', 'zapier-webhook', 'n8n-webhook', 'webhook-trigger', 'google-sheets', 'notion-oauth-action'];
      return actionIds.includes(integration.integrationId) && integration.config.enabled;
    }) || [];
    
    for (let i = 0; i < Math.min(actionIntegrations.length, 6); i++) {
      indicators.push({ type: 'action', color: '#ef4444' });
    }
    
    return indicators;
  };

  const renderComplexityIndicators = (contact: AIContact) => {
    const indicators = getComplexityIndicators(contact);
    const maxIndicators = 12; // Maximum dots to show
    const displayIndicators = indicators.slice(0, maxIndicators);
    
    if (displayIndicators.length === 0) return null;
    
    return (
      <div className="absolute inset-0 pointer-events-none">
        {displayIndicators.map((indicator, index) => {
          const angle = (index / displayIndicators.length) * 360;
          const radius = 34; // Distance from center
          const x = Math.cos((angle - 90) * Math.PI / 180) * radius;
          const y = Math.sin((angle - 90) * Math.PI / 180) * radius;
          
          return (
            <div
              key={index}
              className="absolute w-2 h-2 rounded-full border border-slate-800"
              style={{
                backgroundColor: indicator.color,
                left: `calc(50% + ${x}px - 4px)`,
                top: `calc(50% + ${y}px - 4px)`,
                boxShadow: `0 0 4px ${indicator.color}40`
              }}
              title={
                indicator.type === 'document' ? 'Document' :
                indicator.type === 'source' ? 'Data Source' : 'Action Tool'
              }
            />
          );
        })}
      </div>
    );
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filters = ['All', 'Complex', 'Simple', 'Favorites'];

  return (
    <div className="h-full bg-glass-panel glass-effect flex flex-col font-inter">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-glass-panel glass-effect">
        <div className="flex items-center justify-between mb-4">
          <div 
            className="flex items-center space-x-3 cursor-pointer"
            onClick={onHomeClick}
          >
            <div>
              <h1 className="text-xl font-bold text-white">Gather</h1>
              <p className="text-xs text-slate-400">Welcome, {user?.email?.split('@')[0]}</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search or start a new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-glass-panel glass-effect text-white pl-10 pr-4 py-2 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 font-inter"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 border-b border-slate-700 bg-glass-panel glass-effect">
        <div className="flex space-x-1">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 font-inter ${
                activeFilter === filter
                  ? 'bg-[#186799] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Section */}
      <div className="px-4 py-2 border-b border-slate-700 bg-glass-panel glass-effect space-y-1">
        <button 
          onClick={onHomeClick}
          className="flex items-center space-x-3 w-full text-left hover:bg-slate-700 p-2 rounded-lg transition-colors duration-200"
        >
          <Home className="w-5 h-5 text-slate-400" />
          <span className="text-slate-300 font-inter">Home</span>
        </button>

        <button 
          onClick={onCreateAgent}
          className="flex items-center space-x-3 w-full text-left hover:bg-slate-700 p-2 rounded-lg transition-colors duration-200"
        >
          <Plus className="w-5 h-5 text-slate-400" />
          <span className="text-slate-300 font-inter">Create Agent</span>
        </button>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-slate-500 mb-4">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No agents yet</p>
              <p className="text-xs">Create your first AI agent to get started</p>
            </div>
            <button
              onClick={onCreateAgent}
              className="px-4 py-2 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full text-sm transition-colors duration-200"
            >
              Create Agent
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredContacts.map((contact) => {
              const indicators = getComplexityIndicators(contact);
              const complexityLevel = indicators.length > 8 ? 'High' : indicators.length > 4 ? 'Medium' : indicators.length > 0 ? 'Low' : 'Basic';
              
              return (
                <div
                  key={contact.id}
                  className="px-4 py-3 hover:bg-slate-700 transition-colors duration-200 cursor-pointer group"
                  onClick={() => onChatClick(contact)}
                >
                  <div className="flex items-center space-x-3">
                    {/* Avatar with Complexity Indicators */}
                    <div className="relative">
                      <div className="w-16 h-16 rounded-lg flex items-center justify-center overflow-hidden">
                        {contact.avatar ? (
                          <img
                            src={contact.avatar}
                            alt={contact.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div
                            className="w-full h-full rounded-lg"
                            style={{ background: createAgentGradient(contact.color) }}
                          />
                        )}
                      </div>
                      
                      {/* Complexity Indicators */}
                      {renderComplexityIndicators(contact)}
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium truncate font-inter">{contact.name}</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-400 font-inter">{contact.lastSeen}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-inter ${
                            complexityLevel === 'High' ? 'bg-red-900/30 text-red-300' :
                            complexityLevel === 'Medium' ? 'bg-yellow-900/30 text-yellow-300' :
                            complexityLevel === 'Low' ? 'bg-green-900/30 text-green-300' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {complexityLevel}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm truncate mt-0.5 font-inter">
                        {contact.description.length > 40 
                          ? `${contact.description.substring(0, 40)}...` 
                          : contact.description
                        }
                      </p>
                      
                      {/* Complexity Summary */}
                      {indicators.length > 0 && (
                        <div className="flex items-center space-x-3 mt-1">
                          {contact.documents && contact.documents.length > 0 && (
                            <span className="text-xs text-blue-400 font-inter">
                              📄 {contact.documents.length}
                            </span>
                          )}
                          {contact.integrations && contact.integrations.filter(i => {
                            const sourceIds = ['http-requests', 'google-news', 'rss-feeds', 'financial-markets', 'notion-oauth-source'];
                            return sourceIds.includes(i.integrationId) && i.config.enabled;
                          }).length > 0 && (
                            <span className="text-xs text-green-400 font-inter">
                              📊 {contact.integrations.filter(i => {
                                const sourceIds = ['http-requests', 'google-news', 'rss-feeds', 'financial-markets', 'notion-oauth-source'];
                                return sourceIds.includes(i.integrationId) && i.config.enabled;
                              }).length}
                            </span>
                          )}
                          {contact.integrations && contact.integrations.filter(i => {
                            const actionIds = ['api-request-tool', 'domain-checker-tool', 'zapier-webhook', 'n8n-webhook', 'webhook-trigger', 'google-sheets', 'notion-oauth-action'];
                            return actionIds.includes(i.integrationId) && i.config.enabled;
                          }).length > 0 && (
                            <span className="text-xs text-red-400 font-inter">
                              ⚡ {contact.integrations.filter(i => {
                                const actionIds = ['api-request-tool', 'domain-checker-tool', 'zapier-webhook', 'n8n-webhook', 'webhook-trigger', 'google-sheets', 'notion-oauth-action'];
                                return actionIds.includes(i.integrationId) && i.config.enabled;
                              }).length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - Show on Hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCallClick(contact);
                        }}
                        className="p-1.5 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors duration-200"
                        title="Start Call"
                      >
                        <Phone className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-center text-slate-400 text-sm font-inter">
          {contacts.length} AI assistant{contacts.length !== 1 ? 's' : ''} available
        </p>
      </div>
    </div>
  );
}