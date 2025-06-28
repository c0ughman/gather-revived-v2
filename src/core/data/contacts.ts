import { AIContact } from '../types/types';
import { supabaseService } from '../../modules/database/services/supabaseService';

// Mock contacts for development/fallback
export const mockContacts: AIContact[] = [
  {
    id: '1',
    name: 'Research Assistant',
    description: 'Helps with research, analysis, and data gathering across multiple sources.',
    initials: 'RA',
    color: '#3b82f6',
    status: 'online',
    lastSeen: 'now',
    voice: 'Puck'
  },
  {
    id: '2', 
    name: 'Creative Director',
    description: 'Assists with creative projects, brainstorming, and content creation.',
    initials: 'CD',
    color: '#8b5cf6',
    status: 'online',
    lastSeen: '2 min ago',
    voice: 'Kore'
  },
  {
    id: '3',
    name: 'Data Analyst',
    description: 'Specializes in data analysis, visualization, and statistical insights.',
    initials: 'DA', 
    color: '#10b981',
    status: 'busy',
    lastSeen: '5 min ago',
    voice: 'Charon'
  },
  {
    id: '4',
    name: 'Project Manager',
    description: 'Helps organize tasks, manage timelines, and coordinate projects.',
    initials: 'PM',
    color: '#f59e0b',
    status: 'offline',
    lastSeen: '1 hour ago',
    voice: 'Aoede'
  }
];

// Service to load contacts from database
export class ContactsService {
  private static instance: ContactsService;
  
  static getInstance(): ContactsService {
    if (!ContactsService.instance) {
      ContactsService.instance = new ContactsService();
    }
    return ContactsService.instance;
  }

  async loadUserContacts(userId: string): Promise<AIContact[]> {
    try {
      console.log('📱 Loading contacts for user:', userId);
      
      // Get user agents from database
      const agents = await supabaseService.getUserAgents(userId);
      
      if (!agents || agents.length === 0) {
        console.log('📱 No agents found, returning mock contacts for development');
        return mockContacts;
      }

      // Transform database agents to AIContact format
      const contacts: AIContact[] = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        initials: agent.initials,
        color: agent.color,
        status: agent.status as 'online' | 'busy' | 'offline',
        lastSeen: this.formatLastSeen(agent.last_used_at, agent.last_seen),
        voice: agent.voice || 'Puck',
        avatar: agent.avatar_url || undefined,
        integrations: [], // TODO: Load integrations
        documents: [] // TODO: Load documents
      }));

      console.log('✅ Loaded', contacts.length, 'contacts from database');
      return contacts;
    } catch (error) {
      console.error('❌ Error loading contacts:', error);
      console.log('📱 Falling back to mock contacts');
      return mockContacts;
    }
  }

  async saveContact(userId: string, contact: AIContact): Promise<AIContact> {
    try {
      console.log('💾 Saving contact:', contact.name);
      
      const agentData = {
        user_id: userId,
        name: contact.name,
        description: contact.description,
        initials: contact.initials,
        color: contact.color,
        voice: contact.voice || 'Puck',
        avatar_url: contact.avatar || null,
        status: contact.status,
        last_seen: contact.lastSeen
      };

      let savedAgent;
      
      if (contact.id && contact.id !== 'new') {
        // Update existing agent
        savedAgent = await supabaseService.updateUserAgent(contact.id, agentData);
      } else {
        // Create new agent
        savedAgent = await supabaseService.createUserAgent(agentData);
      }

      console.log('✅ Contact saved successfully');
      
      return {
        ...contact,
        id: savedAgent.id
      };
    } catch (error) {
      console.error('❌ Error saving contact:', error);
      throw error;
    }
  }

  async deleteContact(contactId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting contact:', contactId);
      
      await supabaseService.deleteUserAgent(contactId);
      
      console.log('✅ Contact deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting contact:', error);
      throw error;
    }
  }

  private formatLastSeen(lastUsedAt: string | null, lastSeen: string | null): string {
    if (!lastUsedAt && !lastSeen) {
      return 'never';
    }

    if (lastSeen === 'now') {
      return 'now';
    }

    if (lastUsedAt) {
      const lastUsed = new Date(lastUsedAt);
      const now = new Date();
      const diffMs = now.getTime() - lastUsed.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    return lastSeen || 'unknown';
  }
}

export const contactsService = ContactsService.getInstance();

// Export function to load contacts (for backward compatibility)
export async function loadUserContacts(userId: string): Promise<AIContact[]> {
  return contactsService.loadUserContacts(userId);
}