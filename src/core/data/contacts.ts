import { AIContact } from '../types/types';

// Sample contacts for development/fallback
export const sampleContacts: AIContact[] = [
  {
    id: 'sample_1',
    name: 'AI Assistant',
    description: 'A helpful AI assistant ready to chat',
    initials: 'AI',
    color: '#3b82f6',
    voice: 'Puck',
    status: 'online',
    lastSeen: 'now'
  },
  {
    id: 'sample_2',
    name: 'Research Helper',
    description: 'Specialized in research and analysis',
    initials: 'RH',
    color: '#10b981',
    voice: 'Puck',
    status: 'online',
    lastSeen: 'now'
  }
];

// Remove default contacts - users will create their own after authentication
export const defaultContacts: AIContact[] = [];