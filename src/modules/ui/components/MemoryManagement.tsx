import React, { useState, useEffect } from 'react';
import { Trash2, Pin } from 'lucide-react';
import { MediumTermMemory } from '../../../core/types/memory';
import { memoryService } from '../../../core/services/memoryService';
import { backendDatabaseService } from '../../database/services/backendDatabaseService';
import { estimateTokenCount } from '../../../core/utils/tokenUtils';

interface MemoryManagementProps {
  agentId: string;
  agentName: string;
  searchQuery?: string;
}

export default function MemoryManagement({ agentId, searchQuery = '' }: MemoryManagementProps) {
  const [memories, setMemories] = useState<MediumTermMemory[]>([]);
  const [tokenInfo, setTokenInfo] = useState<{
    includedMemory: MediumTermMemory[]
    excludedMemory: MediumTermMemory[]
    totalTokens: number
    maxTokens: number
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMemories();
  }, [agentId]);

  const loadMemories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to get token-aware memory first
      try {
        const tokenData = await backendDatabaseService.getMediumTermMemoryWithTokenInfo(agentId);
        
        // Check if backend service actually returned data
        if (tokenData.allMemory.length > 0 || tokenData.totalTokens > 0) {
          setMemories(tokenData.allMemory);
          setTokenInfo({
            includedMemory: tokenData.includedMemory,
            excludedMemory: tokenData.excludedMemory,
            totalTokens: tokenData.totalTokens,
            maxTokens: tokenData.maxTokens
          });
        } else {
          // Backend service is not implemented yet, use frontend service
          throw new Error('Backend service returned empty data - falling back to frontend service');
        }
      } catch (tokenError) {
        console.warn('Token-aware memory service not available, using frontend service:', tokenError.message);
        // Fallback to legacy service
        const memoriesData = await memoryService.getMediumTermMemories(agentId);
        setMemories(memoriesData);
        setTokenInfo(null);
      }
    } catch (error) {
      console.error('Error loading memories:', error);
      setError('Failed to load memories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMemoryChange = async (memoryId: string, newContent: string) => {
    try {
      // Update local state immediately for responsiveness
      setMemories(prev => prev.map(memory => 
        memory.id === memoryId 
          ? { ...memory, content: newContent, token_count: estimateTokenCount(newContent) }
          : memory
      ));

      // Update in database
      await memoryService.updateMediumTermMemory(memoryId, { content: newContent });
    } catch (error) {
      console.error('Error updating memory:', error);
      setError('Failed to update memory.');
      // Reload to revert changes
      loadMemories();
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
      return;
    }

    try {
      await memoryService.deleteMediumTermMemory(memoryId);
      setMemories(prev => prev.filter(memory => memory.id !== memoryId));
    } catch (error) {
      console.error('Error deleting memory:', error);
      setError('Failed to delete memory.');
    }
  };

  const handleTogglePin = async (memoryId: string, currentlyPinned: boolean) => {
    try {
      const newImportanceScore = currentlyPinned ? 0.5 : 1.0; // Pinned = max importance
      
      setMemories(prev => prev.map(memory => 
        memory.id === memoryId 
          ? { ...memory, importance_score: newImportanceScore }
          : memory
      ));

      await memoryService.updateMediumTermMemory(memoryId, { importance_score: newImportanceScore });
    } catch (error) {
      console.error('Error toggling pin:', error);
      setError('Failed to update memory.');
      loadMemories();
    }
  };

  // Helper function to determine if a memory is excluded from context
  const isMemoryExcluded = (memory: MediumTermMemory): boolean => {
    if (!tokenInfo) return false;
    return tokenInfo.excludedMemory.some(excluded => excluded.id === memory.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#186799]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-1">
      {/* Error Display */}
      {error && (
        <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}


      {/* Memory List */}
      {memories.length > 0 ? (
        memories
          .filter(memory => 
            searchQuery 
              ? memory.content.toLowerCase().includes(searchQuery.toLowerCase())
              : true
          )
          .map((memory, index) => {
          const isPinned = memory.importance_score >= 1.0;
          const lastEdited = new Date(memory.updated_at);
          const isExcluded = isMemoryExcluded(memory);
          
          return (
            <React.Fragment key={memory.id}>
              <div className={`bg-transparent transition-opacity duration-200 ${isExcluded ? 'opacity-60' : 'opacity-100'}`}>
                {/* Memory Content */}
                <textarea
                  value={memory.content}
                  onChange={(e) => handleMemoryChange(memory.id, e.target.value)}
                  className={`w-full bg-transparent resize-none border-none outline-none text-base leading-relaxed min-h-[100px] p-0 transition-colors duration-200 ${
                    isExcluded ? 'text-slate-400 italic' : 'text-white'
                  }`}
                  placeholder="Memory content..."
                  style={{ 
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit'
                  }}
                />
                
                {/* Bottom Row */}
                <div className={`flex items-center justify-between mt-3 mb-4 ${isExcluded ? 'relative' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-sm">
                      {lastEdited.toLocaleDateString()} at {lastEdited.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTogglePin(memory.id, isPinned)}
                      className={`p-1 rounded transition-colors ${
                        isPinned 
                          ? 'text-yellow-400 hover:text-yellow-300' 
                          : 'text-slate-500 hover:text-slate-400'
                      }`}
                      title={isPinned ? 'Unpin memory' : 'Pin memory (prevents auto-deletion)'}
                    >
                      <Pin className="w-4 h-4" fill={isPinned ? 'currentColor' : 'none'} />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteMemory(memory.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      title="Delete memory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Divider Line */}
              {index < memories.length - 1 && (
                <div className="border-t border-slate-700 my-0"></div>
              )}
            </React.Fragment>
          );
        })
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg mb-2">No memories yet</p>
          <p className="text-slate-500 text-sm">
            Memories will appear here as you have conversations with this agent
          </p>
        </div>
      )}
    </div>
  );
}