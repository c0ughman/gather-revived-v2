import { AIContact } from '../types';

// Remove default contacts - users will create their own after authentication
export const defaultContacts: AIContact[] = [];

// Export contactsData as an alias for defaultContacts to maintain compatibility
export const contactsData = defaultContacts;