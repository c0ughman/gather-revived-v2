/**
 * Script to add mock memory data for testing
 * Run with: node scripts/add-mock-memory-data.js
 */

import { createClient } from '@supabase/supabase-js';

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addMockMemoryData() {
  try {
    console.log('🔍 Looking for Donald Agent...');
    
    // First, find the Donald Agent
    const { data: agents, error: agentError } = await supabase
      .from('user_agents')
      .select('*')
      .ilike('name', '%donald%');

    if (agentError) {
      console.error('Error finding agents:', agentError);
      return;
    }

    if (!agents || agents.length === 0) {
      console.log('❌ No Donald Agent found. Creating one...');
      
      // Create Donald Agent
      const { data: newAgent, error: createError } = await supabase
        .from('user_agents')
        .insert({
          name: 'Donald Agent',
          description: 'A helpful AI assistant for testing memory features',
          initials: 'DA',
          color: '#ff6b35',
          voice: 'Puck',
          status: 'online'
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating Donald Agent:', createError);
        return;
      }

      agents.push(newAgent);
      console.log('✅ Created Donald Agent');
    }

    const donaldAgent = agents[0];
    console.log(`✅ Found Donald Agent with ID: ${donaldAgent.id}`);

    // Add mock medium-term memories
    const mockMemories = [
      {
        agent_id: donaldAgent.id,
        content: 'User: Hi Donald, I\'m working on a React project and need help with state management.\nAI: I\'d be happy to help you with React state management! What specific challenges are you facing?',
        summary: 'User needs help with React state management in their project',
        topic: 'React Development',
        keywords: ['react', 'state', 'management', 'project', 'development'],
        importance_score: 0.8
      },
      {
        agent_id: donaldAgent.id,
        content: 'User: Can you explain how useEffect works in React?\nAI: useEffect is a React Hook that lets you perform side effects in function components. It runs after every render by default.',
        summary: 'Explained useEffect Hook functionality and usage patterns',
        topic: 'React Hooks',
        keywords: ['useEffect', 'hooks', 'react', 'components', 'render'],
        importance_score: 0.7
      },
      {
        agent_id: donaldAgent.id,
        content: 'User: I love working with TypeScript! It makes my code so much safer.\nAI: TypeScript is fantastic! The type safety really helps catch errors early and makes refactoring much more confident.',
        summary: 'User expressed enthusiasm for TypeScript development',
        topic: 'TypeScript',
        keywords: ['typescript', 'safety', 'development', 'refactoring'],
        importance_score: 1.0 // Pinned memory
      },
      {
        agent_id: donaldAgent.id,
        content: 'User: What\'s the best way to handle API calls in React?\nAI: There are several approaches: you can use fetch with useEffect, libraries like axios, or data fetching libraries like React Query or SWR.',
        summary: 'Discussed API call patterns and data fetching strategies',
        topic: 'API Integration',
        keywords: ['fetch', 'axios', 'react-query', 'hooks'],
        importance_score: 0.6
      },
      {
        agent_id: donaldAgent.id,
        content: 'User: I\'m building a memory system for AI agents.\nAI: That sounds like a fascinating project! Memory systems can really enhance the conversational experience by providing context and continuity.',
        summary: 'User is working on AI agent memory system development',
        topic: 'AI Development',
        keywords: ['memory', 'system', 'agents', 'context', 'continuity'],
        importance_score: 0.9
      }
    ];

    console.log('📝 Adding mock medium-term memories...');
    const { data: memories, error: memoryError } = await supabase
      .from('agent_medium_memories')
      .insert(mockMemories)
      .select();

    if (memoryError) {
      console.error('Error adding memories:', memoryError);
      return;
    }

    console.log(`✅ Added ${memories.length} medium-term memories`);

    // Add mock topic frequency data
    const mockTopics = [
      {
        agent_id: donaldAgent.id,
        topic: 'React Development',
        frequency_count: 5,
        last_mentioned_at: new Date().toISOString()
      },
      {
        agent_id: donaldAgent.id,
        topic: 'React Hooks',
        frequency_count: 3,
        last_mentioned_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      },
      {
        agent_id: donaldAgent.id,
        topic: 'TypeScript',
        frequency_count: 4,
        last_mentioned_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        agent_id: donaldAgent.id,
        topic: 'API Integration',
        frequency_count: 2,
        last_mentioned_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
      },
      {
        agent_id: donaldAgent.id,
        topic: 'AI Development',
        frequency_count: 1,
        last_mentioned_at: new Date().toISOString()
      }
    ];

    console.log('📊 Adding mock topic frequency data...');
    const { data: topics, error: topicError } = await supabase
      .from('agent_memory_topics')
      .insert(mockTopics)
      .select();

    if (topicError) {
      console.error('Error adding topics:', topicError);
      return;
    }

    console.log(`✅ Added ${topics.length} topic frequency entries`);

    // Add a mock paper note
    const mockPaperNote = {
      agent_id: donaldAgent.id,
      title: 'React Best Practices',
      content: 'Key points discussed:\n- Always use keys in lists\n- Keep components small and focused\n- Use TypeScript for better development experience\n- Consider using React Query for data fetching\n- Implement proper error boundaries',
      note_type: 'summary',
      tags: ['react', 'best-practices', 'development'],
      is_pinned: true
    };

    console.log('📋 Adding mock paper note...');
    const { data: note, error: noteError } = await supabase
      .from('agent_paper_notes')
      .insert(mockPaperNote)
      .select();

    if (noteError) {
      console.error('Error adding paper note:', noteError);
      return;
    }

    console.log('✅ Added paper note');

    // Initialize memory usage tracking
    console.log('📈 Initializing memory usage tracking...');
    const { error: usageError } = await supabase
      .from('agent_memory_usage')
      .insert({
        agent_id: donaldAgent.id
      });

    if (usageError && !usageError.message.includes('duplicate')) {
      console.error('Error initializing memory usage:', usageError);
    } else {
      console.log('✅ Memory usage tracking initialized');
    }

    console.log('\n🎉 Mock memory data added successfully!');
    console.log('\nYou can now test the memory system with Donald Agent:');
    console.log('1. Start a conversation with Donald Agent');
    console.log('2. Click the Brain icon to view memories');
    console.log('3. Notice how previous topics are referenced in AI responses');
    console.log('4. The pinned TypeScript memory will be prioritized');

  } catch (error) {
    console.error('❌ Error adding mock data:', error);
  }
}

// Run the script
addMockMemoryData();