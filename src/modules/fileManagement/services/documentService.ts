import { DocumentInfo } from '../types/documents';
// Import PDF.js worker URL - using ES module version for Vite compatibility
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

class DocumentService {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly TEXT_FILE_TYPES = [
    'text/plain',
    'text/csv',
    'application/json',
    'text/markdown',
    'text/html',
    'application/javascript',
    'text/css',
    'application/xml',
    'text/xml',
    'application/yaml',
    'text/yaml'
  ];
  
  private static readonly BINARY_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];

  async processFile(file: File): Promise<DocumentInfo> {
    // Validate file size
    if (file.size > DocumentService.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds ${DocumentService.MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    // Validate file type
    if (!this.isSupportedType(file.type, file.name)) {
      const extension = file.name.toLowerCase().split('.').pop();
      const supportedExts = this.getSupportedExtensions().join(', ');
      throw new Error(`Unsupported file type: .${extension}\n\nSupported formats:\n• Text files: txt, md, json, csv, html, js, ts, css, xml, yaml, py, java, etc.\n• Documents: pdf, docx, pptx, xlsx\n\nAll supported: ${supportedExts}`);
    }

    try {
      let content = '';
      let extractedText = '';
      let metadata = {};

      if (this.isTextFile(file.type, file.name)) {
        content = await this.extractTextContent(file);
        extractedText = content;
        metadata = { 
          type: 'Text File', 
          extractionMethod: 'Direct text reading',
          extractionSuccess: true,
          extractionQuality: 'excellent'
        };
      } else if (this.isBinaryFile(file.type, file.name)) {
        const result = await this.extractBinaryContent(file);
        content = result.text;
        extractedText = result.text;
        metadata = result.metadata;
      }

      const summary = this.generateSummary(content, file.name, metadata);

      const documentInfo: DocumentInfo = {
        id: this.generateId(),
        name: file.name,
        type: file.type || this.getTypeFromExtension(file.name),
        size: file.size,
        uploadedAt: new Date(),
        content,
        extractedText,
        summary,
        metadata
      };

      return documentInfo;
    } catch (error) {
      console.error(`Failed to process ${file.name}:`, error);
      throw new Error(`Failed to process ${file.name}: ${error.message || error}`);
    }
  }

  private async extractTextContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const content = event.target?.result as string;
        resolve(content);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read text file'));
      };
      
      reader.readAsText(file, 'UTF-8');
    });
  }

  private async extractBinaryContent(file: File): Promise<{ text: string; metadata: any }> {
    const extension = file.name.toLowerCase().split('.').pop();
    
    try {
      switch (extension) {
        case 'pdf':
          return await this.extractPDFContent(file);
        case 'docx':
          return await this.extractWordContent(file);
        case 'pptx':
          return await this.extractPowerPointContent(file);
        case 'xlsx':
        case 'xls':
          return await this.extractExcelContent(file);
        default:
          throw new Error(`Unsupported binary format: .${extension}`);
      }
    } catch (error) {
      console.error(`Error extracting content from ${file.name}:`, error);
      throw error;
    }
  }

  private async extractPDFContent(file: File): Promise<{ text: string; metadata: any }> {
    console.log(`🔍 Starting PDF extraction for: ${file.name} (${Math.round(file.size / 1024)}KB)`);
    
    try {
      // Import PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source to the imported worker URL
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      console.log(`📖 File loaded: ${arrayBuffer.byteLength} bytes`);
      
      // Load PDF with minimal configuration
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      }).promise;
      
      console.log(`✅ PDF loaded: ${pdf.numPages} pages`);
      
      let fullText = '';
      let totalChars = 0;
      let pagesWithText = 0;
      
      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          console.log(`📄 Processing page ${pageNum}...`);
          
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Extract text items
          const textItems = textContent.items as any[];
          let pageText = '';
          
          // Simple text extraction - just concatenate all text items
          for (const item of textItems) {
            if (item.str && item.str.trim()) {
              pageText += item.str + ' ';
            }
          }
          
          pageText = pageText.trim();
          
          if (pageText.length > 0) {
            fullText += `\n--- PAGE ${pageNum} ---\n${pageText}\n`;
            totalChars += pageText.length;
            pagesWithText++;
            console.log(`✅ Page ${pageNum}: ${pageText.length} characters`);
          } else {
            fullText += `\n--- PAGE ${pageNum} ---\n[No text content found]\n`;
            console.log(`⚠️ Page ${pageNum}: No text found`);
          }
          
        } catch (pageError) {
          console.error(`❌ Error on page ${pageNum}:`, pageError);
          fullText += `\n--- PAGE ${pageNum} ---\n[Error extracting page: ${pageError.message}]\n`;
        }
      }
      
      // Add summary
      fullText += `\n\n=== PDF SUMMARY ===\n`;
      fullText += `File: ${file.name}\n`;
      fullText += `Total Pages: ${pdf.numPages}\n`;
      fullText += `Pages with Text: ${pagesWithText}\n`;
      fullText += `Total Characters: ${totalChars}\n`;
      
      // Determine quality
      let quality = 'poor';
      if (pagesWithText > 0 && totalChars > 100) {
        const textRatio = pagesWithText / pdf.numPages;
        if (textRatio >= 0.8 && totalChars > 1000) quality = 'excellent';
        else if (textRatio >= 0.5 && totalChars > 500) quality = 'good';
        else if (textRatio >= 0.2 && totalChars > 100) quality = 'partial';
      }
      
      const metadata = {
        type: 'PDF Document',
        extractionMethod: 'PDF.js Simple Text Extraction',
        pageCount: pdf.numPages,
        pagesWithText,
        totalCharacters: totalChars,
        extractionSuccess: pagesWithText > 0,
        extractionQuality: quality,
        textCoverage: Math.round((pagesWithText / pdf.numPages) * 100)
      };
      
      console.log(`🎯 PDF extraction complete: ${quality} quality, ${pagesWithText}/${pdf.numPages} pages with text`);
      
      if (pagesWithText === 0) {
        throw new Error('No text found in PDF. This may be a scanned document or image-based PDF.');
      }
      
      return { text: fullText, metadata };
      
    } catch (error) {
      console.error('❌ PDF extraction failed:', error);
      
      // Return a meaningful error document
      const errorText = `PDF Document: ${file.name}

❌ Extraction Failed: ${error.message}

This PDF could not be processed. Common reasons:
• Scanned document (requires OCR)
• Password protected
• Corrupted file
• Complex formatting

File size: ${Math.round(file.size / 1024)}KB
Upload date: ${new Date().toLocaleString()}

The AI can still reference this document by name but won't have access to its content.`;

      return {
        text: errorText,
        metadata: {
          type: 'PDF Document',
          extractionMethod: 'Failed',
          extractionSuccess: false,
          extractionQuality: 'poor',
          error: error.message
        }
      };
    }
  }

  private async extractWordContent(file: File): Promise<{ text: string; metadata: any }> {
    try {
      console.log(`📝 Starting Word extraction for: ${file.name}`);
      
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      const wordCount = result.value.split(/\s+/).filter(word => word.trim()).length;
      const paragraphs = result.value.split(/\n\s*\n/).filter(p => p.trim()).length;
      
      const metadata = {
        type: 'Word Document (.docx)',
        extractionMethod: 'Mammoth.js',
        wordCount,
        paragraphs,
        extractionSuccess: true,
        extractionQuality: 'excellent',
        characterCount: result.value.length
      };
      
      console.log(`✅ Word extraction complete: ${wordCount} words`);
      
      return { text: result.value, metadata };
    } catch (error) {
      console.error('❌ Word extraction error:', error);
      throw new Error(`Word document extraction failed: ${error.message}`);
    }
  }

  private async extractPowerPointContent(file: File): Promise<{ text: string; metadata: any }> {
    try {
      console.log(`🎯 Starting PowerPoint extraction for: ${file.name}`);
      
      const PizZip = (await import('pizzip')).default;
      const arrayBuffer = await file.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      
      let fullText = `PowerPoint Presentation: ${file.name}\n${'='.repeat(50)}\n\n`;
      let slideCount = 0;
      let totalText = 0;
      
      const slideFiles = Object.keys(zip.files)
        .filter(filename => filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml'))
        .sort();
      
      slideCount = slideFiles.length;
      
      for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const slideNumber = i + 1;
        
        try {
          const slideXml = zip.files[slideFile].asText();
          const textMatches = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
          
          const slideTexts = textMatches
            .map(match => match.replace(/<[^>]*>/g, '').trim())
            .filter(text => text);
          
          fullText += `--- SLIDE ${slideNumber} ---\n`;
          if (slideTexts.length > 0) {
            fullText += slideTexts.join(' ') + '\n\n';
            totalText += slideTexts.join(' ').length;
          } else {
            fullText += '[No text content]\n\n';
          }
        } catch (slideError) {
          fullText += `--- SLIDE ${slideNumber} ---\n[Error extracting slide]\n\n`;
        }
      }
      
      const metadata = {
        type: 'PowerPoint Presentation (.pptx)',
        extractionMethod: 'PizZip XML Parser',
        slideCount,
        totalTextLength: totalText,
        extractionSuccess: totalText > 0,
        extractionQuality: totalText > 500 ? 'excellent' : totalText > 100 ? 'good' : 'partial'
      };
      
      console.log(`✅ PowerPoint extraction complete: ${slideCount} slides`);
      
      return { text: fullText, metadata };
    } catch (error) {
      console.error('❌ PowerPoint extraction error:', error);
      throw new Error(`PowerPoint extraction failed: ${error.message}`);
    }
  }

  private async extractExcelContent(file: File): Promise<{ text: string; metadata: any }> {
    try {
      console.log(`📊 Starting Excel extraction for: ${file.name}`);
      
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let fullText = `Excel Spreadsheet: ${file.name}\n${'='.repeat(50)}\n\n`;
      let totalRows = 0;
      
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        fullText += `--- SHEET: ${sheetName} ---\n`;
        
        jsonData.forEach((row: any, index) => {
          if (row && Array.isArray(row) && row.some(cell => cell !== '')) {
            fullText += `Row ${index + 1}: ${row.join(' | ')}\n`;
            totalRows++;
          }
        });
        
        fullText += '\n';
      });
      
      const metadata = {
        type: 'Excel Spreadsheet',
        extractionMethod: 'SheetJS',
        sheetCount: workbook.SheetNames.length,
        totalRows,
        extractionSuccess: true,
        extractionQuality: 'excellent'
      };
      
      console.log(`✅ Excel extraction complete: ${workbook.SheetNames.length} sheets`);
      
      return { text: fullText, metadata };
    } catch (error) {
      console.error('❌ Excel extraction error:', error);
      throw new Error(`Excel extraction failed: ${error.message}`);
    }
  }

  private isTextFile(mimeType: string, fileName: string): boolean {
    if (DocumentService.TEXT_FILE_TYPES.includes(mimeType)) {
      return true;
    }

    const extension = fileName.toLowerCase().split('.').pop();
    const textExtensions = [
      'txt', 'md', 'json', 'csv', 'html', 'htm', 'js', 'ts', 'jsx', 'tsx',
      'css', 'scss', 'sass', 'xml', 'yaml', 'yml', 'log', 'sql', 'py', 'java',
      'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'sh', 'bat', 'ps1', 'r'
    ];

    return textExtensions.includes(extension || '');
  }

  private isBinaryFile(mimeType: string, fileName: string): boolean {
    if (DocumentService.BINARY_FILE_TYPES.includes(mimeType)) {
      return true;
    }

    const extension = fileName.toLowerCase().split('.').pop();
    const binaryExtensions = ['pdf', 'docx', 'pptx', 'xlsx', 'xls'];

    return binaryExtensions.includes(extension || '');
  }

  private isSupportedType(mimeType: string, fileName: string): boolean {
    return this.isTextFile(mimeType, fileName) || this.isBinaryFile(mimeType, fileName);
  }

  private getTypeFromExtension(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    const typeMap: Record<string, string> = {
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'csv': 'text/csv',
      'html': 'text/html',
      'htm': 'text/html',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'css': 'text/css',
      'xml': 'application/xml',
      'yaml': 'application/yaml',
      'yml': 'application/yaml',
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel'
    };

    return typeMap[extension || ''] || 'application/octet-stream';
  }

  private generateSummary(content: string, fileName: string, metadata: any = {}): string {
    const lines = content.split('\n').filter(line => line.trim());
    const wordCount = content.split(/\s+/).filter(word => word.trim()).length;
    const charCount = content.length;

    let summary = `📁 File: ${fileName}\n`;
    
    if (metadata.type) {
      summary += `📄 Type: ${metadata.type}\n`;
    }
    
    summary += `📊 Size: ${charCount.toLocaleString()} characters, ${wordCount.toLocaleString()} words, ${lines.length.toLocaleString()} lines\n`;
    
    // Add specific metadata
    if (metadata.pageCount) {
      summary += `📄 Pages: ${metadata.pageCount}`;
      if (metadata.pagesWithText) {
        summary += ` (${metadata.pagesWithText} with text, ${metadata.textCoverage}% coverage)`;
      }
      summary += '\n';
    }
    
    if (metadata.slideCount) {
      summary += `🎯 Slides: ${metadata.slideCount}\n`;
    }
    
    if (metadata.sheetCount) {
      summary += `📊 Sheets: ${metadata.sheetCount}\n`;
    }

    // Quality indicator
    if (metadata.extractionQuality) {
      const qualityEmoji = {
        'excellent': '🟢',
        'good': '🟡', 
        'partial': '🟠',
        'poor': '🔴'
      };
      summary += `${qualityEmoji[metadata.extractionQuality]} Quality: ${metadata.extractionQuality}\n`;
    }

    // Status
    if (metadata.extractionSuccess === false) {
      summary += `⚠️ Extraction failed\n`;
    } else {
      summary += `✅ Content extracted successfully\n`;
    }

    // Preview
    if (content && content.length > 100 && metadata.extractionSuccess !== false) {
      const preview = content.substring(0, 200).trim();
      summary += `\n📖 Preview: ${preview}${content.length > 200 ? '...' : ''}`;
    }

    return summary;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  formatDocumentForAI(document: DocumentInfo): string {
    let formattedDoc = `📄 DOCUMENT: ${document.name}
📋 Type: ${document.type}
📅 Uploaded: ${document.uploadedAt.toLocaleString()}
📊 Summary: ${document.summary}`;

    formattedDoc += `\n\n📖 CONTENT:\n${'-'.repeat(80)}\n${document.extractedText || document.content}`;
    formattedDoc += `\n${'-'.repeat(80)}\n📄 END OF DOCUMENT: ${document.name}`;

    return formattedDoc;
  }

  getSupportedTypes(): string[] {
    return [...DocumentService.TEXT_FILE_TYPES, ...DocumentService.BINARY_FILE_TYPES];
  }

  getMaxFileSize(): number {
    return DocumentService.MAX_FILE_SIZE;
  }

  getSupportedExtensions(): string[] {
    return [
      // Text files
      'txt', 'md', 'json', 'csv', 'html', 'htm', 'js', 'ts', 'jsx', 'tsx',
      'css', 'scss', 'sass', 'xml', 'yaml', 'yml', 'log', 'sql', 'py', 'java',
      'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'sh', 'bat', 'ps1', 'r',
      // Binary files
      'pdf', 'docx', 'pptx', 'xlsx', 'xls'
    ];
  }
}

export const documentService = new DocumentService();