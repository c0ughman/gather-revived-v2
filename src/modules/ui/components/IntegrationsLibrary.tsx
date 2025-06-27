import React, { useState } from 'react';
import { Search, Filter, Globe, Rss, Newspaper, Cloud, TrendingUp, Calendar, Building2, ExternalLink, Zap, Database } from 'lucide-react';
import { Integration } from '../../integrations/types/integrations';
import { allIntegrations } from '../../integrations/data/integrations';

interface IntegrationsLibraryProps {
  onSelectIntegration?: (integration: Integration) => void;
  selectedIntegrations?: string[];
  className?: string;
}

const iconMap = {
  Globe,
  Rss,
  Newspaper,
  Cloud,
  TrendingUp,
  Calendar,
  Building2,
  Zap,
  Database
};

export default function IntegrationsLibrary({ onSelectIntegration, selectedIntegrations = [], className = '' }: IntegrationsLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'source' | 'action'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');

  const filteredIntegrations = allIntegrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    const matchesTag = !selectedTag || integration.tags.includes(selectedTag);
    
    return matchesSearch && matchesCategory && matchesTag;
  });

  const allTags = Array.from(new Set(allIntegrations.flatMap(integration => integration.tags))).sort();

  const handleIntegrationClick = (integration: Integration) => {
    if (onSelectIntegration) {
      onSelectIntegration(integration);
    }
  };

  const isSelected = (integrationId: string) => selectedIntegrations.includes(integrationId);

  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Integrations Library</h2>
            <p className="text-slate-400 text-xs">Connect to external data sources and enable actions</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <Database className="w-4 h-4" />
            <span>{filteredIntegrations.length}</span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200 text-sm"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as 'all' | 'source' | 'action')}
                className="bg-slate-700 text-white px-2 py-1 rounded text-xs border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="source">Data Sources</option>
                <option value="action">Actions</option>
              </select>
            </div>

            {/* Tag Filter */}
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-slate-700 text-white px-2 py-1 rounded text-xs border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>

            {/* Clear Filters */}
            {(searchQuery || selectedCategory !== 'all' || selectedTag) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedTag('');
                }}
                className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors duration-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {filteredIntegrations.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No integrations found</p>
            <p className="text-slate-500 text-xs">Try adjusting your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIntegrations.map((integration) => {
              const IconComponent = iconMap[integration.icon as keyof typeof iconMap] || Database;
              const selected = isSelected(integration.id);
              
              return (
                <div
                  key={integration.id}
                  onClick={() => handleIntegrationClick(integration)}
                  className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer group ${
                    selected
                      ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                      : 'border-slate-600 hover:border-slate-500 bg-slate-700 hover:bg-slate-650'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <div
                        className="p-1.5 rounded flex-shrink-0"
                        style={{ backgroundColor: integration.color + '20', color: integration.color }}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white text-sm group-hover:text-blue-300 transition-colors duration-200 truncate">
                          {integration.name}
                        </h3>
                        <div className="flex items-center space-x-1 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            integration.category === 'source' 
                              ? 'bg-green-900 text-green-300' 
                              : 'bg-purple-900 text-purple-300'
                          }`}>
                            {integration.category === 'source' ? 'Source' : 'Action'}
                          </span>
                          {!integration.requiresApiKey && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-900 text-blue-300">
                              No API Key
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {selected && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-slate-300 text-xs mb-2 line-clamp-2">
                    {integration.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {integration.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-1.5 py-0.5 bg-slate-600 text-slate-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {integration.tags.length > 3 && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-600 text-slate-300 rounded">
                        +{integration.tags.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Examples */}
                  <div className="text-xs text-slate-400">
                    <p className="font-medium mb-1">Examples:</p>
                    <ul className="space-y-0.5">
                      {integration.examples.slice(0, 2).map((example, index) => (
                        <li key={index} className="flex items-center space-x-1">
                          <span className="w-1 h-1 bg-slate-500 rounded-full flex-shrink-0"></span>
                          <span className="truncate">{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Indicator */}
                  <div className="mt-2 pt-2 border-t border-slate-600 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {integration.fields.length} field{integration.fields.length !== 1 ? 's' : ''}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors duration-200" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}