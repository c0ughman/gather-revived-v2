import { geminiLiveService } from './geminiLiveService';
import { AIContact } from '../../../core/types/types';

/**
 * CallPreloadManager
 *
 * Manages optimistic voice call preloading with the following rules:
 * 1. Max 2 simultaneous preloads (chat agent + hover agent)
 * 2. Chat agent has priority over hover
 * 3. Cleanup oldest when starting a 3rd preload
 * 4. Track preload state to avoid duplicate initializations
 */
class CallPreloadManager {
  private preloadedAgents: Map<string, {
    agentId: string;
    priority: 'chat' | 'hover';
    timestamp: number;
    isPreloaded: boolean;
  }> = new Map();

  private maxPreloads = 2;
  private isPreloading = false;

  /**
   * Preload call for an agent
   * @param agent - The agent to preload
   * @param priority - 'chat' for current chat agent, 'hover' for hovered agent
   */
  public async preloadCall(agent: AIContact, priority: 'chat' | 'hover'): Promise<void> {
    // Check if already preloaded or currently preloading
    if (this.preloadedAgents.has(agent.id)) {
      const existing = this.preloadedAgents.get(agent.id);

      // If already preloaded and priority is higher, just update priority
      if (existing && priority === 'chat' && existing.priority === 'hover') {
        console.log(`🔄 Upgrading priority for ${agent.name} from hover to chat`);
        existing.priority = 'chat';
        existing.timestamp = Date.now();
        return;
      }

      console.log(`✅ ${agent.name} already preloaded, skipping`);
      return;
    }

    // If we're at the limit, remove the oldest/lowest priority preload
    if (this.preloadedAgents.size >= this.maxPreloads) {
      this.cleanupOldestPreload(priority);
    }

    // Add to tracking before starting preload
    this.preloadedAgents.set(agent.id, {
      agentId: agent.id,
      priority,
      timestamp: Date.now(),
      isPreloaded: false
    });

    console.log(`🚀 Preloading call for ${agent.name} (${priority} priority)`);

    try {
      const startTime = Date.now();

      // PHASE 1: Initialize audio context and microphone permission
      console.log(`🎤 [Preload] Initializing audio for ${agent.name}...`);
      const audioSuccess = await geminiLiveService.initialize();

      if (!audioSuccess) {
        console.warn(`⚠️ Failed to initialize audio for ${agent.name}`);
        this.preloadedAgents.delete(agent.id);
        return;
      }

      const audioTime = Date.now() - startTime;
      console.log(`✅ [Preload] Audio initialized in ${audioTime}ms`);

      // PHASE 2: Start the Gemini session (this is the expensive part!)
      console.log(`🔌 [Preload] Starting Gemini session for ${agent.name}...`);
      await geminiLiveService.startSession(agent);

      const totalTime = Date.now() - startTime;
      console.log(`✅ [Preload] Session started in ${totalTime}ms (audio: ${audioTime}ms, session: ${totalTime - audioTime}ms)`);

      // Mark as successfully preloaded
      const preload = this.preloadedAgents.get(agent.id);
      if (preload) {
        preload.isPreloaded = true;
      }
      console.log(`🎉 Call fully preloaded for ${agent.name} - ready for instant connection!`);
    } catch (error) {
      console.error(`❌ Error preloading call for ${agent.name}:`, error);
      this.preloadedAgents.delete(agent.id);

      // Try to end the session if it was started
      try {
        await geminiLiveService.endSession();
      } catch (endError) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Cancel preload for an agent (e.g., when user stops hovering)
   * @param agentId - The agent ID to cancel preload for
   * @param priority - Only cancel if priority matches
   */
  public cancelPreload(agentId: string, priority?: 'chat' | 'hover'): void {
    const preload = this.preloadedAgents.get(agentId);

    if (!preload) {
      return;
    }

    // If priority is specified, only cancel if it matches
    if (priority && preload.priority !== priority) {
      console.log(`⏭️ Not canceling preload for ${agentId} - priority mismatch (${preload.priority} vs ${priority})`);
      return;
    }

    // Don't cancel chat priority preloads
    if (preload.priority === 'chat') {
      console.log(`🛡️ Not canceling chat preload for ${agentId}`);
      return;
    }

    console.log(`🧹 Canceling preload for agent ${agentId}`);
    this.preloadedAgents.delete(agentId);
  }

  /**
   * Check if an agent is preloaded and session is still active
   */
  public isPreloaded(agentId: string): boolean {
    const preload = this.preloadedAgents.get(agentId);

    // Check if preloaded AND session is still active
    if (preload?.isPreloaded) {
      // Verify the session is actually still active
      const sessionActive = geminiLiveService.checkSessionActive();

      if (!sessionActive) {
        // Session was ended, remove from preload tracking
        console.log(`🧹 Session for ${agentId} was ended, removing from preload cache`);
        this.preloadedAgents.delete(agentId);
        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Consume a preloaded session (mark it as used and remove from tracking)
   */
  public consumePreload(agentId: string): void {
    console.log(`✅ Consuming preload for agent ${agentId}`);
    this.preloadedAgents.delete(agentId);
  }

  /**
   * Get preload info for debugging
   */
  public getPreloadInfo(): Array<{
    agentId: string;
    priority: 'chat' | 'hover';
    timestamp: number;
    isPreloaded: boolean;
  }> {
    return Array.from(this.preloadedAgents.values());
  }

  /**
   * Cleanup oldest or lowest priority preload
   */
  private cleanupOldestPreload(incomingPriority: 'chat' | 'hover'): void {
    if (this.preloadedAgents.size === 0) {
      return;
    }

    // If incoming is chat priority, remove oldest hover
    if (incomingPriority === 'chat') {
      const hoverPreloads = Array.from(this.preloadedAgents.entries())
        .filter(([_, preload]) => preload.priority === 'hover')
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      if (hoverPreloads.length > 0) {
        const [oldestId] = hoverPreloads[0];
        console.log(`🧹 Removing oldest hover preload: ${oldestId}`);
        this.preloadedAgents.delete(oldestId);
        return;
      }
    }

    // Otherwise, remove the oldest preload regardless of priority
    const sortedPreloads = Array.from(this.preloadedAgents.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    if (sortedPreloads.length > 0) {
      const [oldestId] = sortedPreloads[0];
      console.log(`🧹 Removing oldest preload: ${oldestId}`);
      this.preloadedAgents.delete(oldestId);
    }
  }

  /**
   * Clear all preloads (for cleanup on logout, etc.)
   */
  public clearAll(): void {
    console.log(`🧹 Clearing all ${this.preloadedAgents.size} preloaded calls`);
    this.preloadedAgents.clear();
  }
}

// Export singleton instance
export const callPreloadManager = new CallPreloadManager();
