/**
 * Token counting and validation utilities for memory management system
 */

// Simple token estimation based on character count
// This is an approximation - 1 token ≈ 4 characters for most text
const CHARS_PER_TOKEN = 4;

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  
  // Remove extra whitespace and normalize
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  
  // Estimate tokens (rough approximation)
  return Math.ceil(normalizedText.length / CHARS_PER_TOKEN);
}

export function validateTokenLimit(text: string, maxTokens: number): {
  isValid: boolean;
  currentTokens: number;
  maxTokens: number;
  remainingTokens: number;
} {
  const currentTokens = estimateTokenCount(text);
  const remainingTokens = Math.max(0, maxTokens - currentTokens);
  
  return {
    isValid: currentTokens <= maxTokens,
    currentTokens,
    maxTokens,
    remainingTokens
  };
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const validation = validateTokenLimit(text, maxTokens);
  
  if (validation.isValid) {
    return text;
  }
  
  // Truncate text to fit within token limit
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const truncated = text.substring(0, maxChars);
  
  // Try to break at a word boundary to avoid cutting words in half
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  if (lastSpaceIndex > maxChars * 0.8) {
    return truncated.substring(0, lastSpaceIndex);
  }
  
  return truncated;
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

// Memory management constants - Updated to match new token limits
export const MEMORY_LIMITS = {
  // New token-based limits - UPDATED to match backend context_limits.py
  AGENT_DESCRIPTION: 4000,           // 4k tokens for agent description
  MEDIUM_TERM_MEMORY: 500,          // 500 tokens for medium term memory (temporarily for testing)
  PAPER_NOTES: 4000,                 // 4k tokens for paper notes context
  CONVERSATION_CONTEXT: 4000,        // 4k tokens for conversation messages
  
  // Document limits - UPDATED to match backend
  DOCUMENT_PER_DOCUMENT: 20000,      // 20k tokens per individual document
  AGENT_DOCUMENTS_MAX_COUNT: 5,      // Max 5 documents per agent (FIXED from 10)
  CONVERSATION_DOCUMENTS_CUMULATIVE: 20000, // 20k tokens cumulative for conversation docs
  
  // Voice system instruction - UPDATED to match backend
  VOICE_SYSTEM_INSTRUCTION: 16000,   // 16k tokens for voice system instruction
  
  // Document layer limits - ADDED from backend
  DOCUMENT_LAYER1_SUMMARY: 600,      // Layer 1 summary max tokens
  DOCUMENT_LAYER1_WORD_BANK: 200,    // Layer 1 word bank max tokens  
  DOCUMENT_LAYER1_TOTAL: 800,        // Total Layer 1 per document
  DOCUMENT_LAYER2_SUMMARY: 2000,     // Layer 2 comprehensive summary
  
  // Legacy limits (kept for backward compatibility)
  DOCUMENT_SUMMARY: 700,
  DOCUMENT_WORD_BANK: 300,
  DOCUMENT_FACTS: 2000,
  DOCUMENT_FULL: 50000,
  TOTAL_SYSTEM_MAX: 200000
} as const;

// Interfaces for new token validation
export interface TokenUsageInfo {
  currentTokens: number;
  maxTokens: number;
  remainingTokens: number;
  overLimit: boolean;
  usagePercentage: number;
}

export interface Message {
  content?: string;
  [key: string]: any;
}

export interface Document {
  extracted_text?: string;
  content?: string;
  summary?: string;
  [key: string]: any;
}

export interface Note {
  content?: string;
  text?: string;
  is_pinned?: boolean;
  [key: string]: any;
}

/**
 * Enhanced token utilities for the new token limits system
 */
export class TokenCounter {
  /**
   * Count total tokens in a list of messages.
   */
  static countTokensInMessages(messages: Message[]): number {
    let totalTokens = 0;
    for (const message of messages) {
      const content = message.content || '';
      if (typeof content === 'string') {
        totalTokens += estimateTokenCount(content);
      }
    }
    return totalTokens;
  }

  /**
   * Count total tokens in a list of documents.
   */
  static countTokensInDocuments(documents: Document[]): number {
    let totalTokens = 0;
    for (const doc of documents) {
      const content = doc.extracted_text || doc.content || doc.summary || '';
      if (typeof content === 'string') {
        totalTokens += estimateTokenCount(content);
      }
    }
    return totalTokens;
  }

  /**
   * Count total tokens in a list of notes.
   */
  static countTokensInNotes(notes: Note[]): number {
    let totalTokens = 0;
    for (const note of notes) {
      const content = note.content || note.text || '';
      if (typeof content === 'string') {
        totalTokens += estimateTokenCount(content);
      }
    }
    return totalTokens;
  }

  /**
   * Filter messages to stay within token limit, keeping most recent first.
   */
  static filterMessagesByTokenLimit(
    messages: Message[],
    maxTokens: number,
    reverseChronological: boolean = true
  ): Message[] {
    if (!messages.length) return [];

    const sortedMessages = [...messages];
    if (reverseChronological) {
      sortedMessages.reverse();
    }

    const filteredMessages: Message[] = [];
    let currentTokens = 0;

    for (const message of sortedMessages) {
      const messageTokens = estimateTokenCount(message.content || '');
      if (currentTokens + messageTokens <= maxTokens) {
        filteredMessages.push(message);
        currentTokens += messageTokens;
      } else {
        break; // Stop adding messages once we hit the limit
      }
    }

    if (reverseChronological) {
      filteredMessages.reverse();
    }

    return filteredMessages;
  }

  /**
   * Filter items by token limit, optionally keeping pinned items.
   */
  static filterItemsByTokenLimit<T extends Record<string, any>>(
    items: T[],
    maxTokens: number,
    contentField: string = 'content',
    keepPinned: boolean = false,
    pinnedField: string = 'is_pinned'
  ): { includedItems: T[]; excludedItems: T[] } {
    if (!items.length) {
      return { includedItems: [], excludedItems: [] };
    }

    const includedItems: T[] = [];
    const excludedItems: T[] = [];
    let currentTokens = 0;

    // First pass: Add all pinned items if keepPinned is true
    if (keepPinned) {
      for (const item of items) {
        if (item[pinnedField]) {
          const itemTokens = estimateTokenCount(item[contentField] || '');
          includedItems.push(item);
          currentTokens += itemTokens;
        }
      }
    }

    // Second pass: Add non-pinned items until we hit the limit
    for (const item of items) {
      if (keepPinned && item[pinnedField]) {
        continue; // Skip already included pinned items
      }

      const itemTokens = estimateTokenCount(item[contentField] || '');

      if (currentTokens + itemTokens <= maxTokens) {
        includedItems.push(item);
        currentTokens += itemTokens;
      } else {
        excludedItems.push(item);
      }
    }

    return { includedItems, excludedItems };
  }

  /**
   * Get detailed token usage information.
   */
  static getTokenUsageInfo(text: string, maxTokens: number): TokenUsageInfo {
    const currentTokens = estimateTokenCount(text);
    return {
      currentTokens,
      maxTokens,
      remainingTokens: Math.max(0, maxTokens - currentTokens),
      overLimit: currentTokens > maxTokens,
      usagePercentage: maxTokens > 0 ? Math.min(100, (currentTokens / maxTokens) * 100) : 0
    };
  }

  /**
   * Validate if a document would exceed size limits.
   */
  static validateDocumentTokens(
    content: string,
    maxTokensPerDocument: number
  ): { valid: boolean; error?: string; tokens: number } {
    const tokens = estimateTokenCount(content);
    
    if (tokens > maxTokensPerDocument) {
      return {
        valid: false,
        error: `Document exceeds ${maxTokensPerDocument.toLocaleString()} token limit`,
        tokens
      };
    }
    
    return { valid: true, tokens };
  }

  /**
   * Validate if adding documents would exceed cumulative limits.
   */
  static validateCumulativeDocumentTokens(
    existingDocuments: Document[],
    newDocuments: Document[],
    maxCumulativeTokens: number
  ): { valid: boolean; error?: string; currentTokens: number; newTokens: number } {
    const currentTokens = this.countTokensInDocuments(existingDocuments);
    const newTokens = this.countTokensInDocuments(newDocuments);
    const totalTokens = currentTokens + newTokens;
    
    if (totalTokens > maxCumulativeTokens) {
      return {
        valid: false,
        error: `Total documents would exceed ${maxCumulativeTokens.toLocaleString()} token limit`,
        currentTokens,
        newTokens
      };
    }
    
    return { valid: true, currentTokens, newTokens };
  }

  /**
   * Validate agent document limits (count and individual size).
   */
  static validateAgentDocuments(
    existingDocuments: Document[],
    newDocuments: Document[],
    maxDocuments: number,
    maxTokensPerDocument: number
  ): { valid: boolean; error?: string } {
    // Check document count limit
    if (existingDocuments.length + newDocuments.length > maxDocuments) {
      return {
        valid: false,
        error: `Maximum ${maxDocuments} documents per agent`
      };
    }

    // Check individual document token limits
    for (const doc of newDocuments) {
      const content = doc.extracted_text || doc.content || doc.summary || '';
      const validation = this.validateDocumentTokens(content, maxTokensPerDocument);
      if (!validation.valid) {
        return validation;
      }
    }

    return { valid: true };
  }
}

// Export enhanced functions
export const {
  countTokensInMessages,
  countTokensInDocuments,
  countTokensInNotes,
  filterMessagesByTokenLimit,
  filterItemsByTokenLimit,
  getTokenUsageInfo,
  validateDocumentTokens,
  validateCumulativeDocumentTokens,
  validateAgentDocuments,
} = TokenCounter;