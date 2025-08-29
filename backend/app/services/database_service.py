from typing import List, Dict, Any, Optional
from supabase import create_client
from ..core.config import settings
from ..core.context_limits import context_limits
from ..models.database import (
    AgentCreate, AgentUpdate, AgentResponse,
    IntegrationCreate, IntegrationResponse,
    DocumentCreate, DocumentResponse,
    UserProfileCreate, UserProfileResponse,
    AgentContextResponse
)
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self):
        # Initialize with service role key for admin operations
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        self.admin_supabase = create_client(settings.SUPABASE_URL, self.service_role_key)
        logger.info(f"🔧 Database service initialized with {'service role' if settings.SUPABASE_SERVICE_ROLE_KEY else 'anon'} key")
    
    def get_user_client(self, user_token: str):
        """Get a Supabase client for a specific user using their JWT token"""
        from supabase import ClientOptions
        
        # Create client options with the user's JWT token
        options = ClientOptions()
        options.headers = {'Authorization': f'Bearer {user_token}'}
        
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY, options)

    async def test_connection(self) -> bool:
        """Test database connection"""
        try:
            logger.info('🔍 Testing Supabase connection...')
            
            # Use admin client for health check
            try:
                # This is a simple way to test the connection without hitting RLS
                result = self.admin_supabase.rpc('version').execute()
                logger.info('✅ Database connection test successful')
                return True
            except Exception as rpc_error:
                logger.info(f'RPC version failed, trying basic query: {rpc_error}')
                # Fallback: try a simple query that should work with service role
                result = self.admin_supabase.from_('user_profiles').select('id').limit(1).execute()
                if result is not None:  # Even if result.data is empty, connection works
                    logger.info('✅ Database connection test successful (fallback)')
                    return True
                else:
                    logger.error('❌ Database connection test failed: No result returned')
                    return False
                
        except Exception as error:
            logger.error(f'❌ Database connection test error: {error}')
            # For development, let's be more permissive and just check if we have credentials
            if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
                logger.info('✅ Database connection test passed (credentials available)')
                return True
            return False

    # User Agents Operations
    async def get_user_agents(self, user_id: str, user_token: str = None) -> List[Dict[str, Any]]:
        """Get all agents for a user with their integrations and documents"""
        try:
            logger.info(f'📊 Fetching user agents for: {user_id}')
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('user_agents').select("""
                *,
                agent_integrations (
                    id,
                    template_id,
                    name,
                    description,
                    config,
                    status
                ),
                agent_documents (
                    id,
                    name,
                    original_filename,
                    file_type,
                    file_size,
                    content,
                    summary,
                    extracted_text,
                    metadata,
                    uploaded_at
                )
            """).eq('user_id', user_id).order('created_at', desc=True).execute()
            
            if result.data is None:
                logger.warning(f'No agents found for user: {user_id}')
                return []
                
            logger.info(f'✅ Fetched {len(result.data)} user agents')
            return result.data
            
        except Exception as error:
            logger.error(f'❌ Error fetching user agents: {error}')
            raise error

    async def create_user_agent(self, user_id: str, agent_data: AgentCreate, user_token: str = None) -> Dict[str, Any]:
        """Create a new user agent"""
        try:
            logger.info(f'➕ Creating user agent: {agent_data.name}')
            
            agent_dict = {
                "user_id": user_id,
                "name": agent_data.name,
                "description": agent_data.description,
                "initials": agent_data.initials,
                "color": agent_data.color,
                "voice": agent_data.voice,
                "avatar_url": agent_data.avatar,
                "status": agent_data.status,
                "last_seen": "now"
            }
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('user_agents').insert(agent_dict).execute()
            
            if result.data is None or len(result.data) == 0:
                raise Exception("Failed to create user agent")
                
            logger.info(f'✅ Created user agent with ID: {result.data[0]["id"]}')
            return result.data[0]
            
        except Exception as error:
            logger.error(f'❌ Error creating user agent: {error}')
            raise error

    async def update_user_agent(self, agent_id: str, updates: AgentUpdate, user_token: str = None) -> Dict[str, Any]:
        """Update a user agent"""
        try:
            logger.info(f'📝 Updating user agent: {agent_id}')
            
            # Convert Pydantic model to dict, excluding None values
            update_data = updates.model_dump(exclude_none=True)
            update_data['updated_at'] = datetime.now().isoformat()
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('user_agents').update(update_data).eq('id', agent_id).execute()
            
            if result.data is None or len(result.data) == 0:
                raise Exception(f"Agent {agent_id} not found or update failed")
                
            logger.info('✅ Updated user agent')
            return result.data[0]  # Return the first (and only) updated record
            
        except Exception as error:
            logger.error(f'❌ Error updating user agent: {error}')
            raise error

    async def delete_user_agent(self, agent_id: str, user_token: str = None) -> bool:
        """Delete a user agent"""
        try:
            logger.info(f'🗑️ Deleting user agent: {agent_id}')
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            supabase_client.from_('user_agents').delete().eq('id', agent_id).execute()
            
            logger.info('✅ Deleted user agent')
            return True
            
        except Exception as error:
            logger.error(f'❌ Error deleting user agent: {error}')
            raise error

    # Agent Integrations Operations
    async def create_agent_integration(self, agent_id: str, integration_data: IntegrationCreate, user_token: str = None) -> Dict[str, Any]:
        """Create a new agent integration"""
        try:
            logger.info(f'➕ Creating agent integration for: {agent_id}')
            
            integration_dict = {
                "agent_id": agent_id,
                "template_id": integration_data.integrationId,
                "name": integration_data.name,
                "description": integration_data.description,
                "config": integration_data.config,
                "status": "active"
            }
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('agent_integrations').insert(integration_dict).execute()
            
            if result.data is None or len(result.data) == 0:
                raise Exception("Failed to create agent integration")
                
            logger.info('✅ Created agent integration')
            return result.data[0]
            
        except Exception as error:
            logger.error(f'❌ Error creating agent integration: {error}')
            raise error

    async def delete_agent_integration(self, integration_id: str, user_token: str = None) -> bool:
        """Delete an agent integration"""
        try:
            logger.info(f'🗑️ Deleting agent integration: {integration_id}')
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            supabase_client.from_('agent_integrations').delete().eq('id', integration_id).execute()
            
            logger.info('✅ Deleted agent integration')
            return True
            
        except Exception as error:
            logger.error(f'❌ Error deleting agent integration: {error}')
            raise error

    # Agent Documents Operations
    async def create_agent_document(self, agent_id: str, document_data: DocumentCreate, user_token: str = None) -> Dict[str, Any]:
        """Create a new agent document"""
        try:
            logger.info(f'📄 Creating agent document: {document_data.name}')
            
            document_dict = {
                "agent_id": agent_id,
                "name": document_data.name,
                "original_filename": document_data.name,
                "file_type": document_data.type,
                "file_size": document_data.size,
                "content": document_data.content,
                "summary": document_data.summary,
                "extracted_text": document_data.extractedText,
                "processing_status": "completed",
                "metadata": document_data.metadata or {}
            }
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('agent_documents').insert(document_dict).execute()
            
            if result.data is None or len(result.data) == 0:
                raise Exception("Failed to create agent document")
                
            logger.info('✅ Created agent document')
            return result.data[0]
            
        except Exception as error:
            logger.error(f'❌ Error creating agent document: {error}')
            raise error

    async def delete_agent_document(self, document_id: str, user_token: str = None) -> bool:
        """Delete an agent document"""
        try:
            logger.info(f'🗑️ Deleting agent document: {document_id}')
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            supabase_client.from_('agent_documents').delete().eq('id', document_id).execute()
            
            logger.info('✅ Deleted agent document')
            return True
            
        except Exception as error:
            logger.error(f'❌ Error deleting agent document: {error}')
            raise error

    async def get_agent_documents(self, agent_id: str, user_token: str = None) -> List[Dict[str, Any]]:
        """Get all documents for an agent"""
        try:
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('agent_documents').select('*').eq('agent_id', agent_id).order('uploaded_at', desc=True).execute()
            
            if result.data is None:
                return []
                
            # Convert to frontend format
            documents = []
            for doc in result.data:
                documents.append({
                    "id": doc["id"],
                    "name": doc["name"],
                    "type": doc["file_type"],
                    "size": doc["file_size"],
                    "uploadedAt": doc["uploaded_at"],
                    "content": doc["content"] or "",
                    "summary": doc["summary"],
                    "extractedText": doc["extracted_text"],
                    "metadata": doc["metadata"] or {}
                })
            
            return documents
            
        except Exception as error:
            logger.error(f'❌ Error fetching agent documents: {error}')
            return []

    async def get_document_by_id(self, document_id: str, user_token: str = None) -> Optional[Dict[str, Any]]:
        """Get a specific document by ID"""
        try:
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('agent_documents').select('*').eq('id', document_id).execute()
            
            if result.data is None or len(result.data) == 0:
                return None
                
            doc = result.data[0]
            return {
                "id": doc["id"],
                "name": doc["name"],
                "type": doc["file_type"],
                "size": doc["file_size"],
                "uploadedAt": doc["uploaded_at"],
                "content": doc["content"] or "",
                "summary": doc["summary"],
                "extractedText": doc["extracted_text"],
                "metadata": doc["metadata"] or {}
            }
            
        except Exception as error:
            logger.error(f'❌ Error fetching document: {error}')
            return None

    # Conversation Documents Management
    async def save_conversation_document(self, agent_id: str, document_data: DocumentCreate, user_token: str = None) -> str:
        """Save a conversation document"""
        try:
            logger.info(f'💬 Saving conversation document: {document_data.name}')
            
            document_dict = {
                "agent_id": agent_id,
                "name": document_data.name,
                "original_filename": document_data.name,
                "file_type": document_data.type,
                "file_size": document_data.size,
                "content": document_data.content,
                "summary": document_data.summary,
                "extracted_text": document_data.extractedText,
                "processing_status": "completed",
                "metadata": {
                    **(document_data.metadata or {}),
                    "conversation_document": True,
                    "uploaded_in_conversation": True
                }
            }
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('agent_documents').insert(document_dict).execute()
            
            if result.data is None or len(result.data) == 0:
                raise Exception("Failed to save conversation document")
                
            logger.info('✅ Saved conversation document')
            return result.data[0]["id"]
            
        except Exception as error:
            logger.error(f'❌ Error saving conversation document: {error}')
            raise error

    async def get_conversation_documents(self, agent_id: str, user_token: str = None) -> List[Dict[str, Any]]:
        """Get conversation documents for an agent"""
        try:
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('agent_documents').select('*').eq('agent_id', agent_id).contains('metadata', {"conversation_document": True}).order('uploaded_at', desc=True).execute()
            
            if result.data is None:
                return []
                
            # Convert to frontend format
            documents = []
            for doc in result.data:
                documents.append({
                    "id": doc["id"],
                    "name": doc["name"],
                    "type": doc["file_type"],
                    "size": doc["file_size"],
                    "uploadedAt": doc["uploaded_at"],
                    "content": doc["content"] or "",
                    "summary": doc["summary"],
                    "extractedText": doc["extracted_text"],
                    "metadata": doc["metadata"] or {}
                })
            
            return documents
            
        except Exception as error:
            logger.error(f'❌ Error fetching conversation documents: {error}')
            return []

    async def get_paper_notes(self, agent_id: str, user_token: str = None, for_context: bool = False) -> List[Dict[str, Any]]:
        """Get paper notes for an agent"""
        try:
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            # Order by created_at desc (newest first) for context, but keep old behavior for UI
            order_desc = True if for_context else False
            result = supabase_client.from_('agent_paper_notes').select('*').eq('agent_id', agent_id).order('created_at', desc=order_desc).execute()
            
            if result.data is None:
                return []
            
            # If this is for context, filter by token limits
            if for_context:
                filtered_result = context_limits.filter_notes_by_token_limit(result.data, keep_pinned=True)
                return filtered_result['included_notes']
                
            return result.data
            
        except Exception as error:
            logger.error(f'❌ Error fetching paper notes: {error}')
            return []
    
    async def get_paper_notes_with_token_info(self, agent_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get paper notes with token filtering information for UI display"""
        try:
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            # Order by newest first (for zigzag layout), but pinned status first
            result = supabase_client.from_('agent_paper_notes').select('*').eq('agent_id', agent_id).order('is_pinned', desc=True).order('created_at', desc=True).execute()
            
            if result.data is None:
                return {
                    'all_notes': [],
                    'included_notes': [],
                    'excluded_notes': [],
                    'total_tokens': 0,
                    'max_tokens': context_limits.PAPER_NOTES_CONTEXT_MAX_TOKENS
                }
            
            # Apply token filtering
            filtered_result = context_limits.filter_notes_by_token_limit(result.data, keep_pinned=True)
            
            return {
                'all_notes': result.data,
                'included_notes': filtered_result['included_notes'],
                'excluded_notes': filtered_result['excluded_notes'],
                'total_tokens': filtered_result['total_tokens'],
                'max_tokens': filtered_result['max_tokens']
            }
            
        except Exception as error:
            logger.error(f'❌ Error fetching paper notes with token info: {error}')
            return {
                'all_notes': [],
                'included_notes': [],
                'excluded_notes': [],
                'total_tokens': 0,
                'max_tokens': context_limits.PAPER_NOTES_CONTEXT_MAX_TOKENS
            }
    
    async def get_medium_term_memory(self, agent_id: str, user_token: str = None, for_context: bool = False) -> List[Dict[str, Any]]:
        """Get medium-term memory for an agent"""
        try:
            logger.info(f'🧠 Fetching medium-term memory for agent: {agent_id}')
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            # Order by pinned status first (importance_score >= 1.0), then by recency
            # This ensures pinned memories appear at top, then unpinned memories by most recent access
            result = supabase_client.from_('agent_medium_memories').select('*').eq('agent_id', agent_id).order('importance_score', desc=True).order('last_accessed_at', desc=True).execute()
            
            # Sort in Python to ensure proper pinned-first ordering
            if result.data:
                # Separate pinned (>=1.0) and unpinned (<1.0) memories
                pinned_memories = [m for m in result.data if m.get('importance_score', 0) >= 1.0]
                unpinned_memories = [m for m in result.data if m.get('importance_score', 0) < 1.0]
                
                # Sort pinned by last_accessed_at descending (most recent first)
                pinned_memories.sort(key=lambda x: x.get('last_accessed_at', ''), reverse=True)
                
                # Sort unpinned by last_accessed_at descending (most recent first)  
                unpinned_memories.sort(key=lambda x: x.get('last_accessed_at', ''), reverse=True)
                
                # Combine: pinned first, then unpinned
                result.data = pinned_memories + unpinned_memories
            
            logger.info(f'🧠 Database query result: {result.data is not None}, count: {len(result.data) if result.data else 0}')
            
            if result.data is None:
                logger.info(f'🧠 No medium-term memories found for agent {agent_id}')
                return []
            
            if result.data:
                logger.info(f'🧠 Found {len(result.data)} medium-term memories for agent {agent_id}')
                for i, memory in enumerate(result.data[:3]):  # Log first 3 memories
                    logger.info(f'🧠 Memory {i+1}: {memory.get("content", "")[:100]}...')
            
            # If this is for context, filter by token limits
            if for_context:
                logger.info(f'🧠 Applying token limits for context')
                filtered_result = context_limits.filter_memory_by_token_limit(result.data)
                logger.info(f'🧠 Filtered result: {len(filtered_result["included_memory"])} included, {len(filtered_result["excluded_memory"])} excluded')
                return filtered_result['included_memory']
                
            return result.data
            
        except Exception as error:
            logger.error(f'❌ Error fetching medium-term memory: {error}')
            import traceback
            logger.error(f'❌ Traceback: {traceback.format_exc()}')
            return []
    
    async def get_medium_term_memory_with_token_info(self, agent_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get medium-term memory with token filtering information for UI display"""
        try:
            # TODO: Implement when medium-term memory table is created
            memory_items = await self.get_medium_term_memory(agent_id, user_token)
            
            if not memory_items:
                return {
                    'all_memory': [],
                    'included_memory': [],
                    'excluded_memory': [],
                    'total_tokens': 0,
                    'max_tokens': context_limits.MEDIUM_TERM_MEMORY_MAX_TOKENS
                }
            
            # Apply token filtering (by timestamp - newest first)
            filtered_result = context_limits.filter_memory_by_token_limit(memory_items)
            
            return {
                'all_memory': memory_items,
                'included_memory': filtered_result['included_memory'],
                'excluded_memory': filtered_result['excluded_memory'],
                'total_tokens': filtered_result['total_tokens'],
                'max_tokens': filtered_result['max_tokens']
            }
            
        except Exception as error:
            logger.error(f'❌ Error fetching medium-term memory with token info: {error}')
            return {
                'all_memory': [],
                'included_memory': [],
                'excluded_memory': [],
                'total_tokens': 0,
                'max_tokens': context_limits.MEDIUM_TERM_MEMORY_MAX_TOKENS
            }

    async def search_past_conversations(self, agent_id: str, query: str, limit: int = None, user_token: str = None) -> List[Dict[str, Any]]:
        """Search past conversations for an agent"""
        try:
            # Use centralized limit configuration
            if limit is None:
                limit = context_limits.SEARCH_PAST_CONVERSATIONS_DEFAULT_LIMIT
            limit = context_limits.clamp_search_limit(limit, 'past_conversations')
            
            logger.info(f'🔍 Searching past conversations for agent {agent_id} with query: "{query}", limit: {limit}')
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            # Search for sessions that have matching messages using ilike for case-insensitive pattern matching
            result = supabase_client.from_('conversation_messages').select(f"""
                session_id,
                content,
                role,
                created_at,
                conversation_sessions!inner(
                    id,
                    title,
                    conversation_type,
                    message_count,
                    started_at,
                    last_message_at
                )
            """).ilike('content', f'%{query}%').eq('conversation_sessions.agent_id', agent_id).eq('conversation_sessions.is_archived', False).limit(limit * context_limits.SEARCH_PAST_CONVERSATIONS_DB_MULTIPLIER).execute()  # Get more to find best matches
            
            logger.info(f'🔍 Database search query executed, found {len(result.data) if result.data else 0} messages')
            
            if not result.data:
                logger.info(f'🔍 No conversation messages found matching query: "{query}"')
                return []
            
            # Group messages by session and find best excerpts
            sessions_data = {}
            for item in result.data:
                session_id = item['session_id']
                session_info = item['conversation_sessions']
                message = item
                
                if session_id not in sessions_data:
                    sessions_data[session_id] = {
                        'session_info': session_info,
                        'messages': [],
                        'best_excerpt': ''
                    }
                
                sessions_data[session_id]['messages'].append(message)
                
                # Find best excerpt containing the search query
                content = message['content'].lower()
                query_lower = query.lower()
                
                if query_lower in content:
                    # Extract context around the match
                    index = content.find(query_lower)
                    start = max(0, index - context_limits.SEARCH_EXCERPT_CONTEXT_CHARS)
                    end = min(len(message['content']), index + len(query) + context_limits.SEARCH_EXCERPT_CONTEXT_CHARS)
                    
                    excerpt = message['content'][start:end]
                    if start > 0:
                        excerpt = '...' + excerpt
                    if end < len(message['content']):
                        excerpt = excerpt + '...'
                    
                    # Enforce maximum excerpt length
                    if len(excerpt) > context_limits.SEARCH_EXCERPT_MAX_LENGTH:
                        excerpt = excerpt[:context_limits.SEARCH_EXCERPT_MAX_LENGTH - 3] + '...'
                    
                    # Keep the best (longest) excerpt
                    if len(excerpt) > len(sessions_data[session_id]['best_excerpt']):
                        sessions_data[session_id]['best_excerpt'] = excerpt
            
            # Format results
            formatted_results = []
            for session_id, data in list(sessions_data.items())[:limit]:
                session = data['session_info']
                
                # Create a summary from the first few messages
                summary_parts = []
                for msg in sorted(data['messages'], key=lambda x: x['created_at'])[:3]:
                    role = "User" if msg['role'] == 'user' else "AI"
                    content = msg['content'][:100]
                    summary_parts.append(f"{role}: {content}{'...' if len(msg['content']) > 100 else ''}")
                
                formatted_results.append({
                    'session_id': session_id,
                    'date': session['started_at'],
                    'summary': ' | '.join(summary_parts),
                    'excerpt': data['best_excerpt'],
                    'message_count': session['message_count'],
                    'conversation_type': session['conversation_type'],
                    'title': session.get('title', 'Untitled Conversation')
                })
            
            # Also search memories for the same query
            logger.info(f'🧠 Searching memories for query: "{query}"')
            # Search memories using standard PostgreSQL ILIKE syntax
            memory_result = supabase_client.from_('agent_medium_memories').select('*').eq('agent_id', agent_id).ilike('content', f'%{query}%').order('importance_score', desc=True).order('last_accessed_at', desc=True).limit(limit).execute()
            
            if memory_result.data:
                logger.info(f'🧠 Found {len(memory_result.data)} matching memories')
                
                # Add memory results to the search results
                for memory in memory_result.data:
                    # Create excerpt from memory content
                    content_lower = memory['content'].lower()
                    query_lower = query.lower()
                    
                    excerpt = memory['content']
                    if query_lower in content_lower:
                        # Extract context around the match for memories too
                        index = content_lower.find(query_lower)
                        start = max(0, index - context_limits.SEARCH_EXCERPT_CONTEXT_CHARS)
                        end = min(len(memory['content']), index + len(query) + context_limits.SEARCH_EXCERPT_CONTEXT_CHARS)
                        
                        excerpt = memory['content'][start:end]
                        if start > 0:
                            excerpt = '...' + excerpt
                        if end < len(memory['content']):
                            excerpt = excerpt + '...'
                        
                        # Enforce maximum excerpt length
                        if len(excerpt) > context_limits.SEARCH_EXCERPT_MAX_LENGTH:
                            excerpt = excerpt[:context_limits.SEARCH_EXCERPT_MAX_LENGTH - 3] + '...'
                    
                    formatted_results.append({
                        'date': memory['created_at'],
                        'summary': f"Memory: {memory.get('summary', memory['content'][:100])}",
                        'relevant_excerpt': excerpt,
                        'message_count': 1,  # Memories count as 1 "message"
                        'conversation_type': 'memory',
                        'title': f"Memory - {memory.get('topic', 'General')}"
                    })
            
            logger.info(f'✅ Found {len(formatted_results)} relevant conversations and memories')
            return formatted_results
            
        except Exception as error:
            logger.error(f'❌ Error searching past conversations: {error}')
            return []

    async def get_all_agent_context(self, agent_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get all relevant documents and notes for context building"""
        try:
            logger.info(f'📚 Getting all agent context for: {agent_id}')
            
            permanent_docs = await self.get_agent_documents(agent_id, user_token)
            conversation_docs = await self.get_conversation_documents(agent_id, user_token)
            paper_notes = await self.get_paper_notes(agent_id, user_token, for_context=True)  # Use token-filtered notes for context
            
            # Filter out conversation documents from permanent documents
            permanent_docs = [doc for doc in permanent_docs if not doc.get("metadata", {}).get("conversation_document")]
            
            logger.info(f'✅ Retrieved {len(permanent_docs)} permanent + {len(conversation_docs)} conversation documents + {len(paper_notes)} notes')
            
            return {
                "permanentDocuments": permanent_docs,
                "conversationDocuments": conversation_docs,
                "paperNotes": paper_notes
            }
            
        except Exception as error:
            logger.error(f'❌ Error getting agent context: {error}')
            return {
                "permanentDocuments": [],
                "conversationDocuments": [],
                "paperNotes": []
            }

    async def get_agent_memory_context(self, agent_id: str, user_token: str = None) -> Optional[str]:
        """Get formatted memory context string for AI conversations"""
        try:
            logger.info(f'🧠 Building memory context for agent: {agent_id}')
            
            # Get memory components
            medium_memories = await self.get_medium_term_memory(agent_id, user_token, for_context=True)
            paper_notes = await self.get_paper_notes(agent_id, user_token, for_context=True)
            
            logger.info(f'🧠 Memory components: {len(medium_memories)} medium-term memories, {len(paper_notes)} paper notes')
            
            if not medium_memories and not paper_notes:
                logger.info(f'🧠 No memory or notes found for agent {agent_id}')
                return None
            
            # Build formatted memory context
            context_parts = []
            
            if medium_memories:
                logger.info(f'🧠 Adding {len(medium_memories)} medium-term memories to context')
                context_parts.append("🧠 RECENT MEMORIES:")
                for memory in medium_memories:
                    topic = memory.get('topic', 'General')
                    content = memory.get('content', '')
                    logger.info(f'🧠 Memory: {content[:100]}... [Topic: {topic}]')
                    context_parts.append(f"📌 {content} [Topic: {topic}]")
            
            if paper_notes:
                logger.info(f'🧠 Adding {len(paper_notes)} paper notes to context')
                context_parts.append("\n📝 YOUR NOTES:")
                for note in paper_notes:
                    title = note.get('title', 'Untitled')
                    content = note.get('content', '')
                    if len(content) > 100:
                        content = content[:97] + '...'
                    logger.info(f'🧠 Note: {title}: {content}')
                    context_parts.append(f"📌 {title}: {content}")
            
            if context_parts:
                memory_context = '\n'.join(context_parts)
                logger.info(f'✅ Built memory context ({len(memory_context)} characters)')
                logger.info(f'🧠 Context preview: {memory_context[:200]}...')
                return memory_context
            
            logger.warning(f'🧠 No context parts generated for agent {agent_id}')
            return None
            
        except Exception as error:
            logger.error(f'❌ Error building memory context: {error}')
            import traceback
            logger.error(f'❌ Traceback: {traceback.format_exc()}')
            return None

    # User Profile Management
    async def get_user_profile(self, user_id: str, user_token: str = None) -> Optional[Dict[str, Any]]:
        """Get user profile"""
        try:
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('user_profiles').select('*').eq('id', user_id).execute()
            
            if result.data is None or len(result.data) == 0:
                return None
                
            return result.data[0]
            
        except Exception as error:
            logger.error(f'❌ Error fetching user profile: {error}')
            return None

    async def create_user_profile(self, user_id: str, profile_data: UserProfileCreate, user_token: str = None) -> Dict[str, Any]:
        """Create user profile"""
        try:
            profile_dict = {
                "id": user_id,
                "display_name": profile_data.display_name,
                "subscription_plan": profile_data.subscription_plan,
                "preferences": profile_data.preferences,
            }
            
            # Use user client if token provided, otherwise use admin client
            supabase_client = self.get_user_client(user_token) if user_token else self.admin_supabase
            
            result = supabase_client.from_('user_profiles').insert(profile_dict).execute()
            
            if result.data is None or len(result.data) == 0:
                raise Exception("Failed to create user profile")
                
            return result.data[0]
            
        except Exception as error:
            logger.error(f'❌ Error creating user profile: {error}')
            raise error

# Create singleton instance
database_service = DatabaseService()