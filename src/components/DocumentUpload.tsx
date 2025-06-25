import React, { useCallback, useState } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, FileText, Code, Database, FileImage, Presentation, Sheet } from 'lucide-react';
import { DocumentInfo } from '../types';
import { documentService } from '../services/documentService';

interface DocumentUploadProps {
  onDocumentUploaded: (document: DocumentInfo) => void;
  onError: (error: string) => void;
  className?: string;
}

export default function DocumentUpload({ onDocumentUploaded, onError, className = '' }: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    // Reset input
    e.target.value = '';
  }, []);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    
    for (const file of files) {
      try {
        console.log(`📁 Processing file: ${file.name} (${Math.round(file.size / 1024)}KB)`);
        const document = await documentService.processFile(file);
        console.log(`✅ Successfully processed: ${file.name}`);
        onDocumentUploaded(document);
      } catch (error) {
        console.error(`❌ Failed to process ${file.name}:`, error);
        onError(`${file.name}: ${error.message || error}`);
      }
    }
    
    setIsProcessing(false);
  };

  const supportedExtensions = documentService.getSupportedExtensions();
  const acceptString = supportedExtensions.map(ext => `.${ext}`).join(',');

  return (
    <div className={className}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
          isDragOver
            ? 'border-blue-400 bg-blue-50 bg-opacity-10'
            : 'border-slate-600 hover:border-slate-500'
        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          accept={acceptString}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        
        <div className="text-center">
          <div className="mx-auto w-12 h-12 mb-4 flex items-center justify-center rounded-full bg-slate-700">
            {isProcessing ? (
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Upload className="w-6 h-6 text-slate-400" />
            )}
          </div>
          
          <h3 className="text-lg font-medium text-white mb-2">
            {isProcessing ? 'Processing files...' : 'Upload Documents'}
          </h3>
          
          <p className="text-slate-400 text-sm mb-4">
            Drag and drop files here, or click to select
          </p>
        </div>
      </div>
    </div>
  );
}

interface DocumentListProps {
  documents: DocumentInfo[];
  onRemoveDocument: (documentId: string) => void;
  className?: string;
}

export function DocumentList({ documents, onRemoveDocument, className = '' }: DocumentListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string, name: string) => {
    const extension = name.toLowerCase().split('.').pop();
    
    if (type.includes('json') || type.includes('javascript') || type.includes('typescript')) {
      return <Code className="w-4 h-4 text-yellow-400" />;
    }
    if (type.includes('csv') || type.includes('excel') || type.includes('spreadsheet') || extension === 'xlsx' || extension === 'xls') {
      return <Sheet className="w-4 h-4 text-green-400" />;
    }
    if (type.includes('pdf') || extension === 'pdf') {
      return <FileImage className="w-4 h-4 text-red-400" />;
    }
    if (type.includes('presentation') || type.includes('powerpoint') || extension === 'pptx' || extension === 'ppt') {
      return <Presentation className="w-4 h-4 text-orange-400" />;
    }
    if (type.includes('word') || type.includes('document') || extension === 'docx' || extension === 'doc') {
      return <FileText className="w-4 h-4 text-blue-400" />;
    }
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  const getExtractionQuality = (metadata: any) => {
    if (!metadata) return null;
    
    const quality = metadata.extractionQuality;
    if (!quality) return null;
    
    const qualityConfig = {
      'excellent': { color: 'text-green-400', emoji: '🟢', label: 'Excellent' },
      'good': { color: 'text-yellow-400', emoji: '🟡', label: 'Good' },
      'partial': { color: 'text-orange-400', emoji: '🟠', label: 'Partial' },
      'poor': { color: 'text-red-400', emoji: '🔴', label: 'Poor' }
    };
    
    const config = qualityConfig[quality as keyof typeof qualityConfig];
    if (!config) return null;
    
    return (
      <span className={`text-xs ${config.color} flex items-center space-x-1`}>
        <span>{config.emoji}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
        <File className="w-4 h-4" />
        <span>Uploaded Documents ({documents.length})</span>
      </h4>
      
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center space-x-3 p-3 bg-slate-700 rounded-lg border border-slate-600"
        >
          {getFileIcon(doc.type, doc.name)}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white truncate">{doc.name}</p>
              <button
                onClick={() => onRemoveDocument(doc.id)}
                className="p-1 rounded-full hover:bg-slate-600 transition-colors duration-200"
                title="Remove document"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-red-400" />
              </button>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-xs text-slate-400">{formatFileSize(doc.size)}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">
                {doc.uploadedAt.toLocaleDateString()}
              </span>
              {doc.metadata?.type && (
                <>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400">{doc.metadata.type}</span>
                </>
              )}
              {getExtractionQuality(doc.metadata)}
              {doc.metadata?.extractionSuccess !== false && (
                <CheckCircle className="w-3 h-3 text-green-400" />
              )}
              {doc.metadata?.extractionSuccess === false && (
                <AlertCircle className="w-3 h-3 text-red-400" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}