/**
 * Layered Document Service
 * 
 * Handles AI-powered processing of documents into 3 layers:
 * - Layer 1: Short summary (~500 tokens) + Word bank (~200 tokens) - Always in context
 * - Layer 2: Comprehensive facts (~2000 tokens) OR full content if ≤2000 tokens
 * - Layer 3: Full document text (only for >2000 token documents)
 */

import { DocumentInfo } from '../types/documents';
import { pythonApiService } from '../../../core/services/pythonApiService';

export interface LayeredProcessingResult {
  layer1_summary: string;
  layer1_word_bank: string;
  layer2_summary: string;
  layer3_full_text?: string;
  estimated_tokens: number;
  processing_strategy: 'small_document' | 'large_document';
}

class LayeredDocumentService {
  
  /**
   * Process a document into layered context representations
   */
  async processDocumentLayers(document: DocumentInfo): Promise<LayeredProcessingResult> {
    console.log(`🔄 Starting layered processing for: ${document.name}`);
    
    try {
      // Get the document content (use extractedText for binary files, content for text files)
      const documentContent = document.extractedText || document.content;
      
      if (!documentContent || documentContent.trim().length === 0) {
        throw new Error('Document has no content to process');
      }

      // Estimate token count (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(documentContent.length / 4);
      console.log(`📊 Estimated tokens for ${document.name}: ${estimatedTokens}`);

      // Determine processing strategy based on token count
      if (estimatedTokens <= 2000) {
        return await this.processSmallDocument(document, documentContent, estimatedTokens);
      } else {
        return await this.processLargeDocument(document, documentContent, estimatedTokens);
      }

    } catch (error) {
      console.error(`❌ Failed to process layers for ${document.name}:`, error);
      throw error;
    }
  }

  /**
   * Process small documents (≤2000 tokens)
   * For small documents, Layer 2 contains the full content
   */
  private async processSmallDocument(
    document: DocumentInfo, 
    content: string, 
    estimatedTokens: number
  ): Promise<LayeredProcessingResult> {
    console.log(`📄 Processing small document: ${document.name} (${estimatedTokens} tokens)`);

    const layer1Summary = await this.generateLayer1Summary(document, content);
    const layer1WordBank = await this.generateLayer1WordBank(document, content);
    
    // For small documents, Layer 2 is the full content
    const layer2Summary = content;

    console.log(`✅ Small document processing complete for: ${document.name}`);

    return {
      layer1_summary: layer1Summary,
      layer1_word_bank: layer1WordBank,
      layer2_summary: layer2Summary,
      estimated_tokens: estimatedTokens,
      processing_strategy: 'small_document'
    };
  }

  /**
   * Process large documents (>2000 tokens)
   * Generate all 3 layers including compressed Layer 2 summary
   */
  private async processLargeDocument(
    document: DocumentInfo, 
    content: string, 
    estimatedTokens: number
  ): Promise<LayeredProcessingResult> {
    console.log(`📚 Processing large document: ${document.name} (${estimatedTokens} tokens)`);

    // Generate all layers for large documents
    const [layer1Summary, layer1WordBank, layer2Summary] = await Promise.all([
      this.generateLayer1Summary(document, content),
      this.generateLayer1WordBank(document, content),
      this.generateLayer2Summary(document, content)
    ]);

    console.log(`✅ Large document processing complete for: ${document.name}`);

    return {
      layer1_summary: layer1Summary,
      layer1_word_bank: layer1WordBank,
      layer2_summary: layer2Summary,
      layer3_full_text: content,
      estimated_tokens: estimatedTokens,
      processing_strategy: 'large_document'
    };
  }

  /**
   * Generate Layer 1 Summary (~500 tokens)
   * Gestalt overview with main themes and key insights
   */
  private async generateLayer1Summary(document: DocumentInfo, content: string): Promise<string> {
    console.log(`🎯 Generating Layer 1 summary for: ${document.name}`);

    const prompt = `Create a concise summary of this document in approximately 500 tokens or less. Focus on:

1. **Main Theme/Purpose**: What is this document fundamentally about?
2. **Key Insights**: The most important ideas, findings, or messages
3. **Context**: Relevant background information that helps understand the document
4. **Practical Relevance**: Why this information matters

Style Guidelines:
- Write clearly and informatively
- Capture the "gestalt" or overall essence
- Include specific details that matter
- Avoid fluff and filler
- Make it standalone readable

Document: ${document.name}
Type: ${document.type}

Content:
${content}

Summary:`;

    try {
      const response = await pythonApiService.generateText(prompt, {
        max_tokens: 600, // Allow some buffer over 500 tokens
        temperature: 0.3 // Lower temperature for consistent summaries
      });

      console.log(`✅ Layer 1 summary generated for: ${document.name} (${response.length} chars)`);
      return response.trim();

    } catch (error) {
      console.error(`❌ Failed to generate Layer 1 summary for ${document.name}:`, error);
      // Fallback to truncated content
      return content.substring(0, 2000) + (content.length > 2000 ? '\n[Summary generation failed - showing truncated content]' : '');
    }
  }

  /**
   * Generate Layer 1 Word Bank (~200 tokens)
   * Extract entities, keywords, and key concepts
   */
  private async generateLayer1WordBank(document: DocumentInfo, content: string): Promise<string> {
    console.log(`🏷️ Generating Layer 1 word bank for: ${document.name}`);

    const prompt = `Extract a comprehensive word bank from this document. Include:

**ENTITIES** (People, Places, Organizations):
- Names of people mentioned
- Geographic locations  
- Companies, institutions, brands
- Specific products or services

**CONCEPTS** (Topics, Technologies, Ideas):
- Technical terms and jargon
- Key topics and themes
- Methodologies or approaches
- Important concepts explained

**KEYWORDS** (Repeated Important Terms):
- Domain-specific vocabulary
- Frequently mentioned terms
- Acronyms and abbreviations
- Process names or systems

Format as a clean, organized list. Keep it concise (~200 tokens total). Only include terms that are genuinely important to understanding this document.

Document: ${document.name}

Content:
${content}

Word Bank:`;

    try {
      const response = await pythonApiService.generateText(prompt, {
        max_tokens: 300, // Allow buffer over 200 tokens
        temperature: 0.2 // Very consistent for keyword extraction
      });

      console.log(`✅ Layer 1 word bank generated for: ${document.name} (${response.length} chars)`);
      return response.trim();

    } catch (error) {
      console.error(`❌ Failed to generate Layer 1 word bank for ${document.name}:`, error);
      // Fallback to simple keyword extraction
      const words = content.split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 50);
      return `Keywords: ${words.join(', ')}\n[Automated extraction - AI processing failed]`;
    }
  }

  /**
   * Generate Layer 2 Summary (~2000 tokens)
   * Comprehensive factual condensation for large documents
   */
  private async generateLayer2Summary(document: DocumentInfo, content: string): Promise<string> {
    console.log(`📋 Generating Layer 2 summary for: ${document.name}`);

    const prompt = `Create a comprehensive factual summary of this document in approximately 2000 tokens. This should be a detailed condensation that:

1. **Preserves All Important Information**: Include key facts, figures, processes, and details
2. **Maintains Logical Structure**: Follow the document's organization where possible
3. **Emphasizes Factual Content**: Focus on concrete information over opinions
4. **Includes Specifics**: Names, dates, numbers, procedures, and technical details
5. **Minimizes Redundancy**: Eliminate repetition and fluff while keeping substance

This summary should allow someone to understand the document's content in detail without needing the full text. Think of it as a detailed executive summary that captures the essence and specifics.

Document: ${document.name}
Type: ${document.type}

Content:
${content}

Detailed Summary:`;

    try {
      const response = await pythonApiService.generateText(prompt, {
        max_tokens: 2400, // Allow buffer over 2000 tokens
        temperature: 0.2 // Consistent factual summarization
      });

      console.log(`✅ Layer 2 summary generated for: ${document.name} (${response.length} chars)`);
      return response.trim();

    } catch (error) {
      console.error(`❌ Failed to generate Layer 2 summary for ${document.name}:`, error);
      // Fallback to truncated content
      return content.substring(0, 8000) + (content.length > 8000 ? '\n[Detailed summary generation failed - showing truncated content]' : '');
    }
  }

  /**
   * Check if a document needs layered processing
   */
  needsLayeredProcessing(document: DocumentInfo): boolean {
    return !document.layered_processing_complete;
  }

  /**
   * Get processing status for UI/debugging
   */
  getProcessingStatus(document: DocumentInfo): string {
    if (document.layered_processing_complete) {
      return `Processed (${document.estimated_tokens || 'unknown'} tokens, ${document.estimated_tokens && document.estimated_tokens <= 2000 ? 'small' : 'large'} document)`;
    }
    return 'Pending layered processing';
  }

  /**
   * Estimate if document will be processed as small or large
   */
  estimateProcessingType(document: DocumentInfo): 'small' | 'large' | 'unknown' {
    const content = document.extractedText || document.content;
    if (!content) return 'unknown';
    
    const estimatedTokens = Math.ceil(content.length / 4);
    return estimatedTokens <= 2000 ? 'small' : 'large';
  }
}

export const layeredDocumentService = new LayeredDocumentService();