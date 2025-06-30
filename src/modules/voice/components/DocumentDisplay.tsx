import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocumentInfo } from '../../fileManagement/types/documents';
import { FileText, Code, Database, FileImage, Presentation, Sheet } from 'lucide-react';

interface DocumentDisplayProps {
  document: DocumentInfo;
  className?: string;
}

export default function DocumentDisplay({ document, className = '' }: DocumentDisplayProps) {
  const getFileIcon = (type: string, name: string) => {
    const extension = name.toLowerCase().split('.').pop();
    
    if (type.includes('json') || type.includes('javascript') || type.includes('typescript')) {
      return <Code className="w-5 h-5 text-yellow-400" />;
    }
    if (type.includes('csv') || type.includes('excel') || type.includes('spreadsheet') || extension === 'xlsx' || extension === 'xls') {
      return <Sheet className="w-5 h-5 text-green-400" />;
    }
    if (type.includes('pdf') || extension === 'pdf') {
      return <FileImage className="w-5 h-5 text-red-400" />;
    }
    if (type.includes('presentation') || type.includes('powerpoint') || extension === 'pptx' || extension === 'ppt') {
      return <Presentation className="w-5 h-5 text-orange-400" />;
    }
    if (type.includes('word') || type.includes('document') || extension === 'docx' || extension === 'doc') {
      return <FileText className="w-5 h-5 text-[#186799]" />;
    }
    return <FileText className="w-5 h-5 text-[#186799]" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderContent = () => {
    // If we have extracted text, use that for display
    const contentToDisplay = document.extractedText || document.content || '';
    
    if (!contentToDisplay.trim()) {
      return (
        <div className="text-center py-8 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No content available for preview</p>
          <p className="text-sm mt-1">This document may contain binary data or be empty</p>
        </div>
      );
    }

    // Check if content looks like markdown
    const isMarkdown = contentToDisplay.includes('# ') || 
                      contentToDisplay.includes('## ') || 
                      contentToDisplay.includes('**') || 
                      contentToDisplay.includes('- ') ||
                      contentToDisplay.includes('```');

    if (isMarkdown) {
      return (
        <div className="prose prose-invert prose-slate max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom components for better styling
              h1: ({ children }) => <h1 className="text-2xl font-bold text-white mb-4">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-bold text-white mb-3">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-bold text-white mb-2">{children}</h3>,
              p: ({ children }) => <p className="text-slate-300 mb-3 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside text-slate-300 mb-3 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside text-slate-300 mb-3 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-slate-300">{children}</li>,
              code: ({ children, className }) => {
                const isInline = !className;
                if (isInline) {
                  return <code className="bg-slate-700 text-[#186799] px-1 py-0.5 rounded text-sm">{children}</code>;
                }
                return (
                  <pre className="bg-slate-800 border border-slate-600 rounded-lg p-4 overflow-x-auto mb-4">
                    <code className="text-slate-300 text-sm">{children}</code>
                  </pre>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-[#186799] pl-4 italic text-slate-400 mb-4">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full border border-slate-600 rounded-lg">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-slate-600 bg-slate-700 px-3 py-2 text-left text-white font-medium">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-slate-600 px-3 py-2 text-slate-300">
                  {children}
                </td>
              ),
              a: ({ children, href }) => (
                <a 
                  href={href} 
                  className="text-[#186799] hover:text-[#1a5a7a] underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              em: ({ children }) => <em className="text-slate-300 italic">{children}</em>
            }}
          >
            {contentToDisplay}
          </ReactMarkdown>
        </div>
      );
    }

    // For non-markdown content, display as formatted text
    return (
      <div className="text-slate-300 leading-relaxed">
        {contentToDisplay.split('\n').map((line, index) => (
          <div key={index} className="mb-2">
            {line.trim() === '' ? <br /> : line}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`bg-glass-panel glass-effect rounded-lg border border-slate-700 ${className}`}>
      {/* Document Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          {getFileIcon(document.type, document.name)}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">{document.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-slate-400 text-sm">{formatFileSize(document.size)}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 text-sm">{document.type}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 text-sm">
                {document.uploadedAt.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        {/* Document Summary */}
        {document.summary && (
          <div className="mt-3 p-3 bg-slate-800 rounded-lg">
            <p className="text-slate-300 text-sm">
              <span className="text-[#186799] font-medium">Summary: </span>
              {document.summary}
            </p>
          </div>
        )}
      </div>

      {/* Document Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {renderContent()}
      </div>

      {/* Document Metadata */}
      {document.metadata && Object.keys(document.metadata).length > 0 && (
        <div className="p-4 border-t border-slate-700">
          <h4 className="text-white font-medium mb-2">Document Information</h4>
          <div className="space-y-1">
            {Object.entries(document.metadata).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2 text-sm">
                <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span className="text-slate-300">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}