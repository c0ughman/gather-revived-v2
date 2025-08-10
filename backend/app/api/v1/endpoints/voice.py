"""
Voice API Endpoints for Gemini Live Integration

Handles backend components of voice calls:
- Session creation with ephemeral tokens
- Function calling (paper tool, etc.)
- Session management and context
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import logging
from ....services.voice_service import voice_service
from ....core.auth import get_current_user, get_current_user_with_token

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/session/create")
async def create_voice_session(
    contact_data: Dict[str, Any],
    auth_data = Depends(get_current_user_with_token)
):
    """
    Create a new voice session with ephemeral authentication
    
    This provides secure session management and ephemeral tokens
    as recommended by the Live API docs
    """
    try:
        current_user = auth_data["user"]
        token = auth_data["token"]
        logger.info(f"🎤 Creating voice session for user {current_user.id}")
        
        session_info = await voice_service.create_session(
            user_id=current_user.id,
            contact=contact_data,
            user_token=token
        )
        
        return {
            "success": True,
            "session": session_info
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to create voice session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/session/{session_id}/function-call")
async def handle_function_call(
    session_id: str,
    function_data: Dict[str, Any],
    current_user = Depends(get_current_user)
):
    """
    Handle function calls from voice sessions
    
    This is where tool use (paper tool, integrations, etc.) is processed
    as recommended by the Live API docs
    """
    try:
        function_name = function_data.get("name")
        function_args = function_data.get("args", {})
        
        if not function_name:
            raise HTTPException(status_code=400, detail="Function name is required")
        
        logger.info(f"🔧 Processing function call {function_name} for session {session_id}")
        
        result = await voice_service.handle_function_call(
            session_id=session_id,
            function_name=function_name,
            function_args=function_args
        )
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Function call failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/session/{session_id}/context")
async def get_session_context(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get session context and history
    
    Provides session management as recommended by the Live API docs
    """
    try:
        context = await voice_service.get_session_context(session_id)
        
        return {
            "success": True,
            "context": context
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Failed to get session context: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/session/{session_id}/end")
async def end_voice_session(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """
    End a voice session and cleanup resources
    """
    try:
        result = await voice_service.end_session(session_id)
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Failed to end session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Development endpoints (no auth required in DEBUG mode)
from ....core.config import settings

if settings.DEBUG:
    @router.post("/dev/session/create")
    async def dev_create_voice_session(contact_data: Dict[str, Any]):
        """
        Development endpoint for creating voice sessions without authentication
        Only available when DEBUG=True
        """
        try:
            logger.info("🧪 DEV: Creating voice session")
            
            session_info = await voice_service.create_session(
                user_id="dev_user",
                contact=contact_data,
                user_token=None  # No token in dev mode
            )
            
            return {
                "success": True,
                "development_mode": True,
                "session": session_info
            }
            
        except Exception as e:
            logger.error(f"❌ DEV: Failed to create voice session: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/dev/session/{session_id}/function-call")
    async def dev_handle_function_call(
        session_id: str,
        function_data: Dict[str, Any]
    ):
        """
        Development endpoint for function calls without authentication
        Only available when DEBUG=True
        """
        try:
            function_name = function_data.get("name")
            function_args = function_data.get("args", {})
            
            if not function_name:
                raise HTTPException(status_code=400, detail="Function name is required")
            
            logger.info(f"🧪 DEV: Processing function call {function_name}")
            
            result = await voice_service.handle_function_call(
                session_id=session_id,
                function_name=function_name,
                function_args=function_args
            )
            
            return {
                **result,
                "development_mode": True
            }
            
        except Exception as e:
            logger.error(f"❌ DEV: Function call failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/dev/session/{session_id}/context")
    async def dev_get_session_context(session_id: str):
        """
        Development endpoint for getting session context without authentication
        Only available when DEBUG=True
        """
        try:
            context = await voice_service.get_session_context(session_id)
            
            return {
                "success": True,
                "development_mode": True,
                "context": context
            }
            
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"❌ DEV: Failed to get session context: {e}")
            raise HTTPException(status_code=500, detail=str(e))