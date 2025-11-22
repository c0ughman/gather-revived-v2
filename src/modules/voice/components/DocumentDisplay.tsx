import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import { Copy, X, Download, Check, BookOpen, Trash2 } from 'lucide-react';
import './tiptap-editor.css';

interface DocumentDisplayProps {
  content: string;
  isVisible: boolean;
  onClose: () => void;
  documentIndex?: number;
  totalDocuments?: number;
  onNextDocument?: () => void;
  onPreviousDocument?: () => void;
  canNavigate?: boolean;
  agentId?: string;
  onSaveToNotes?: (title: string, content: string) => void;
  onDelete?: () => void;
  title?: string;
  onContentChange?: (content: string, hasChanged: boolean) => void;
}

export default function DocumentDisplay({ 
  content, 
  isVisible, 
  onClose, 
  documentIndex = 0,
  totalDocuments = 1,
  onNextDocument,
  onPreviousDocument,
  canNavigate = false,
  agentId,
  onSaveToNotes,
  onDelete,
  title,
  onContentChange
}: DocumentDisplayProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalContent, setOriginalContent] = useState(content);
  const [hasBeenEdited, setHasBeenEdited] = useState(false);
  const [isUpdatingFromProps, setIsUpdatingFromProps] = useState(false);
  const [lastNotifiedContent, setLastNotifiedContent] = useState(content);

  // Convert markdown to HTML for initial content
  const markdownToHtml = (markdown: string) => {
    // Simple markdown to HTML conversion for initial display
    return markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>')
      .replace(/^\d+\. (.*$)/gm, '<ol><li>$1</li></ol>')
      .split('\n\n') // Split by double newlines to preserve paragraphs
      .map(para => {
        if (para.trim() === '') return '';
        if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol')) return para;
        return `<p>${para.replace(/\n/g, '<br>')}</p>`; // Preserve single line breaks as <br>
      })
      .join('\n')
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/<\/ol>\s*<ol>/g, '');
  };

  // Convert HTML back to markdown
  const htmlToMarkdown = (html: string) => {
    return html
      .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<br\s*\/?>/g, '\n') // Convert <br> back to newlines
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<li>(.*?)<\/li>/g, '* $1\n')
      .replace(/<\/?ul>/g, '')
      .replace(/<\/?ol>/g, '')
      .replace(/\n{3,}/g, '\n\n') // Limit excessive newlines
      .trim();
  };

  // Set up Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        hardBreak: {
          keepMarks: false,
        },
      }),
      Typography,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: markdownToHtml(content),
    onUpdate: ({ editor }) => {
      // Skip if we're updating from props to prevent infinite loop
      if (isUpdatingFromProps) {
        return;
      }
      
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      
      // Only notify if content has actually changed from last notification
      if (markdown === lastNotifiedContent) {
        return;
      }
      
      // Check if content has changed from original
      const hasChanged = markdown !== originalContent;
      setHasBeenEdited(hasChanged);
      setLastNotifiedContent(markdown);
      
      // Notify parent with current content and change status
      if (onContentChange) {
        onContentChange(markdown, hasChanged);
      }
    },
    onCreate: ({ editor }) => {
      console.log('Tiptap editor created and mounted');
    },
  });


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

  // Set animation state true when component first becomes visible
  useEffect(() => {
    if (isVisible && !isAnimating) {
      setTimeout(() => setIsAnimating(true), 50);
    }
  }, [isVisible, isAnimating]);

  // Update content tracking when props change
  useEffect(() => {
    setOriginalContent(content);
    setLastNotifiedContent(content);
    setHasBeenEdited(false);
  }, [content]);

  // Update editor content when props change (preserve cursor position)
  useEffect(() => {
    if (isVisible && content && editor && editor.commands) {
      const currentHtml = editor.getHTML();
      const expectedHtml = markdownToHtml(content);
      
      // Only update if the content is actually different and we're not currently editing
      if (currentHtml !== expectedHtml && !editor.isFocused) {
        setIsUpdatingFromProps(true);
        
        // Save current cursor position
        const selection = editor.state.selection;
        const { from, to } = selection;
        
        // Update content
        editor.commands.setContent(expectedHtml);
        
        // Restore cursor position if possible
        try {
          const newDoc = editor.state.doc;
          const newFrom = Math.min(from, newDoc.content.size);
          const newTo = Math.min(to, newDoc.content.size);
          editor.commands.setTextSelection({ from: newFrom, to: newTo });
        } catch (error) {
          // If cursor restoration fails, just focus at the end
          console.warn('Could not restore cursor position:', error);
        }
        
        // Reset flag after update completes
        setTimeout(() => setIsUpdatingFromProps(false), 50);
      }
    }
  }, [content, editor, isVisible]);
  

  // Initialize editor state when editor is created
  useEffect(() => {
    if (editor && content) {
      // Reset tracking state when editor is created
      setOriginalContent(content);
      setLastNotifiedContent(content);
      setHasBeenEdited(false);
      setIsUpdatingFromProps(false);
    }
  }, [editor]);

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  const handleCopy = async () => {
    try {
      // Get current content from editor or fallback to props content
      let contentToCopy = content;
      if (editor) {
        const html = editor.getHTML();
        contentToCopy = html
          .replace(/<h1>(.*?)<\/h1>/g, '# $1')
          .replace(/<h2>(.*?)<\/h2>/g, '## $1')
          .replace(/<h3>(.*?)<\/h3>/g, '### $1')
          .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
          .replace(/<em>(.*?)<\/em>/g, '*$1*')
          .replace(/<code>(.*?)<\/code>/g, '`$1`')
          .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
          .replace(/<li>(.*?)<\/li>/g, '* $1\n')
          .replace(/<ul>|<\/ul>/g, '')
          .replace(/<ol>|<\/ol>/g, '')
          .trim();
      }
      
      if (!contentToCopy) {
        setError('No content to copy');
        setTimeout(() => setError(null), 3000);
        return;
      }
      await navigator.clipboard.writeText(contentToCopy);
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
      // Get current content from editor or fallback to props content
      let contentToDownload = content;
      if (editor) {
        const html = editor.getHTML();
        contentToDownload = html
          .replace(/<h1>(.*?)<\/h1>/g, '# $1')
          .replace(/<h2>(.*?)<\/h2>/g, '## $1')
          .replace(/<h3>(.*?)<\/h3>/g, '### $1')
          .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
          .replace(/<em>(.*?)<\/em>/g, '*$1*')
          .replace(/<code>(.*?)<\/code>/g, '`$1`')
          .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
          .replace(/<li>(.*?)<\/li>/g, '* $1\n')
          .replace(/<ul>|<\/ul>/g, '')
          .replace(/<ol>|<\/ol>/g, '')
          .trim();
      }
      
      if (!contentToDownload) {
        setError('No content to download');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const blob = new Blob([contentToDownload], { type: 'text/markdown' });
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


  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleSaveToNotes = async () => {
    // Get current content from editor or fallback to props content
    let contentToSave = content;
    if (editor) {
      const html = editor.getHTML();
      contentToSave = html
        .replace(/<h1>(.*?)<\/h1>/g, '# $1')
        .replace(/<h2>(.*?)<\/h2>/g, '## $1')
        .replace(/<h3>(.*?)<\/h3>/g, '### $1')
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
        .replace(/<em>(.*?)<\/em>/g, '*$1*')
        .replace(/<code>(.*?)<\/code>/g, '`$1`')
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<li>(.*?)<\/li>/g, '* $1\n')
        .replace(/<ul>|<\/ul>/g, '')
        .replace(/<ol>|<\/ol>/g, '')
        .trim();
    }
    
    if (!onSaveToNotes || !contentToSave || isSaving || saved) return;

    try {
      setIsSaving(true);
      // Generate a title from the first line or first few words of content
      const lines = contentToSave.split('\n').filter((line: string) => line.trim());
      const title = lines[0]?.trim().substring(0, 100) || `Document ${new Date().toLocaleDateString()}`;
      
      await onSaveToNotes(title, contentToSave);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save to notes:', err);
      setError('Failed to save to notes. Check console for details.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div className={`w-full h-full p-[7px] transition-all duration-500 ease-out transform ${
      isAnimating 
        ? 'translate-y-0 opacity-100 scale-100' 
        : 'translate-y-8 opacity-0 scale-95'
    }`}>
      <div className={`w-full h-full shadow-2xl border-document-frame overflow-hidden rounded-[20px] flex flex-col relative transition-all duration-500 ease-out transform ${
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
        <div className={`p-6 border-b border-document-divider transition-all duration-500 transform ${
          isAnimating 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-4 opacity-0'
        }`}
        style={{ transitionDelay: isAnimating ? '50ms' : '0ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold text-gray-900">{title || "Generated Document"}</h1>
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors duration-200"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>
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
              {onSaveToNotes && (
                <button
                  onClick={handleSaveToNotes}
                  disabled={isSaving || saved}
                  className={`p-2 rounded-full transition-colors duration-200 ${
                    saved 
                      ? 'bg-green-50 hover:bg-green-100' 
                      : isSaving
                      ? 'bg-gray-100 cursor-not-allowed'
                      : 'bg-orange-50 hover:bg-orange-100'
                  }`}
                  title={saved ? "Saved to Notes" : isSaving ? "Saving..." : "Save to Notes"}
                >
                  {saved ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : isSaving ? (
                    <div className="w-4 h-4 border-spinner-orange rounded-full animate-spin"></div>
                  ) : (
                    <BookOpen className="w-4 h-4 text-orange-600" />
                  )}
                </button>
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
          <div className="mx-6 mt-4 p-3 bg-red-50 border-document-error rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Document Content - Tiptap Editor */}
        <div className={`flex-1 overflow-hidden transition-all duration-500 transform ${
          isAnimating 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-4 opacity-0'
        }`} 
        style={{ transitionDelay: isAnimating ? '100ms' : '0ms' }}>
          <div className="h-full p-6 overflow-y-auto">
            <div className="prose prose-gray max-w-none">
              <EditorContent 
                editor={editor} 
                className="min-h-[400px] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Document Footer */}
        <div className={`p-4 border-t border-document-divider bg-gray-50 transition-all duration-500 transform ${
          isAnimating 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-2 opacity-0'
        }`}
        style={{ transitionDelay: isAnimating ? '300ms' : '0ms' }}>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Click anywhere to edit • Generated by AI</span>
            <span>{content.length} characters</span>
          </div>
        </div>
      </div>
    </div>
  );
} 