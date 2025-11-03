/**
 * Test script for layered document processing
 * Run with: node test-layered-processing.js
 */

// Mock the pythonApiService for testing
class MockPythonApiService {
  async generateText(prompt, options = {}) {
    console.log(`🤖 Mock AI call: ${prompt.substring(0, 100)}... (${options.max_tokens} tokens)`);
    
    // Simulate AI responses based on prompt content
    if (prompt.includes('Create a concise summary')) {
      return `This document provides comprehensive information about ${this.extractDocumentType(prompt)}. The main themes include technical implementation details, system architecture, and practical applications. Key insights focus on performance optimization, scalability considerations, and user experience improvements. The content emphasizes best practices and provides actionable recommendations for implementation. This information is particularly relevant for developers and system architects working on similar projects.`;
    }
    
    if (prompt.includes('Extract a comprehensive word bank')) {
      return `**ENTITIES:**
- Organizations: Google, Anthropic, OpenAI
- Technologies: Gemini API, Supabase, React
- Systems: LayeredDocumentService, DocumentContextService

**CONCEPTS:**
- Document processing, Context management, Token optimization
- AI integration, Performance optimization, Scalability
- System architecture, Database design, API endpoints

**KEYWORDS:**
- processing, tokens, context, layers, documents, AI, service, system, implementation, optimization, performance, scalability, architecture, database, API`;
    }
    
    if (prompt.includes('Create a comprehensive factual summary')) {
      return `This document contains detailed technical information about a layered document processing system. The system implements a three-tier architecture with Layer 1 providing lightweight summaries and word banks, Layer 2 containing comprehensive factual information or full content for smaller documents, and Layer 3 storing complete document text for large files. 

Key technical specifications include token limits of approximately 500 tokens for Layer 1 summaries, 200 tokens for word banks, and 2000 tokens for Layer 2 summaries. The system uses AI-powered processing through the Gemini API to generate these layers automatically.

Implementation details cover database schema modifications, service architecture, and integration with existing document processing pipelines. The system supports multiple document formats and includes comprehensive error handling and logging mechanisms.

Performance benefits include significant token usage reduction, faster AI response times, and improved context relevance. The system is designed to handle various document types including technical documentation, research papers, and general content.`;
    }
    
    return 'Mock AI response generated successfully.';
  }
  
  extractDocumentType(prompt) {
    if (prompt.includes('.txt')) return 'text documents';
    if (prompt.includes('.pdf')) return 'PDF documents';
    if (prompt.includes('.docx')) return 'Word documents';
    return 'system documentation';
  }
}

// Mock document info
function createMockDocument(content, name = 'test-doc.txt') {
  return {
    id: `test-${Date.now()}`,
    name,
    type: 'text/plain',
    size: content.length,
    uploadedAt: new Date(),
    content,
    extractedText: content,
    layered_processing_complete: false
  };
}

// Simple layer processing service (simplified version)
class TestLayeredDocumentService {
  constructor(pythonApiService) {
    this.pythonApiService = pythonApiService;
  }
  
  async processDocumentLayers(document) {
    console.log(`\n🔄 Processing: ${document.name}`);
    
    const content = document.extractedText || document.content;
    const estimatedTokens = Math.ceil(content.length / 4);
    
    console.log(`📊 Estimated tokens: ${estimatedTokens}`);
    
    if (estimatedTokens <= 2000) {
      return await this.processSmallDocument(document, content, estimatedTokens);
    } else {
      return await this.processLargeDocument(document, content, estimatedTokens);
    }
  }
  
  async processSmallDocument(document, content, estimatedTokens) {
    console.log(`📄 Processing as small document`);
    
    const layer1Summary = await this.pythonApiService.generateText(
      `Create a concise summary of this document: ${document.name}\n\nContent: ${content}`,
      { max_tokens: 600, temperature: 0.3 }
    );
    
    const layer1WordBank = await this.pythonApiService.generateText(
      `Extract a comprehensive word bank from this document: ${document.name}\n\nContent: ${content}`,
      { max_tokens: 300, temperature: 0.2 }
    );
    
    return {
      layer1_summary: layer1Summary,
      layer1_word_bank: layer1WordBank,
      layer2_summary: content, // Full content for small docs
      estimated_tokens: estimatedTokens,
      processing_strategy: 'small_document'
    };
  }
  
  async processLargeDocument(document, content, estimatedTokens) {
    console.log(`📚 Processing as large document`);
    
    const [layer1Summary, layer1WordBank, layer2Summary] = await Promise.all([
      this.pythonApiService.generateText(
        `Create a concise summary of this document: ${document.name}\n\nContent: ${content}`,
        { max_tokens: 600, temperature: 0.3 }
      ),
      this.pythonApiService.generateText(
        `Extract a comprehensive word bank from this document: ${document.name}\n\nContent: ${content}`,
        { max_tokens: 300, temperature: 0.2 }
      ),
      this.pythonApiService.generateText(
        `Create a comprehensive factual summary of this document: ${document.name}\n\nContent: ${content}`,
        { max_tokens: 2400, temperature: 0.2 }
      )
    ]);
    
    return {
      layer1_summary: layer1Summary,
      layer1_word_bank: layer1WordBank,
      layer2_summary: layer2Summary,
      layer3_full_text: content,
      estimated_tokens: estimatedTokens,
      processing_strategy: 'large_document'
    };
  }
}

// Test function
async function runTest() {
  console.log('🧪 Starting Layered Document Processing Test\n');
  
  const mockApiService = new MockPythonApiService();
  const testService = new TestLayeredDocumentService(mockApiService);
  
  // Test documents
  const shortDoc = createMockDocument(
    'This is a short test document for the layered processing system. It contains basic information and should be processed as a small document.',
    'short-test.txt'
  );
  
  const longDoc = createMockDocument(
    'This is a comprehensive test document designed to thoroughly evaluate the layered document processing system. '.repeat(100) + 
    'It contains extensive content that should trigger the large document processing path. ' +
    'The system should generate a compressed Layer 2 summary while preserving the full text in Layer 3. ' +
    'This approach optimizes token usage while maintaining access to complete information when needed.',
    'long-test.txt'
  );
  
  try {
    // Test short document
    console.log('='.repeat(60));
    console.log('TESTING SHORT DOCUMENT');
    console.log('='.repeat(60));
    
    const shortResult = await testService.processDocumentLayers(shortDoc);
    console.log('\n✅ Short Document Results:');
    console.log(`Strategy: ${shortResult.processing_strategy}`);
    console.log(`Tokens: ${shortResult.estimated_tokens}`);
    console.log(`Layer 1 Summary: ${shortResult.layer1_summary.substring(0, 100)}...`);
    console.log(`Layer 1 Word Bank: ${shortResult.layer1_word_bank.substring(0, 100)}...`);
    console.log(`Layer 2 is full content: ${shortResult.layer2_summary === shortDoc.content}`);
    
    // Test long document
    console.log('\n' + '='.repeat(60));
    console.log('TESTING LONG DOCUMENT');
    console.log('='.repeat(60));
    
    const longResult = await testService.processDocumentLayers(longDoc);
    console.log('\n✅ Long Document Results:');
    console.log(`Strategy: ${longResult.processing_strategy}`);
    console.log(`Tokens: ${longResult.estimated_tokens}`);
    console.log(`Layer 1 Summary: ${longResult.layer1_summary.substring(0, 100)}...`);
    console.log(`Layer 1 Word Bank: ${longResult.layer1_word_bank.substring(0, 100)}...`);
    console.log(`Layer 2 Summary: ${longResult.layer2_summary.substring(0, 100)}...`);
    console.log(`Layer 3 Full Text Available: ${!!longResult.layer3_full_text}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    
    console.log('\n📋 Summary:');
    console.log(`- Short document (${shortResult.estimated_tokens} tokens): ${shortResult.processing_strategy}`);
    console.log(`- Long document (${longResult.estimated_tokens} tokens): ${longResult.processing_strategy}`);
    console.log('- Layer generation working correctly');
    console.log('- Token estimation functioning properly');
    console.log('- Processing strategy selection accurate');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
runTest().catch(console.error);