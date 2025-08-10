from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, List, Optional
import logging

from ....core.auth import get_current_user, get_current_user_with_token
from ....services.database_service import database_service
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
        agent = await database_service.create_user_agent(current_user.id, agent_data, token)
        return {
            "success": True,
            "data": agent,
            "message": f"Agent '{agent_data.name}' created successfully"
        }
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
        agent = await database_service.update_user_agent(agent_id, updates, token)
        return {
            "success": True,
            "data": agent,
            "message": "Agent updated successfully"
        }
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
        document = await database_service.create_agent_document(agent_id, document_data, token)
        return {
            "success": True,
            "data": document,
            "message": "Document created successfully"
        }
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
        document_id = await database_service.save_conversation_document(agent_id, document_data, token)
        return {
            "success": True,
            "data": {"id": document_id},
            "message": "Conversation document saved successfully"
        }
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