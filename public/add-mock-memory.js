/**
 * Simple script to add mock memory data
 * Run this in the browser console if needed:
 * 
 * fetch('/add-mock-memory.js').then(r=>r.text()).then(eval)
 */

async function addMockMemoryToAgent(agentId) {
  // This assumes you have supabase client available globally
  const { createClient } = window.supabase;
  const supabase = createClient(
    window.location.origin.includes('localhost') 
      ? 'your-supabase-url' 
      : 'your-supabase-url',
    'your-supabase-anon-key'
  );

  try {
    console.log('🧠 Adding mock memory data for agent:', agentId);

    // Add mock medium-term memories
    const mockMemories = [
      {
        agent_id: agentId,
        content: 'User: Hi Donald, I\'m working on a React project and need help with state management.\nAI: I\'d be happy to help you with React state management! What specific challenges are you facing?',
        summary: 'User needs help with React state management in their project',
        topic: 'React Development',
        keywords: ['react', 'state', 'management', 'project', 'development'],
        importance_score: 0.8
      },
      {
        agent_id: agentId,
        content: 'User: Can you explain how useEffect works in React?\nAI: useEffect is a React Hook that lets you perform side effects in function components. It runs after every render by default.',
        summary: 'Explained useEffect Hook functionality and usage patterns',
        topic: 'React Hooks',
        keywords: ['useEffect', 'hooks', 'react', 'components', 'render'],
        importance_score: 0.7
      },
      {
        agent_id: agentId,
        content: 'User: I love working with TypeScript! It makes my code so much safer.\nAI: TypeScript is fantastic! The type safety really helps catch errors early and makes refactoring much more confident.',
        summary: 'User expressed enthusiasm for TypeScript development',
        topic: 'TypeScript',
        keywords: ['typescript', 'safety', 'development', 'refactoring'],
        importance_score: 1.0 // Pinned memory
      }
    ];

    const { data: memories, error: memoryError } = await supabase
      .from('agent_medium_memories')
      .insert(mockMemories)
      .select();

    if (memoryError) {
      console.error('Error adding memories:', memoryError);
      return;
    }

    console.log(`✅ Added ${memories.length} medium-term memories`);

    // Add mock topics
    const mockTopics = [
      {
        agent_id: agentId,
        topic: 'React Development',
        frequency_count: 5,
        last_mentioned_at: new Date().toISOString()
      },
      {
        agent_id: agentId,
        topic: 'TypeScript',
        frequency_count: 4,
        last_mentioned_at: new Date().toISOString()
      }
    ];

    const { data: topics, error: topicError } = await supabase
      .from('agent_memory_topics')
      .insert(mockTopics)
      .select();

    if (topicError) {
      console.error('Error adding topics:', topicError);
      return;
    }

    console.log(`✅ Added ${topics.length} topic frequency entries`);
    console.log('🎉 Mock memory data added successfully!');

  } catch (error) {
    console.error('❌ Error adding mock data:', error);
  }
}

// To use this script:
// 1. Find your agent ID from the network tab or console
// 2. Run: addMockMemoryToAgent('your-agent-id-here')
console.log('Mock memory script loaded. Usage: addMockMemoryToAgent("agent-id")');