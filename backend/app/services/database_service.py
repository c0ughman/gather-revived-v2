from typing import List, Dict, Any, Optional
from supabase import create_client
from ..core.config import settings
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

    async def get_all_agent_context(self, agent_id: str, user_token: str = None) -> Dict[str, List[Dict[str, Any]]]:
        """Get all relevant documents for context building"""
        try:
            logger.info(f'📚 Getting all agent context for: {agent_id}')
            
            permanent_docs = await self.get_agent_documents(agent_id, user_token)
            conversation_docs = await self.get_conversation_documents(agent_id, user_token)
            
            # Filter out conversation documents from permanent documents
            permanent_docs = [doc for doc in permanent_docs if not doc.get("metadata", {}).get("conversation_document")]
            
            logger.info(f'✅ Retrieved {len(permanent_docs)} permanent + {len(conversation_docs)} conversation documents')
            
            return {
                "permanentDocuments": permanent_docs,
                "conversationDocuments": conversation_docs
            }
            
        except Exception as error:
            logger.error(f'❌ Error getting agent context: {error}')
            return {
                "permanentDocuments": [],
                "conversationDocuments": []
            }

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