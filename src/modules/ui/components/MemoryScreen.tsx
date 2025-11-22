import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import MemoryManagement from './MemoryManagement';

interface MemoryScreenProps {
  contact: AIContact;
  onBack: () => void;
}

export default function MemoryScreen({ contact, onBack }: MemoryScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div 
      className="h-full flex flex-col rounded-t-[32px] overflow-hidden bg-glass-panel glass-effect border-t border-structural-soft"
      style={{
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05), 0 4px 20px rgba(0, 0, 0, 0.3)',
        backgroundColor: 'rgba(5, 10, 25, 0.4)'
      }}
    >
      {/* Search Bar */}
      <div className="p-4 border-b border-structural">
        <div className="relative max-w-4xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700/30 text-white pl-12 pr-4 py-3 rounded-full focus:outline-none transition-colors duration-200 font-inter"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <MemoryManagement 
          agentId={contact.id} 
          agentName={contact.name}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
}