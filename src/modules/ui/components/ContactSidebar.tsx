import React, { useState } from 'react';
import { Plus, Settings, MessageSquare, Phone, FileText, Zap, Search, Filter } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { supabaseService } from '../../database/services/supabaseService';
import type { UserAgent } from '../../database/types/database';

interface ContactSidebarProps {
  agents: UserAgent[];
  selectedAgent: UserAgent | null;
  onAgentSelect: (agent: UserAgent) => void;
  onAgentUpdate: () => void;
  activeView: 'chat' | 'call' | 'settings' | 'integrations' | 'documents';
  onViewChange: (view: 'chat' | 'call' | 'settings' | 'integrations' | 'documents') => void;
}

export function ContactSidebar({ 
  agents, 
  selectedAgent, 
  onAgentSelect, 
  onAgentUpdate,
  activeView,
  onViewChange 
}: ContactSidebarProps) {
  const { user, signOut } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'busy' | 'offline'>('all');
  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    initials: '',
    color: '#3b82f6'
  });

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || agent.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await supabaseService.createUserAgent({
        user_id: user.id,
        name: newAgent.name,
        description: newAgent.description,
        initials: newAgent.initials,
        color: newAgent.color
      });

      setNewAgent({ name: '', description: '', initials: '', color: '#3b82f6' });
      setShowCreateForm(false);
      onAgentUpdate();
    } catch (error) {
      console.error('Error creating agent:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-green-500';
    }
  };

  const navigationItems = [
    { id: 'chat', icon: MessageSquare, label: 'Chat', active: activeView === 'chat' },
    { id: 'call', icon: Phone, label: 'Call', active: activeView === 'call' },
    { id: 'documents', icon: FileText, label: 'Documents', active: activeView === 'documents' },
    { id: 'integrations', icon: Zap, label: 'Integrations', active: activeView === 'integrations' },
    { id: 'settings', icon: Settings, label: 'Settings', active: activeView === 'settings' }
  ];

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Agents</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as any)}
              className={`flex flex-col items-center p-3 rounded-lg transition-colors ${
                item.active
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Agents List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAgents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onAgentSelect(agent)}
            className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
              selectedAgent?.id === agent.id ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.initials}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(agent.status || 'online')}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{agent.name}</h3>
                <p className="text-sm text-gray-500 truncate">{agent.description}</p>
                <div className="flex items-center space-x-4 mt-1">
                  <span className="text-xs text-gray-400">
                    {agent.total_conversations || 0} conversations
                  </span>
                  <span className="text-xs text-gray-400">
                    {agent.last_seen || 'now'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredAgents.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No agents found</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchTerm ? 'Try adjusting your search' : 'Create your first agent to get started'}
            </p>
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
              <p className="text-xs text-gray-500">Free Plan</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Create Agent Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Create New Agent</h2>
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  required
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initials
                </label>
                <input
                  type="text"
                  required
                  maxLength={3}
                  value={newAgent.initials}
                  onChange={(e) => setNewAgent({ ...newAgent, initials: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  type="color"
                  value={newAgent.color}
                  onChange={(e) => setNewAgent({ ...newAgent, color: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}