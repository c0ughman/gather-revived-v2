import type { IntegrationInstance } from './types/integrations';

export interface AIContact {
  id: string;
  name: string;
  initials: string;
  color: string;
  description: string;
  status: 'online' | 'busy' | 'offline';
  lastSeen?: string;
  voice?: string; // Voice for text-to-speech in calls
  avatar?: string; // URL or base64 data for profile image
  integrations?: IntegrationInstance[];
  documents?: DocumentInfo[];
}

export interface DataFetchingConfig {
  enabled: boolean;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  lastFetched?: Date;
  lastData?: any;
  description: string; // What this data is for
}

export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  content: string;
  summary?: string;
  extractedText?: string; // For binary files like PDF, DOCX
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    slideCount?: number;
    author?: string;
    title?: string;
    extractionQuality?: 'excellent' | 'good' | 'partial' | 'poor';
    extractionSuccess?: boolean;
  };
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  contactId: string;
  attachments?: DocumentInfo[];
}

export interface CallState {
  isActive: boolean;
  duration: number;
  isMuted: boolean;
  status: 'connecting' | 'connected' | 'ended';
}

export type Screen = 'dashboard' | 'chat' | 'call' | 'settings';

// Re-export integration types
export type { Integration, IntegrationConfig, IntegrationInstance, IntegrationField } from './types/integrations';