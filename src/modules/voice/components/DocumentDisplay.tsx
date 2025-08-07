import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, X, Download, Check } from 'lucide-react';

interface DocumentDisplayProps {
  content: string;
  isVisible: boolean;
  onClose: () => void;
  documentIndex?: number;
  totalDocuments?: number;
  onNextDocument?: () => void;
  onPreviousDocument?: () => void;
  canNavigate?: boolean;
}

export default function DocumentDisplay({ 
  content, 
  isVisible, 
  onClose, 
  documentIndex = 0,
  totalDocuments = 1,
  onNextDocument,
  onPreviousDocument,
  canNavigate = false
}: DocumentDisplayProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setError(null);
      // Small delay to ensure DOM is ready
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      // Delay hiding to allow exit animation to complete
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Reset animation state when content changes (for new documents)
  useEffect(() => {
    if (isVisible && content) {
      // Reset animation state to show new content
      setIsAnimating(false);
      setTimeout(() => setIsAnimating(true), 50);
    }
  }, [content, isVisible]);

  const handleCopy = async () => {
    try {
      if (!content) {
        setError('No content to copy');
        setTimeout(() => setError(null), 3000);
        return;
      }
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setError('Failed to copy to clipboard');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDownload = () => {
    try {
      if (!content) {
        setError('No content to download');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download document: ', err);
      setError('Failed to download document');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDocumentClick = () => {
    handleCopy();
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!shouldRender) return null;

  return (
    <div className={`w-full h-full p-[7px] transition-all duration-500 ease-out transform ${
      isAnimating 
        ? 'translate-y-0 opacity-100 scale-100' 
        : 'translate-y-8 opacity-0 scale-95'
    }`}>
      <div className={`w-full h-full shadow-2xl border border-gray-200 overflow-hidden rounded-[20px] flex flex-col relative transition-all duration-500 ease-out transform ${
        isAnimating 
          ? 'translate-y-0 opacity-100 scale-100' 
          : 'translate-y-4 opacity-0 scale-98'
      }`}
           style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fefcfc 50%, #fdf9f9 100%)' }}>
        
        {/* Close Button - Top Right Corner */}
        <button
          onClick={handleClose}
          className={`absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300 shadow-sm transform ${
            isAnimating 
              ? 'translate-y-0 opacity-100' 
              : '-translate-y-2 opacity-0'
          }`}
          style={{ transitionDelay: isAnimating ? '200ms' : '0ms' }}
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        {/* Document Header */}
        <div className={`p-6 border-b border-gray-200 transition-all duration-500 transform ${
          isAnimating 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-4 opacity-0'
        }`}
        style={{ transitionDelay: isAnimating ? '50ms' : '0ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Generated Document</h1>
              <p className="text-sm text-gray-500 mt-1">
                {new Date().toLocaleDateString()} • {content ? content.split(' ').length : 0} words
                {totalDocuments > 1 && (
                  <span className="ml-2">• Document {documentIndex + 1} of {totalDocuments}</span>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {/* Navigation Controls */}
              {canNavigate && totalDocuments > 1 && (
                <>
                  <button
                    onClick={onPreviousDocument}
                    disabled={documentIndex === 0}
                    className={`p-2 rounded-full transition-colors duration-200 ${
                      documentIndex === 0 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                    }`}
                    title="Previous document"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={onNextDocument}
                    disabled={documentIndex === totalDocuments - 1}
                    className={`p-2 rounded-full transition-colors duration-200 ${
                      documentIndex === totalDocuments - 1 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                    }`}
                    title="Next document"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={handleDownload}
                className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                title="Download document"
              >
                <Download className="w-4 h-4 text-blue-600" />
              </button>
              <button
                onClick={handleCopy}
                className={`p-2 rounded-full transition-colors duration-200 ${
                  copied 
                    ? 'bg-green-50 hover:bg-green-100' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Document Content */}
        <div className={`flex-1 p-6 overflow-y-auto cursor-pointer transition-all duration-500 transform ${
          isAnimating 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-4 opacity-0'
        }`} 
        style={{ transitionDelay: isAnimating ? '100ms' : '0ms' }}
        onClick={handleDocumentClick}>
          <div className="prose prose-gray max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom styling for markdown elements
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-6">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-medium text-gray-800 mb-2 mt-4">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-gray-700 mb-4 leading-relaxed">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-6 mb-4 text-gray-700">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-6 mb-4 text-gray-700">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="mb-1">
                    {children}
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-200 pl-4 italic text-gray-600 mb-4">
                    {children}
                  </blockquote>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm text-gray-800 font-mono">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="block bg-gray-100 p-3 rounded text-sm text-gray-800 font-mono overflow-x-auto">
                      {children}
                    </code>
                  );
                },
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-gray-700">
                    {children}
                  </em>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="min-w-full border border-gray-200">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-left font-semibold text-gray-700">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-2 border-b border-gray-200 text-gray-700">
                    {children}
                  </td>
                ),
              }}
            >
              {content || 'Loading document content...'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Document Footer */}
        <div className={`p-4 border-t border-gray-200 bg-gray-50 transition-all duration-500 transform ${
          isAnimating 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-2 opacity-0'
        }`}
        style={{ transitionDelay: isAnimating ? '300ms' : '0ms' }}>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Click anywhere to copy • Generated by AI</span>
            <span>{content.length} characters</span>
          </div>
        </div>
      </div>
    </div>
  );
} 