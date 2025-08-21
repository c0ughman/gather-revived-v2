from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, List, Optional
import logging

from ....core.auth import get_current_user, get_current_user_with_token
from ....services.database_service import database_service
from ....core.context_limits import context_limits
from ....models.database import (
    AgentCreate, AgentUpdate, AgentResponse,
    IntegrationCreate, IntegrationResponse,
    DocumentCreate, DocumentResponse,
    UserProfileCreate, UserProfileResponse,
    AgentContextResponse,
    SuccessResponse, ErrorResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Health check for database service
@router.get("/health")
async def database_health():
    """Health check for database service"""
    try:
        is_healthy = await database_service.test_connection()
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "service": "database",
            "connection": "ok" if is_healthy else "failed"
        }
    except Exception as e:
        logger.error(f"❌ Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "database",
            "error": str(e)
        }

# User Agents Endpoints
@router.get("/agents")
async def get_user_agents(auth_data = Depends(get_current_user_with_token)):
    """Get all agents for the current user"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        agents = await database_service.get_user_agents(current_user.id, token)
        return {
            "success": True,
            "data": agents
        }
    except Exception as e:
        logger.error(f"❌ Error fetching user agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agents")
async def create_user_agent(
    agent_data: AgentCreate,
    auth_data = Depends(get_current_user_with_token)
):
    """Create a new user agent"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        
        # Validate agent description token limit
        if agent_data.description:
            validation = context_limits.validate_agent_description(agent_data.description)
            if not validation['valid']:
                raise HTTPException(
                    status_code=400, 
                    detail={
                        "error": f"Agent description exceeds {context_limits.AGENT_DESCRIPTION_MAX_TOKENS:,} token limit",
                        "tokens": validation['tokens'],
                        "max_tokens": validation['max_tokens']
                    }
                )
        
        agent = await database_service.create_user_agent(current_user.id, agent_data, token)
        return {
            "success": True,
            "data": agent,
            "message": f"Agent '{agent_data.name}' created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating user agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/agents/{agent_id}")
async def update_user_agent(
    agent_id: str,
    updates: AgentUpdate,
    auth_data = Depends(get_current_user_with_token)
):
    """Update a user agent"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        
        # Validate agent description token limit if being updated
        if hasattr(updates, 'description') and updates.description:
            validation = context_limits.validate_agent_description(updates.description)
            if not validation['valid']:
                raise HTTPException(
                    status_code=400, 
                    detail={
                        "error": f"Agent description exceeds {context_limits.AGENT_DESCRIPTION_MAX_TOKENS:,} token limit",
                        "tokens": validation['tokens'],
                        "max_tokens": validation['max_tokens']
                    }
                )
        
        agent = await database_service.update_user_agent(agent_id, updates, token)
        return {
            "success": True,
            "data": agent,
            "message": "Agent updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating user agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/agents/{agent_id}")
async def delete_user_agent(
    agent_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Delete a user agent"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        success = await database_service.delete_user_agent(agent_id, token)
        return {
            "success": success,
            "message": "Agent deleted successfully"
        }
    except Exception as e:
        logger.error(f"❌ Error deleting user agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Agent Integrations Endpoints
@router.post("/agents/{agent_id}/integrations")
async def create_agent_integration(
    agent_id: str,
    integration_data: IntegrationCreate,
    auth_data = Depends(get_current_user_with_token)
):
    """Create a new agent integration"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        integration = await database_service.create_agent_integration(agent_id, integration_data, token)
        return {
            "success": True,
            "data": integration,
            "message": "Integration created successfully"
        }
    except Exception as e:
        logger.error(f"❌ Error creating agent integration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/integrations/{integration_id}")
async def delete_agent_integration(
    integration_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Delete an agent integration"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        success = await database_service.delete_agent_integration(integration_id, token)
        return {
            "success": success,
            "message": "Integration deleted successfully"
        }
    except Exception as e:
        logger.error(f"❌ Error deleting agent integration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Agent Documents Endpoints
@router.post("/agents/{agent_id}/documents")
async def create_agent_document(
    agent_id: str,
    document_data: DocumentCreate,
    auth_data = Depends(get_current_user_with_token)
):
    """Create a new agent document"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        
        # Get existing documents to validate limits
        existing_docs = await database_service.get_agent_documents(agent_id, token)
        
        # Prepare new document for validation
        new_doc_dict = {
            'extracted_text': document_data.extractedText,
            'content': document_data.content,
            'summary': document_data.summary
        }
        
        # Validate agent document limits (count and individual size)
        validation = context_limits.validate_agent_document_limits(existing_docs, [new_doc_dict])
        if not validation['valid']:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": validation['error'],
                    "current_count": validation.get('current_count'),
                    "max_count": validation.get('max_count'),
                    "tokens": validation.get('tokens'),
                    "max_tokens": validation.get('max_tokens')
                }
            )
        
        document = await database_service.create_agent_document(agent_id, document_data, token)
        return {
            "success": True,
            "data": document,
            "message": "Document created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating agent document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/{document_id}")
async def delete_agent_document(
    document_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Delete an agent document"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        success = await database_service.delete_agent_document(document_id, token)
        return {
            "success": success,
            "message": "Document deleted successfully"
        }
    except Exception as e:
        logger.error(f"❌ Error deleting agent document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/{agent_id}/documents")
async def get_agent_documents(
    agent_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Get all documents for an agent"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        documents = await database_service.get_agent_documents(agent_id, token)
        return {
            "success": True,
            "data": documents
        }
    except Exception as e:
        logger.error(f"❌ Error fetching agent documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents/{document_id}")
async def get_document_by_id(
    document_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Get a specific document by ID"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        document = await database_service.get_document_by_id(document_id, token)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "success": True,
            "data": document
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Conversation Documents Endpoints
@router.post("/agents/{agent_id}/conversation-documents")
async def save_conversation_document(
    agent_id: str,
    document_data: DocumentCreate,
    auth_data = Depends(get_current_user_with_token)
):
    """Save a conversation document"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        
        # Get existing conversation documents to validate cumulative limits
        existing_docs = await database_service.get_conversation_documents(agent_id, token)
        
        # Prepare new document for validation
        new_doc_dict = {
            'extracted_text': document_data.extractedText,
            'content': document_data.content,
            'summary': document_data.summary
        }
        
        # Validate conversation document cumulative token limits
        validation = context_limits.validate_conversation_document_limits(existing_docs, [new_doc_dict])
        if not validation['valid']:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": validation['error'],
                    "current_tokens": validation.get('current_tokens'),
                    "new_tokens": validation.get('new_tokens'),
                    "total_tokens": validation.get('total_tokens'),
                    "max_tokens": validation.get('max_tokens')
                }
            )
        
        document_id = await database_service.save_conversation_document(agent_id, document_data, token)
        return {
            "success": True,
            "data": {"id": document_id},
            "message": "Conversation document saved successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error saving conversation document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/{agent_id}/conversation-documents")
async def get_conversation_documents(
    agent_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Get conversation documents for an agent"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        documents = await database_service.get_conversation_documents(agent_id, token)
        return {
            "success": True,
            "data": documents
        }
    except Exception as e:
        logger.error(f"❌ Error fetching conversation documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/{agent_id}/context")
async def get_all_agent_context(
    agent_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Get all relevant documents for context building"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        context = await database_service.get_all_agent_context(agent_id, token)
        return {
            "success": True,
            "data": context
        }
    except Exception as e:
        logger.error(f"❌ Error getting agent context: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/{agent_id}/memory-context")
async def get_agent_memory_context(
    agent_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Get formatted memory context for AI conversations"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        memory_context = await database_service.get_agent_memory_context(agent_id, token)
        return {
            "success": True,
            "data": {
                "memory_context": memory_context,
                "has_memory": memory_context is not None
            }
        }
    except Exception as e:
        logger.error(f"❌ Error getting agent memory context: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# User Profile Endpoints
@router.get("/profile")
async def get_user_profile(auth_data = Depends(get_current_user_with_token)):
    """Get current user profile"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        profile = await database_service.get_user_profile(current_user.id, token)
        if profile is None:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        return {
            "success": True,
            "data": profile
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/profile")
async def create_user_profile(
    profile_data: UserProfileCreate,
    auth_data = Depends(get_current_user_with_token)
):
    """Create user profile"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        profile = await database_service.create_user_profile(current_user.id, profile_data, token)
        return {
            "success": True,
            "data": profile,
            "message": "User profile created successfully"
        }
    except Exception as e:
        logger.error(f"❌ Error creating user profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Validation Endpoints
@router.post("/validate/agent-description")
async def validate_agent_description(
    request: Dict[str, Any],
    auth_data = Depends(get_current_user_with_token)
):
    """Validate agent description against token limits"""
    try:
        description = request.get('description', '')
        validation_result = context_limits.validate_agent_description(description)
        
        return {
            "success": True,
            "data": validation_result
        }
    except Exception as e:
        logger.error(f"❌ Error validating agent description: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate/agent-documents")
async def validate_agent_documents(
    agent_id: str,
    request: Dict[str, Any],
    auth_data = Depends(get_current_user_with_token)
):
    """Validate agent documents against count and token limits"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        
        # Get existing documents
        existing_docs = await database_service.get_agent_documents(agent_id, token)
        
        # Extract new documents from request
        new_docs = request.get('documents', [])
        
        # Validate limits
        validation_result = context_limits.validate_agent_document_limits(existing_docs, new_docs)
        
        return {
            "success": True,
            "data": validation_result
        }
    except Exception as e:
        logger.error(f"❌ Error validating agent documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate/conversation-documents")
async def validate_conversation_documents(
    agent_id: str,
    request: Dict[str, Any],
    auth_data = Depends(get_current_user_with_token)
):
    """Validate conversation documents against cumulative token limits"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        
        # Get existing conversation documents
        existing_docs = await database_service.get_conversation_documents(agent_id, token)
        
        # Extract new documents from request
        new_docs = request.get('documents', [])
        
        # Validate limits
        validation_result = context_limits.validate_conversation_document_limits(existing_docs, new_docs)
        
        return {
            "success": True,
            "data": validation_result
        }
    except Exception as e:
        logger.error(f"❌ Error validating conversation documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Paper Notes Endpoints
@router.get("/agents/{agent_id}/paper-notes")
async def get_paper_notes_with_token_info(
    agent_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Get paper notes with token filtering information for UI display"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        
        # Get paper notes with token filtering info
        notes_info = await database_service.get_paper_notes_with_token_info(agent_id, token)
        
        return {
            "success": True,
            "data": notes_info
        }
    except Exception as e:
        logger.error(f"❌ Error fetching paper notes with token info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/{agent_id}/medium-term-memory")
async def get_medium_term_memory_with_token_info(
    agent_id: str,
    auth_data = Depends(get_current_user_with_token)
):
    """Get medium-term memory with token filtering information for UI display"""
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        
        # Get medium-term memory with token filtering info
        memory_info = await database_service.get_medium_term_memory_with_token_info(agent_id, token)
        
        return {
            "success": True,
            "data": memory_info
        }
    except Exception as e:
        logger.error(f"❌ Error fetching medium-term memory with token info: {e}")
        raise HTTPException(status_code=500, detail=str(e))