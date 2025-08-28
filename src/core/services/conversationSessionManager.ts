/**
 * Conversation Session Manager
 * 
 * Handles automatic conversation saving to database and memory extraction
 * Triggers on: 1min inactivity, new chat, agent switch, screen leave, tab close
 */

import { supabase } from '../../modules/database/lib/supabase';
import { conversationHistoryService } from './conversationHistoryService';
import { memoryService } from './memoryService';
import { enhancedAiService } from '../../modules/fileManagement/services/enhancedAiService';
import { pythonApiService } from './pythonApiService';
import { AIContact, Message } from '../types/types';

interface ActiveSession {
  id: string | null; // Database session ID, null until first save
  agentId: string;
  userId: string;
  messages: Message[];
  startedAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

interface MemoryInsight {
  information: string;
  topic: string;
  importance: 'low' | 'medium' | 'high';
  type: 'fact' | 'concept' | 'preference' | 'insight' | 'summary';
}

class ConversationSessionManager {
  private activeSession: ActiveSession | null = null;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private readonly INACTIVITY_TIMEOUT = 60000; // 1 minute

  /**
   * Start a new conversation session
   */
  startSession(agent: AIContact, userId: string): void {
    console.log(`🔄 Starting new conversation session with ${agent.name}`);
    
    // Save any existing session before starting new one
    if (this.activeSession?.isActive) {
      this.saveCurrentSession();
    }

    this.activeSession = {
      id: null,
      agentId: agent.id,
      userId: userId,
      messages: [],
      startedAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    this.resetInactivityTimer();
  }

  /**
   * Add a message to the current session
   */
  addMessage(message: Message): void {
    if (!this.activeSession?.isActive) {
      console.warn('No active session to add message to');
      return;
    }

    this.activeSession.messages.push(message);
    this.activeSession.lastActivity = new Date();
    
    // Reset inactivity timer after AI response
    if (message.sender === 'ai') {
      this.resetInactivityTimer();
    }

    console.log(`💬 Added ${message.sender} message to session (${this.activeSession.messages.length} total)`);
  }

  /**
   * Reset the inactivity timer
   */
  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      console.log('⏰ 1 minute inactivity detected, saving conversation...');
      this.saveCurrentSession();
    }, this.INACTIVITY_TIMEOUT);
  }

  /**
   * Manually trigger session save (for immediate triggers)
   */
  saveCurrentSession(): void {
    if (!this.activeSession?.isActive || this.activeSession.messages.length === 0) {
      console.log('No active session with messages to save');
      return;
    }

    console.log(`💾 Saving conversation session with ${this.activeSession.messages.length} messages`);
    
    // Set session as inactive immediately
    this.activeSession.isActive = false;
    
    // Clear inactivity timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    // Save to database and extract memories asynchronously
    this.saveToDatabaseAndExtractMemories(this.activeSession);
    
    // Clear the session
    this.activeSession = null;
  }

  /**
   * Save conversation to database and extract memories
   */
  private async saveToDatabaseAndExtractMemories(session: ActiveSession): Promise<void> {
    try {
      // Step 1: Create conversation session in database
      const conversationSession = await this.createDatabaseSession(session);
      
      // Step 2: Save all messages to database
      await this.saveMessagesToDatabase(conversationSession.id, session.messages);
      
      // Step 3: Extract memories from conversation using LLM
      await this.extractMemoriesFromConversation(session);
      
      console.log(`✅ Successfully saved conversation and extracted memories`);
      
    } catch (error) {
      console.error('❌ Error saving conversation session:', error);
    }
  }

  /**
   * Create conversation session in database
   */
  private async createDatabaseSession(session: ActiveSession): Promise<{ id: string }> {
    const conversationType = this.determineConversationType(session.messages);
    const duration = Math.floor((session.lastActivity.getTime() - session.startedAt.getTime()) / 1000);

    const { data, error } = await supabase
      .from('conversation_sessions')
      .insert({
        agent_id: session.agentId,
        user_id: session.userId,
        conversation_type: conversationType,
        message_count: session.messages.length,
        duration_seconds: duration,
        started_at: session.startedAt.toISOString(),
        last_message_at: session.lastActivity.toISOString(),
        ended_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Save messages to database
   */
  private async saveMessagesToDatabase(sessionId: string, messages: Message[]): Promise<void> {
    const conversationMessages = messages.map((msg, index) => ({
      session_id: sessionId,
      content: msg.content,
      role: msg.sender === 'user' ? 'user' : 'assistant',
      message_type: 'text', // For now, assuming text messages
      attachments: msg.attachments || [],
      created_at: new Date(msg.timestamp).toISOString()
    }));

    const { error } = await supabase
      .from('conversation_messages')
      .insert(conversationMessages);

    if (error) throw error;
  }

  /**
   * Extract memories from conversation using LLM
   */
  private async extractMemoriesFromConversation(session: ActiveSession): Promise<void> {
    console.log(`🔍 Starting memory extraction for ${session.messages.length} messages`);
    
    if (session.messages.length < 2) {
      console.log('Conversation too short for memory extraction');
      return;
    }

    try {
      // Build conversation text for LLM analysis
      const conversationText = this.buildConversationText(session.messages);
      console.log(`📝 Conversation text length: ${conversationText.length} characters`);
      
      // Create LLM prompt for memory extraction
      const extractionPrompt = this.buildMemoryExtractionPrompt(conversationText);
      console.log(`🎯 Sending memory extraction prompt to LLM...`);
      
      // Call LLM for memory extraction
      const insights = await this.callLLMForMemoryExtraction(extractionPrompt);
      console.log(`📊 LLM returned ${insights?.length || 0} insights:`, insights);
      
      // Save extracted memories
      if (insights && insights.length > 0) {
        await this.saveExtractedMemories(session.agentId, insights);
        console.log(`🧠 Successfully saved ${insights.length} memories from conversation`);
      } else {
        console.log('🤷 No significant memories extracted from conversation');
      }
      
    } catch (error) {
      console.error('❌ Error extracting memories from conversation:', error);
    }
  }

  /**
   * Build conversation text for LLM analysis
   */
  private buildConversationText(messages: Message[]): string {
    return messages.map(msg => {
      // Ensure proper attribution: User vs AI (not the agent name)
      const sender = msg.sender === 'user' ? 'User' : 'AI';
      // Remove timestamp for cleaner analysis - focus on content
      return `${sender}: ${msg.content}`;
    }).join('\n\n');
  }

  /**
   * Build LLM prompt for memory extraction
   */
  private buildMemoryExtractionPrompt(conversationText: string): string {
    return `Analyze this conversation and extract any useful information about the USER that should be remembered for future conversations. 

IMPORTANT: The conversation below shows "User:" for the human user and "AI:" for the AI assistant. Focus ONLY on information ABOUT THE USER, not what the AI said.

CONVERSATION:
${conversationText}

EXTRACT MEMORIES ABOUT THE USER:
1. User preferences (likes, dislikes, choices, opinions)
2. User information (work, location, interests, background, skills)
3. User knowledge (what they understand/know)
4. User projects (what they're working on, goals)
5. Important facts the user mentioned about themselves
6. User behavior patterns and communication style

RESPONSE FORMAT: JSON array of memory objects. Each memory should have:
{
  "information": "Clear, specific statement about the user to remember",
  "topic": "Category/subject (e.g., 'preferences', 'work', 'projects')", 
  "importance": "low|medium|high",
  "type": "fact|concept|preference|insight|summary"
}

CRITICAL GUIDELINES:
- Extract 0-5 memories (default to 0 if nothing significant about the user)
- Focus ONLY on information ABOUT THE USER (not AI responses)
- Be specific and actionable for future conversations
- Avoid duplicating common knowledge
- Each memory should help personalize future interactions
- Do NOT extract what the AI said, only facts about the user

RESPONSE (JSON only, no other text):`;
  }

  /**
   * Call LLM for memory extraction
   */
  private async callLLMForMemoryExtraction(prompt: string): Promise<MemoryInsight[]> {
    try {
      console.log(`🤖 Attempting memory extraction with fallback strategy...`);
      
      // Try Python backend first
      try {
        console.log(`🐍 Trying Python backend for memory extraction...`);
        const backendAvailable = await pythonApiService.isAvailable();
        
        if (backendAvailable) {
          const memoryExtractionContact: AIContact = {
            id: 'memory-extraction',
            name: 'Memory Extractor',
            description: 'Extract insights from conversations',
            color: '#000000',
            integrations: []
          };
          
          const result = await pythonApiService.generateAIResponse(
            memoryExtractionContact,
            prompt,
            [], // Empty chat history
            [] // No documents
          );
          
          return this.parseMemoryResponse(result.response);
        }
      } catch (backendError) {
        console.warn('🚫 Python backend not available for memory extraction:', backendError);
      }
      
      // Fallback to direct Gemini API call
      console.log(`🤖 Using direct Gemini API for memory extraction...`);
      const response = await this.callGeminiDirectly(prompt);
      return this.parseMemoryResponse(response);
      
    } catch (error) {
      console.error('❌ Error calling LLM for memory extraction:', error);
      return [];
    }
  }

  /**
   * Direct Gemini API call for memory extraction fallback
   */
  private async callGeminiDirectly(prompt: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API call failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  }

  /**
   * Parse memory extraction response from LLM
   */
  private parseMemoryResponse(response: string): MemoryInsight[] {
    console.log(`📥 LLM response received (${response.length} chars):`, response.substring(0, 500) + '...');

    // Parse JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('❌ No JSON array found in LLM response:', response);
      return [];
    }

    console.log(`🔍 Found JSON match:`, jsonMatch[0]);
    try {
      const insights: MemoryInsight[] = JSON.parse(jsonMatch[0]);
      console.log(`✅ Parsed ${insights.length} insights from LLM`);
      
      // Validate insights
      const validInsights = insights.filter(insight => 
        insight.information && 
        insight.topic && 
        ['low', 'medium', 'high'].includes(insight.importance) &&
        ['fact', 'concept', 'preference', 'insight', 'summary'].includes(insight.type)
      );
      
      console.log(`✅ ${validInsights.length} valid insights after filtering`);
      return validInsights;
    } catch (parseError) {
      console.error('❌ Failed to parse JSON insights:', parseError);
      return [];
    }
  }

  /**
   * Save extracted memories to database
   */
  private async saveExtractedMemories(agentId: string, insights: MemoryInsight[]): Promise<void> {
    for (const insight of insights) {
      try {
        await memoryService.saveMemoryFromAI(agentId, insight);
      } catch (error) {
        console.error('Error saving extracted memory:', error);
      }
    }
  }

  /**
   * Determine conversation type from messages
   */
  private determineConversationType(messages: Message[]): 'chat' | 'voice' | 'mixed' {
    if (messages.length === 0) return 'chat';
    
    const voiceMessages = messages.filter(msg => 
      msg.messageType === 'voice' || 
      msg.metadata?.source === 'voice' ||
      msg.metadata?.conversationType === 'voice'
    );
    
    const chatMessages = messages.filter(msg => 
      !msg.messageType || 
      msg.messageType === 'text' || 
      msg.metadata?.source === 'chat'
    );
    
    if (voiceMessages.length > 0 && chatMessages.length > 0) {
      return 'mixed';
    } else if (voiceMessages.length > 0) {
      return 'voice';
    } else {
      return 'chat';
    }
  }

  /**
   * Handle app/tab close - save immediately
   */
  handleAppClose(): void {
    console.log('🚪 App closing, saving current session...');
    this.saveCurrentSession();
  }

  /**
   * Handle screen/tab leave - save immediately
   */
  handleScreenLeave(): void {
    console.log('👋 Screen leave detected, saving current session...');
    this.saveCurrentSession();
  }

  /**
   * Get current session info (for debugging)
   */
  getCurrentSessionInfo(): { agentId: string | null; messageCount: number; isActive: boolean } | null {
    if (!this.activeSession) return null;
    
    return {
      agentId: this.activeSession.agentId,
      messageCount: this.activeSession.messages.length,
      isActive: this.activeSession.isActive
    };
  }

  /**
   * Manual trigger for testing memory extraction (DEBUG ONLY)
   */
  debugTriggerMemoryExtraction(): void {
    if (this.activeSession?.isActive && this.activeSession.messages.length > 0) {
      console.log('🧪 DEBUG: Manually triggering memory extraction...');
      this.saveCurrentSession();
    } else {
      console.log('🧪 DEBUG: No active session to extract memories from');
    }
  }

  /**
   * Save voice conversation with transcript from backend
   * This is called when a voice call ends
   */
  async saveVoiceConversation(
    agent: AIContact, 
    userId: string, 
    transcript: { messages: any[], metadata: any }
  ): Promise<void> {
    try {
      console.log(`🎙️ Saving voice conversation with ${transcript.messages.length} messages`);
      
      if (transcript.messages.length === 0) {
        console.log('No messages in voice conversation, skipping save');
        return;
      }

      // Convert backend transcript messages to our Message format
      const messages: Message[] = transcript.messages.map((msg: any, index: number) => ({
        id: msg.id || `voice_${Date.now()}_${index}`,
        content: msg.content || msg.text || '',
        sender: msg.role === 'user' ? 'user' : 'ai',
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        contactId: agent.id,
        messageType: 'voice' as any,
        metadata: {
          source: 'voice',
          conversationType: 'voice',
          ...msg.metadata
        }
      }));

      // Create a temporary session for this voice conversation
      const voiceSession: ActiveSession = {
        id: null,
        agentId: agent.id,
        userId: userId,
        messages: messages,
        startedAt: transcript.metadata?.started_at ? new Date(transcript.metadata.started_at) : new Date(Date.now() - (messages.length * 30000)), // Estimate start time
        lastActivity: messages.length > 0 ? messages[messages.length - 1].timestamp : new Date(),
        isActive: false // Already completed
      };

      console.log(`💾 Processing voice conversation with ${messages.length} messages for memory extraction`);
      
      // Save directly to database and extract memories
      await this.saveToDatabaseAndExtractMemories(voiceSession);
      
      console.log(`✅ Voice conversation saved and memories extracted successfully`);
      
    } catch (error) {
      console.error('❌ Error saving voice conversation:', error);
    }
  }
}

export const conversationSessionManager = new ConversationSessionManager();