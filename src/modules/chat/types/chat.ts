import { DocumentInfo } from '../../fileManagement/types/documents';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  contactId: string;
  attachments?: DocumentInfo[];
}

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  currentContact: string | null;
}

export interface ChatConfig {
  maxMessages: number;
  autoSave: boolean;
  enableAttachments: boolean;
} 