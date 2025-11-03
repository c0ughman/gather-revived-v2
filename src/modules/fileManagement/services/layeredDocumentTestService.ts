/**
 * Layered Document Test Service
 * 
 * Testing interface for the layered document processing system.
 * Use this to test and preview the 3-layer document processing before full integration.
 */

import { DocumentInfo } from '../types/documents';
import { layeredDocumentService, LayeredProcessingResult } from './layeredDocumentService';

export interface DocumentProcessingTest {
  document: DocumentInfo;
  result?: LayeredProcessingResult;
  error?: string;
  processingTime?: number;
}

class LayeredDocumentTestService {
  
  /**
   * Process a document and return detailed results for testing
   */
  async testDocumentProcessing(document: DocumentInfo): Promise<DocumentProcessingTest> {
    console.log(`🧪 Testing layered processing for: ${document.name}`);
    
    const startTime = Date.now();
    const test: DocumentProcessingTest = { document };
    
    try {
      // Process the document
      const result = await layeredDocumentService.processDocumentLayers(document);
      
      test.result = result;
      test.processingTime = Date.now() - startTime;
      
      console.log(`✅ Test completed for ${document.name} in ${test.processingTime}ms`);
      
      // Log detailed results for debugging
      this.logProcessingResults(document, result);
      
      return test;
      
    } catch (error) {
      test.error = error instanceof Error ? error.message : String(error);
      test.processingTime = Date.now() - startTime;
      
      console.error(`❌ Test failed for ${document.name}:`, error);
      return test;
    }
  }

  /**
   * Process multiple documents for testing
   */
  async testMultipleDocuments(documents: DocumentInfo[]): Promise<DocumentProcessingTest[]> {
    console.log(`🧪 Testing layered processing for ${documents.length} documents`);
    
    const results = await Promise.all(
      documents.map(doc => this.testDocumentProcessing(doc))
    );
    
    // Log summary
    const successful = results.filter(r => !r.error).length;
    const failed = results.length - successful;
    
    console.log(`📊 Test Summary: ${successful} successful, ${failed} failed`);
    
    return results;
  }

  /**
   * Create a formatted test report for UI display
   */
  formatTestReport(test: DocumentProcessingTest): string {
    const { document, result, error, processingTime } = test;
    
    let report = `=== LAYERED PROCESSING TEST: ${document.name} ===\n\n`;
    
    // Document info
    report += `📄 DOCUMENT INFO:\n`;
    report += `- Name: ${document.name}\n`;
    report += `- Type: ${document.type}\n`;
    report += `- Size: ${this.formatFileSize(document.size)}\n`;
    report += `- Processing Time: ${processingTime || 0}ms\n\n`;
    
    if (error) {
      report += `❌ ERROR: ${error}\n`;
      return report;
    }
    
    if (!result) {
      report += `⚠️ No results available\n`;
      return report;
    }
    
    // Processing strategy
    report += `🔧 PROCESSING STRATEGY: ${result.processing_strategy.toUpperCase()}\n`;
    report += `📊 Estimated Tokens: ${result.estimated_tokens}\n\n`;
    
    // Layer 1 - Summary
    report += `📋 LAYER 1 - SUMMARY (~500 tokens):\n`;
    report += `${this.truncateForDisplay(result.layer1_summary, 500)}\n\n`;
    
    // Layer 1 - Word Bank  
    report += `🏷️ LAYER 1 - WORD BANK (~200 tokens):\n`;
    report += `${this.truncateForDisplay(result.layer1_word_bank, 300)}\n\n`;
    
    // Layer 2 - Facts or Full Content
    const layer2Title = result.processing_strategy === 'small_document' 
      ? 'LAYER 2 - FULL CONTENT (Small Document)' 
      : 'LAYER 2 - COMPREHENSIVE FACTS (~2000 tokens)';
    
    report += `📚 ${layer2Title}:\n`;
    report += `${this.truncateForDisplay(result.layer2_summary, 1000)}\n\n`;
    
    // Layer 3 - Full Text (only for large documents)
    if (result.layer3_full_text) {
      report += `📖 LAYER 3 - FULL TEXT (Large Document):\n`;
      report += `${this.truncateForDisplay(result.layer3_full_text, 500)} [Content truncated for display]\n\n`;
    }
    
    return report;
  }

  /**
   * Create a compact summary for multiple test results
   */
  formatMultiTestSummary(tests: DocumentProcessingTest[]): string {
    let summary = `=== LAYERED PROCESSING TEST SUMMARY ===\n\n`;
    
    const successful = tests.filter(t => !t.error);
    const failed = tests.filter(t => t.error);
    
    summary += `📊 OVERVIEW:\n`;
    summary += `- Total Documents: ${tests.length}\n`;
    summary += `- Successful: ${successful.length}\n`;
    summary += `- Failed: ${failed.length}\n`;
    
    if (successful.length > 0) {
      const avgTime = Math.round(
        successful.reduce((sum, t) => sum + (t.processingTime || 0), 0) / successful.length
      );
      summary += `- Average Processing Time: ${avgTime}ms\n`;
    }
    
    summary += `\n`;
    
    // Success details
    if (successful.length > 0) {
      summary += `✅ SUCCESSFUL PROCESSING:\n`;
      successful.forEach(test => {
        const { document, result, processingTime } = test;
        const strategy = result?.processing_strategy || 'unknown';
        const tokens = result?.estimated_tokens || 0;
        
        summary += `- ${document.name} (${strategy}, ${tokens} tokens, ${processingTime}ms)\n`;
      });
      summary += `\n`;
    }
    
    // Failure details
    if (failed.length > 0) {
      summary += `❌ FAILED PROCESSING:\n`;
      failed.forEach(test => {
        summary += `- ${test.document.name}: ${test.error}\n`;
      });
      summary += `\n`;
    }
    
    return summary;
  }

  /**
   * Log processing results for debugging
   */
  private logProcessingResults(document: DocumentInfo, result: LayeredProcessingResult): void {
    console.group(`🔍 Processing Results: ${document.name}`);
    
    console.log(`📊 Strategy: ${result.processing_strategy}`);
    console.log(`🔢 Estimated Tokens: ${result.estimated_tokens}`);
    
    console.log(`📋 Layer 1 Summary (${result.layer1_summary.length} chars):`, 
      result.layer1_summary.substring(0, 200) + '...');
    
    console.log(`🏷️ Layer 1 Word Bank (${result.layer1_word_bank.length} chars):`, 
      result.layer1_word_bank.substring(0, 100) + '...');
    
    console.log(`📚 Layer 2 Summary (${result.layer2_summary.length} chars):`, 
      result.layer2_summary.substring(0, 200) + '...');
    
    if (result.layer3_full_text) {
      console.log(`📖 Layer 3 Full Text (${result.layer3_full_text.length} chars)`);
    }
    
    console.groupEnd();
  }

  /**
   * Helper: Truncate text for display
   */
  private truncateForDisplay(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + `... [${text.length - maxLength} more characters]`;
  }

  /**
   * Helper: Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create a sample document for testing
   */
  createSampleDocument(content: string, name: string = 'sample-document.txt'): DocumentInfo {
    const now = new Date();
    
    return {
      id: `sample-${Date.now()}`,
      name,
      type: 'text/plain',
      size: content.length,
      uploadedAt: now,
      content,
      extractedText: content,
      layered_processing_complete: false
    };
  }

  /**
   * Test with sample content
   */
  async runSampleTest(): Promise<DocumentProcessingTest[]> {
    console.log('🧪 Running sample layered document processing test');
    
    // Create sample documents of different sizes
    const shortDoc = this.createSampleDocument(
      'This is a short document for testing. It contains basic information about our system. The document should be processed as a small document since it is under 2000 tokens.',
      'short-sample.txt'
    );
    
    const mediumDoc = this.createSampleDocument(
      `This is a medium-length document designed to test the layered processing system. 
      
      ## Overview
      This document contains multiple sections and detailed information that will help us understand how the AI processes content into different layers.
      
      ## Technical Details
      The system uses a 3-layer approach:
      1. Layer 1: Short summary and word bank (always in context)
      2. Layer 2: Comprehensive facts or full content for small docs
      3. Layer 3: Full text for large documents only
      
      ## Implementation Notes
      - Documents under 2000 tokens get full content in Layer 2
      - Documents over 2000 tokens get compressed summaries in Layer 2
      - Layer 3 stores complete text only for large documents
      
      ## Testing Strategy
      We need to verify that the AI can effectively:
      - Generate concise but informative summaries
      - Extract relevant keywords and entities
      - Preserve important factual information in compressed form
      - Handle various document types and structures
      
      This medium document should test the boundary conditions of our system.`.repeat(3),
      'medium-sample.txt'
    );
    
    const largeDoc = this.createSampleDocument(
      `This is a comprehensive large document designed to thoroughly test the layered processing system.
      
      # Executive Summary
      This document provides a detailed analysis of the layered document processing system, its implementation, benefits, and use cases. The system is designed to optimize context usage in AI applications by creating multiple layers of document representation.
      
      # Introduction
      In modern AI applications, context management is crucial for performance and cost optimization. Traditional approaches often include entire documents in context, leading to token waste and slower processing. Our layered approach addresses these challenges.
      
      # System Architecture
      
      ## Core Components
      1. Document Processing Engine: Handles initial document ingestion and analysis
      2. AI Layer Generator: Creates summaries and extracts key information
      3. Context Manager: Dynamically decides which layers to include in context
      4. Storage System: Efficiently stores layered representations
      
      ## Processing Pipeline
      The system follows a structured pipeline:
      1. Document upload and content extraction
      2. Token estimation and strategy selection  
      3. AI-powered layer generation
      4. Storage in structured format
      5. Dynamic retrieval based on query needs
      
      # Layer Specifications
      
      ## Layer 1: Always-Available Context
      - Short Summary: ~500 tokens providing gestalt overview
      - Word Bank: ~200 tokens with entities, keywords, concepts
      - Purpose: Lightweight context always included in AI requests
      - Benefits: Consistent awareness without heavy token usage
      
      ## Layer 2: Detailed Context  
      - Comprehensive Facts: ~2000 tokens for large documents
      - Full Content: Complete text for small documents (≤2000 tokens)
      - Purpose: Detailed information when shallow context insufficient
      - Benefits: Rich context without including massive documents
      
      ## Layer 3: Complete Context
      - Full Document Text: Complete original content
      - Usage: Only when maximum detail required
      - Limitations: Maximum 2 documents in Layer 3 context simultaneously
      - Benefits: Complete accuracy for complex queries
      
      # Implementation Details
      
      ## Document Classification
      Documents are classified based on estimated token count:
      - Small Documents (≤2000 tokens): Layer 2 contains full content
      - Large Documents (>2000 tokens): Layer 2 contains compressed summary
      
      ## AI Processing Prompts
      Each layer uses specialized prompts optimized for its purpose:
      
      ### Summary Generation
      - Focus on main themes and key insights
      - Maintain clarity and conciseness
      - Preserve essential information
      
      ### Word Bank Creation
      - Extract entities (people, places, organizations)
      - Identify technical terms and concepts
      - Include frequently mentioned keywords
      
      ### Fact Compression
      - Preserve all important factual information
      - Maintain logical structure where possible
      - Eliminate redundancy while keeping substance
      
      # Benefits and Use Cases
      
      ## Performance Benefits
      1. Reduced Token Usage: Significant savings on API costs
      2. Faster Processing: Smaller context means faster AI responses
      3. Better Focus: AI gets relevant information without noise
      4. Scalable: Handles large document collections efficiently
      
      ## Use Cases
      1. Customer Support: Quick access to relevant documentation
      2. Research Analysis: Efficient processing of research papers
      3. Legal Documents: Structured access to contracts and agreements
      4. Technical Documentation: Layered access to code documentation
      5. Educational Content: Structured learning material processing
      
      # Technical Implementation
      
      ## Frontend Components
      - LayeredDocumentService: Core processing logic
      - DocumentContextExpansionService: Dynamic context management
      - Integration with existing document upload flow
      
      ## Backend Components
      - AI Service: Gemini API integration for layer generation
      - Database Schema: Storage for layered document data
      - Processing Pipeline: Automated document processing
      
      ## Database Design
      New columns added to agent_documents table:
      - layer1_summary: Short overview text
      - layer1_word_bank: Keywords and entities
      - layer2_summary: Comprehensive facts or full content
      - layer3_full_text: Complete document (large docs only)
      - layered_processing_complete: Processing status flag
      - estimated_tokens: Token count for processing decisions
      
      # Quality Assurance
      
      ## Testing Strategy
      1. Unit Tests: Individual layer generation functions
      2. Integration Tests: Complete processing pipeline
      3. Performance Tests: Token usage and processing time
      4. Quality Tests: Summary accuracy and completeness
      
      ## Metrics and Monitoring
      - Processing time per document
      - Token usage reduction percentage
      - Summary quality scores
      - Context expansion frequency
      - User satisfaction metrics
      
      # Future Enhancements
      
      ## Planned Features
      1. Adaptive Layer Sizes: Dynamic token allocation based on content
      2. Semantic Chunking: Intelligent document segmentation
      3. Cross-Document Linking: References between related documents
      4. Version Control: Track changes in document layers
      5. Batch Processing: Efficient processing of document collections
      
      ## Research Areas
      1. Optimal Token Distribution: Research on ideal layer sizes
      2. Context Switching Strategies: When to expand or contract context
      3. Quality Metrics: Automated evaluation of layer quality
      4. Domain Adaptation: Specialized processing for different content types
      
      # Conclusion
      
      The layered document processing system represents a significant advancement in AI context management. By providing structured, hierarchical access to document information, we can achieve both performance and quality improvements.
      
      The system's flexibility allows it to handle various document types and sizes while maintaining efficiency. The three-layer approach provides the right balance between always-available context and detailed information access.
      
      Implementation results show promising improvements in token efficiency, processing speed, and response quality. The system is ready for production deployment and continued enhancement based on user feedback and usage patterns.
      
      This comprehensive approach to document processing sets a new standard for AI-powered information systems and provides a solid foundation for future developments in intelligent document management.`.repeat(2),
      'large-sample.txt'
    );
    
    // Test all three documents
    return await this.testMultipleDocuments([shortDoc, mediumDoc, largeDoc]);
  }
}

export const layeredDocumentTestService = new LayeredDocumentTestService();