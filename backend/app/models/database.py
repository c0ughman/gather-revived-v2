from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Agent Models
class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    initials: str
    color: str
    voice: Optional[str] = None
    avatar: Optional[str] = None
    status: str = "online"

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    initials: Optional[str] = None
    color: Optional[str] = None
    voice: Optional[str] = None
    avatar: Optional[str] = None
    status: Optional[str] = None

class AgentResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str]
    initials: str
    color: str
    voice: Optional[str]
    avatar_url: Optional[str]
    status: str
    last_seen: Optional[str]
    created_at: str
    updated_at: str
    agent_integrations: Optional[List[Dict[str, Any]]] = None
    agent_documents: Optional[List[Dict[str, Any]]] = None

# Integration Models
class IntegrationCreate(BaseModel):
    integrationId: str
    name: str
    description: Optional[str] = None
    config: Dict[str, Any]

class IntegrationResponse(BaseModel):
    id: str
    agent_id: str
    template_id: str
    name: str
    description: Optional[str]
    config: Dict[str, Any]
    status: str
    created_at: str
    updated_at: str

# Document Models
class DocumentCreate(BaseModel):
    name: str
    type: str
    size: int
    content: str
    summary: Optional[str] = None
    extractedText: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class DocumentResponse(BaseModel):
    id: str
    agent_id: str
    name: str
    original_filename: str
    file_type: str
    file_size: int
    content: Optional[str]
    summary: Optional[str]
    extracted_text: Optional[str]
    metadata: Optional[Dict[str, Any]]
    uploaded_at: str

# User Profile Models
class UserProfileCreate(BaseModel):
    display_name: Optional[str] = None
    subscription_plan: str = "free"
    preferences: Optional[Dict[str, Any]] = None

class UserProfileResponse(BaseModel):
    id: str
    display_name: Optional[str]
    subscription_plan: str
    preferences: Optional[Dict[str, Any]]
    created_at: str
    updated_at: str

# Request/Response wrapper models
class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None

class AgentContextResponse(BaseModel):
    permanentDocuments: List[Dict[str, Any]]
    conversationDocuments: List[Dict[str, Any]]