from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import logging
from ....services.ai_service import ai_service
from ....core.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    contact: Dict[str, Any]
    user_message: str
    chat_history: List[Dict[str, Any]] = []
    conversation_documents: Optional[List[Dict[str, Any]]] = None

class SummarizeRequest(BaseModel):
    document_content: str
    filename: str

@router.post("/generate-response")
async def generate_ai_response(
    request: ChatRequest,
    current_user = Depends(get_current_user)
):
    """
    Generate AI response using Google Gemini API.
    This endpoint replaces the frontend geminiService for better performance.
    """
    try:
        logger.info(f"🤖 Generating AI response for user {current_user.id}")
        
        # Validate request
        if not request.contact:
            raise HTTPException(status_code=400, detail="Contact information is required")
        
        if not request.user_message.strip():
            raise HTTPException(status_code=400, detail="User message cannot be empty")
        
        # Generate response
        response = await ai_service.generate_response(
            contact=request.contact,
            user_message=request.user_message,
            chat_history=request.chat_history,
            conversation_documents=request.conversation_documents
        )
        
        logger.info(f"✅ Successfully generated AI response ({len(response)} characters)")
        
        return {
            "success": True,
            "response": response,
            "metadata": {
                "contact_name": request.contact.get('name', 'AI'),
                "response_length": len(response),
                "processed_documents": len(request.conversation_documents or []),
                "history_length": len(request.chat_history)
            }
        }
        
    except ValueError as e:
        logger.error(f"❌ AI generation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error(f"❌ Unexpected error in AI generation: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.post("/summarize-document")
async def summarize_document(
    request: SummarizeRequest,
    current_user = Depends(get_current_user)
):
    """
    Generate a summary of a document using AI.
    """
    try:
        logger.info(f"📄 Summarizing document: {request.filename} for user {current_user.id}")
        
        # Validate request
        if not request.document_content.strip():
            raise HTTPException(status_code=400, detail="Document content cannot be empty")
        
        if not request.filename.strip():
            raise HTTPException(status_code=400, detail="Filename is required")
        
        # Generate summary
        summary = await ai_service.summarize_document(
            document_content=request.document_content,
            filename=request.filename
        )
        
        logger.info(f"✅ Generated summary for {request.filename}")
        
        return {
            "success": True,
            "summary": summary,
            "metadata": {
                "filename": request.filename,
                "content_length": len(request.document_content),
                "summary_length": len(summary)
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error summarizing document: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization error: {str(e)}")

@router.get("/health")
async def ai_service_health():
    """
    Health check for AI service.
    """
    try:
        health_status = await ai_service.health_check()
        
        return {
            "service": "ai-generation",
            **health_status
        }
        
    except Exception as e:
        logger.error(f"❌ AI service health check failed: {e}")
        return {
            "service": "ai-generation",
            "status": "unhealthy",
            "error": str(e)
        }

@router.get("/models")
async def get_available_models():
    """
    Get information about available AI models.
    """
    return {
        "models": [
            {
                "name": "gemini-1.5-flash",
                "description": "Fast and efficient model for most tasks",
                "max_tokens": 2048,
                "supported_features": ["text_generation", "function_calling"]
            }
        ],
        "default_model": "gemini-1.5-flash",
        "api_provider": "Google Generative AI"
    }

@router.post("/test-generation")
async def test_ai_generation(current_user = Depends(get_current_user)):
    """
    Test endpoint for AI generation functionality.
    """
    try:
        test_contact = {
            "name": "Test Assistant",
            "description": "A helpful test assistant."
        }
        
        response = await ai_service.generate_response(
            contact=test_contact,
            user_message="Hello, please respond with a simple greeting.",
            chat_history=[]
        )
        
        return {
            "success": True,
            "test_response": response,
            "message": "AI generation test successful"
        }
        
    except Exception as e:
        logger.error(f"❌ AI generation test failed: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")