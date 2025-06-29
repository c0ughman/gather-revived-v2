import React, { useState } from 'react';
import { MessageCircle, Phone, Users, Search, Home, Plus } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { useAuth } from '../../auth/hooks/useAuth';
import { SubscriptionBadge } from '../../payments';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

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

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filters = ['All', 'Online', 'Favorites', 'Groups'];

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
              <div className="flex items-center space-x-2">
                <p className="text-xs text-slate-400">Welcome, {user?.email?.split('@')[0]}</p>
                <SubscriptionBadge />
              </div>
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
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="px-4 py-3 hover:bg-slate-700 transition-colors duration-200 cursor-pointer group"
                onClick={() => onChatClick(contact)}
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
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
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-800 ${getStatusColor(contact.status)}`}></div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-medium truncate font-inter">{contact.name}</h3>
                      <span className="text-xs text-slate-400 font-inter">{contact.lastSeen}</span>
                    </div>
                    <p className="text-slate-400 text-sm truncate mt-0.5 font-inter">
                      {contact.description.length > 40 
                        ? `${contact.description.substring(0, 40)}...` 
                        : contact.description
                      }
                    </p>
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
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-center text-slate-400 text-sm font-inter">
          {contacts.filter(c => c.status === 'online').length} AI assistants online
        </p>
      </div>
    </div>
  );
}