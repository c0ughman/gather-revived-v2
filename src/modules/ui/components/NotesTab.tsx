import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Plus, Pin, PinOff, Edit3, Trash2 } from 'lucide-react';
import { PaperNote } from '../../../core/types/memory';
import { memoryService } from '../../../core/services/memoryService';
import { backendDatabaseService } from '../../database/services/backendDatabaseService';
import { geminiLiveService } from '../../voice/services/geminiLiveService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NotesTabProps {
  agentId: string;
  agentName: string;
  onViewNote?: (note: PaperNote) => void;
}

export interface NotesTabRef {
  refreshNotes: () => void;
}

const NotesTab = forwardRef<NotesTabRef, NotesTabProps>(({ agentId, agentName, onViewNote }, ref) => {
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [tokenInfo, setTokenInfo] = useState<{
    includedNotes: PaperNote[]
    excludedNotes: PaperNote[]
    totalTokens: number
    maxTokens: number
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewNote, setShowNewNote] = useState(false);
  const [editingNote, setEditingNote] = useState<PaperNote | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  useEffect(() => {
    loadNotes();
  }, [agentId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      
      // Try to get token-aware notes first
      try {
        const tokenData = await backendDatabaseService.getPaperNotesWithTokenInfo(agentId);
        setNotes(tokenData.allNotes);
        setTokenInfo({
          includedNotes: tokenData.includedNotes,
          excludedNotes: tokenData.excludedNotes,
          totalTokens: tokenData.totalTokens,
          maxTokens: tokenData.maxTokens
        });
      } catch (tokenError) {
        console.warn('Token-aware notes service failed, falling back to legacy service:', tokenError);
        // Fallback to legacy service
        const fetchedNotes = await memoryService.getPaperNotes(agentId);
        setNotes(fetchedNotes);
        setTokenInfo(null);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!newNoteTitle.trim() && !newNoteContent.trim()) return;

    try {
      if (editingNote) {
        // Update existing note
        const updatedNote = await memoryService.updatePaperNote(editingNote.id, {
          title: newNoteTitle.trim(),
          content: newNoteContent.trim()
        });
        setNotes(prev => prev.map(note => note.id === editingNote.id ? updatedNote : note));
        setEditingNote(null);
      } else {
        // Create new note
        const newNote = await memoryService.createPaperNote({
          agent_id: agentId,
          title: newNoteTitle.trim(),
          content: newNoteContent.trim(),
          note_type: 'general'
        });
        setNotes(prev => [newNote, ...prev]);
      }
      
      setNewNoteTitle('');
      setNewNoteContent('');
      setShowNewNote(false);
      
      // Trigger voice context refresh if there's an active voice session
      geminiLiveService.triggerNotesRefresh();
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleEditNote = (note: PaperNote) => {
    setEditingNote(note);
    setNewNoteTitle(note.title);
    setNewNoteContent(note.content);
    setShowNewNote(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      await memoryService.deletePaperNote(noteId);
      setNotes(prev => prev.filter(note => note.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleTogglePin = async (note: PaperNote) => {
    try {
      // If trying to pin a note, check if pinned tokens would exceed limit
      if (!note.is_pinned && tokenInfo) {
        // Calculate current pinned tokens total
        const currentPinnedNotes = notes.filter(n => n.is_pinned);
        const currentPinnedTokens = currentPinnedNotes.reduce((total, n) => {
          return total + Math.ceil((n.content?.length || 0) / 4);
        }, 0);
        
        // Calculate what this note would add
        const noteTokens = Math.ceil((note.content?.length || 0) / 4);
        const newPinnedTotal = currentPinnedTokens + noteTokens;
        
        // If pinned total would exceed limit, prevent pinning
        if (newPinnedTotal > tokenInfo.maxTokens) {
          alert(`Cannot pin this note. Pinned notes would total ${newPinnedTotal.toLocaleString()} tokens, exceeding the ${tokenInfo.maxTokens.toLocaleString()} token limit.`);
          return;
        }
      }

      const updatedNote = await memoryService.updatePaperNote(note.id, {
        is_pinned: !note.is_pinned
      });
      setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
      
      // Refresh notes to get updated token info
      await loadNotes();
      
      // Trigger voice context refresh if there's an active voice session
      geminiLiveService.triggerNotesRefresh();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleCancelEdit = () => {
    setShowNewNote(false);
    setEditingNote(null);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  const handleNoteClick = (note: PaperNote) => {
    if (onViewNote) {
      onViewNote(note);
    }
  };

  // Function to refresh notes from parent components
  const refreshNotes = () => {
    loadNotes();
  };

  // Expose refresh function to parent
  useImperativeHandle(ref, () => ({
    refreshNotes
  }));

  // Helper function to determine if a note is excluded from context
  const isNoteExcluded = (note: PaperNote): boolean => {
    if (!tokenInfo) return false;
    // Pinned notes are never excluded/grey
    if (note.is_pinned) return false;
    // Check if unpinned note is in excluded list
    return tokenInfo.excludedNotes.some(excluded => excluded.id === note.id);
  };

  // Sort notes: pinned first, then included unpinned, then excluded unpinned at bottom
  const pinnedNotes = notes.filter(note => note.is_pinned);
  const unpinnedNotes = notes.filter(note => !note.is_pinned);
  
  // Separate included and excluded unpinned notes
  const includedUnpinnedNotes = unpinnedNotes
    .filter(note => !isNoteExcluded(note))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const excludedUnpinnedNotes = unpinnedNotes
    .filter(note => isNoteExcluded(note))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Final order: pinned, then included unpinned, then excluded unpinned at bottom
  const sortedNotes = [...pinnedNotes, ...includedUnpinnedNotes, ...excludedUnpinnedNotes];

  // Distribute notes in zigzag pattern: Col1 Item1, Col2 Item1, Col1 Item2, Col2 Item2, etc.
  const leftColumnNotes: typeof notes = [];
  const rightColumnNotes: typeof notes = [];
  
  sortedNotes.forEach((note, index) => {
    if (index % 2 === 0) {
      leftColumnNotes.push(note);
    } else {
      rightColumnNotes.push(note);
    }
  });

  return (
    <div className="flex flex-col">
      {/* Add Button */}
      <div className="mb-3">
        <button
          onClick={() => setShowNewNote(true)}
          className="w-full flex items-center justify-center space-x-2 p-2 border border-dashed border-slate-600 rounded-lg hover:border-slate-500 hover:bg-white/5 transition-colors duration-200 text-sm"
        >
          <Plus className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400">Add Note</span>
        </button>
      </div>

      {/* New/Edit Note Form */}
      {showNewNote && (
        <div className="mb-3 bg-white rounded-[10px] p-3 text-black shadow-sm">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              className="w-full bg-transparent text-black px-0 py-1 text-base font-semibold focus:outline-none placeholder-gray-400"
              autoFocus
            />
            <textarea
              placeholder="Write your note..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              rows={4}
              className="w-full bg-transparent text-gray-700 px-0 py-1 text-sm font-normal focus:outline-none resize-none placeholder-gray-400"
            />
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1 text-gray-500 hover:text-gray-700 text-sm transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                disabled={!newNoteTitle.trim() && !newNoteContent.trim()}
                className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-black rounded-full text-sm transition-colors duration-200"
              >
                {editingNote ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Notes Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#186799]"></div>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-slate-400 mb-2">No notes yet</div>
            <div className="text-slate-500 text-sm">Create your first note or save papers from voice calls</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Left Column */}
            <div className="space-y-3">
              {leftColumnNotes.map((note) => {
                const isExcluded = isNoteExcluded(note);
                return (
                  <div
                    key={note.id}
                    onClick={() => handleNoteClick(note)}
                    className={`border rounded-[10px] p-3 text-sm shadow-sm hover:shadow-md transition-all duration-200 relative group cursor-pointer ${
                      isExcluded 
                        ? 'bg-gray-100 border-gray-300 opacity-60' 
                        : 'bg-white border-gray-200'
                    } ${isExcluded ? 'text-gray-600' : 'text-black'}`}
                  >
                
                  {/* Note content */}
                  <div className="pr-6">
                    <h4 className="font-medium mb-2 line-clamp-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.title || ''}</ReactMarkdown>
                    </h4>
                    <div className={`text-xs leading-relaxed line-clamp-4 prose prose-sm max-w-none ${
                      isExcluded ? 'text-gray-500' : 'text-gray-700'
                    }`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content || ''}</ReactMarkdown>
                    </div>
                  </div>
                  
                  {/* Pin button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(note);
                    }}
                    className={`absolute top-2 right-2 p-1 hover:bg-gray-100 rounded transition-all duration-200 ${
                      note.is_pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title={note.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className={`w-3 h-3 ${note.is_pinned ? 'text-[#186799] fill-current' : 'text-gray-600'}`} />
                  </button>
                  
                </div>
              );})}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {rightColumnNotes.map((note) => {
                const isExcluded = isNoteExcluded(note);
                return (
                  <div
                    key={note.id}
                    onClick={() => handleNoteClick(note)}
                    className={`border rounded-[10px] p-3 text-sm shadow-sm hover:shadow-md transition-all duration-200 relative group cursor-pointer ${
                      isExcluded 
                        ? 'bg-gray-100 border-gray-300 opacity-60' 
                        : 'bg-white border-gray-200'
                    } ${isExcluded ? 'text-gray-600' : 'text-black'}`}
                  >
                    {/* Note content */}
                    <div className="pr-6">
                      <h4 className="font-medium mb-2 line-clamp-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.title || ''}</ReactMarkdown>
                      </h4>
                      <div className={`text-xs leading-relaxed line-clamp-4 prose prose-sm max-w-none ${
                        isExcluded ? 'text-gray-500' : 'text-gray-700'
                      }`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content || ''}</ReactMarkdown>
                      </div>
                    </div>
                    
                    {/* Pin button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(note);
                      }}
                      className={`absolute top-2 right-2 p-1 hover:bg-gray-100 rounded transition-all duration-200 ${
                        note.is_pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title={note.is_pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={`w-3 h-3 ${note.is_pinned ? 'text-[#186799] fill-current' : 'text-gray-600'}`} />
                    </button>
                    
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

NotesTab.displayName = 'NotesTab';

export default NotesTab;