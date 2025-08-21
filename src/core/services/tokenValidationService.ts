import { MEMORY_LIMITS, TokenCounter, validateTokenLimit, estimateTokenCount } from '../utils/tokenUtils';

interface ValidationError {
  valid: false;
  error: string;
  tokens?: number;
  maxTokens?: number;
  currentCount?: number;
  maxCount?: number;
  currentTokens?: number;
  newTokens?: number;
  totalTokens?: number;
}

interface ValidationSuccess {
  valid: true;
}

type ValidationResult = ValidationError | ValidationSuccess;

class TokenValidationService {
  /**
   * Validate agent description against token limits
   */
  validateAgentDescription(description: string): ValidationResult {
    const validation = validateTokenLimit(description, MEMORY_LIMITS.AGENT_DESCRIPTION);
    
    if (!validation.isValid) {
      return {
        valid: false,
        error: `Agent description exceeds ${MEMORY_LIMITS.AGENT_DESCRIPTION.toLocaleString()} token limit`,
        tokens: validation.currentTokens,
        maxTokens: validation.maxTokens
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate individual document token limits
   */
  validateDocumentTokens(content: string): ValidationResult {
    const validation = validateTokenLimit(content, MEMORY_LIMITS.DOCUMENT_PER_DOCUMENT);
    
    if (!validation.isValid) {
      return {
        valid: false,
        error: `Document exceeds ${MEMORY_LIMITS.DOCUMENT_PER_DOCUMENT.toLocaleString()} token limit`,
        tokens: validation.currentTokens,
        maxTokens: validation.maxTokens
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate agent document limits (count + individual tokens)
   */
  validateAgentDocumentLimits(
    existingDocuments: any[],
    newDocuments: any[]
  ): ValidationResult {
    // Check count limit
    const totalCount = existingDocuments.length + newDocuments.length;
    if (totalCount > MEMORY_LIMITS.AGENT_DOCUMENTS_MAX_COUNT) {
      return {
        valid: false,
        error: `Maximum ${MEMORY_LIMITS.AGENT_DOCUMENTS_MAX_COUNT} documents per agent`,
        currentCount: existingDocuments.length,
        maxCount: MEMORY_LIMITS.AGENT_DOCUMENTS_MAX_COUNT
      };
    }
    
    // Check individual document token limits
    for (const doc of newDocuments) {
      const content = this.extractDocumentContent(doc);
      const docValidation = this.validateDocumentTokens(content);
      if (!docValidation.valid) {
        return docValidation;
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Validate conversation document cumulative token limits
   */
  validateConversationDocumentLimits(
    existingDocuments: any[],
    newDocuments: any[]
  ): ValidationResult {
    const currentTokens = TokenCounter.countTokensInDocuments(existingDocuments);
    const newTokens = TokenCounter.countTokensInDocuments(newDocuments);
    const totalTokens = currentTokens + newTokens;
    
    if (totalTokens > MEMORY_LIMITS.CONVERSATION_DOCUMENTS_CUMULATIVE) {
      return {
        valid: false,
        error: `Conversation documents would exceed ${MEMORY_LIMITS.CONVERSATION_DOCUMENTS_CUMULATIVE.toLocaleString()} token limit`,
        currentTokens,
        newTokens,
        totalTokens,
        maxTokens: MEMORY_LIMITS.CONVERSATION_DOCUMENTS_CUMULATIVE
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Extract content from document object for validation
   */
  private extractDocumentContent(document: any): string {
    return document.extractedText || 
           document.extracted_text || 
           document.content || 
           document.summary || 
           '';
  }
  
  /**
   * Format validation error for display
   */
  formatValidationError(error: ValidationError): string {
    return error.error;
  }
  
  /**
   * Get token usage information for display
   */
  getTokenUsageInfo(text: string, maxTokens: number) {
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
   * Validate multiple items at once and return combined result
   */
  validateBatch(validations: (() => ValidationResult)[]): ValidationResult {
    for (const validate of validations) {
      const result = validate();
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  }
}

// Export singleton instance
export const tokenValidationService = new TokenValidationService();