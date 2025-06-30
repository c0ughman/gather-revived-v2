import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, X } from 'lucide-react';

interface DocumentDisplayProps {
  content: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function DocumentDisplay({ content, isVisible, onClose }: DocumentDisplayProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
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
      await navigator.clipboard.writeText(content);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
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

        {/* Document Content */}
        <div className={`flex-1 p-8 overflow-y-auto cursor-pointer transition-all duration-500 transform ${
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
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Copy Button - Bottom */}
        <div className={`p-3 border-t border-gray-200 bg-gray-50 transition-all duration-500 transform ${
          isAnimating 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-2 opacity-0'
        }`}
        style={{ transitionDelay: isAnimating ? '300ms' : '0ms' }}>
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors duration-200 text-gray-600 text-xs font-medium"
          >
            <Copy className="w-3 h-3" />
            <span>Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
} 