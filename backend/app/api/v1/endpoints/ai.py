from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import logging
import json
from ....services.ai_service import ai_service
from ....core.auth import get_current_user, get_current_user_with_token

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

class GenerateTextRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7

@router.post("/generate-response")
async def generate_ai_response(
    request: ChatRequest,
    auth_data = Depends(get_current_user_with_token)
):
    """
    Generate AI response using Google Gemini API.
    This endpoint replaces the frontend geminiService for better performance.
    """
    try:
        current_user = auth_data["user"]
        user_token = auth_data["token"]
        
        logger.info(f"🤖 Generating AI response for user {current_user.id}")
        
        # Validate request
        if not request.contact:
            raise HTTPException(status_code=400, detail="Contact information is required")
        
        if not request.user_message.strip():
            raise HTTPException(status_code=400, detail="User message cannot be empty")
        
        # Generate response (now returns dict with response and token analysis)
        ai_result = await ai_service.generate_response(
            contact=request.contact,
            user_message=request.user_message,
            chat_history=request.chat_history,
            conversation_documents=request.conversation_documents,
            user_token=user_token
        )
        
        # Extract response text and metadata
        ai_response = ai_result.get('response', '')
        token_analysis = ai_result.get('token_analysis', {})
        was_compacted = ai_result.get('was_compacted', False)
        compacted_chat_history = ai_result.get('compacted_chat_history', request.chat_history)
        
        # Log key information for frontend console
        logger.info(f"✅ Response generated: {len(ai_response)} characters")
        if was_compacted:
            logger.info(f"🔄 Conversation was compacted this turn")
        if token_analysis:
            logger.info(f"📊 Final tokens: {token_analysis.get('total_tokens', 0)}/{token_analysis.get('max_tokens', 0)} ({token_analysis.get('usage_percentage', 0):.1f}%)")
        
        return {
            "success": True,
            "response": ai_response,
            "compacted_chat_history": compacted_chat_history,
            "metadata": {
                "contact_name": request.contact.get('name', 'AI'),
                "response_length": len(ai_response),
                "processed_documents": len(request.conversation_documents or []),
                "history_length": len(request.chat_history),
                "token_analysis": token_analysis,
                "conversation_compacting": {
                    "was_compacted": was_compacted,
                    "original_message_count": ai_result.get('original_message_count', len(request.chat_history)),
                    "compacted_message_count": ai_result.get('compacted_message_count', len(request.chat_history))
                }
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

@router.post("/generate-text")
async def generate_text(
    request: GenerateTextRequest,
    current_user = Depends(get_current_user)
):
    """
    Generate text using AI for document processing tasks (summaries, word banks, etc.).
    """
    try:
        logger.info(f"🤖 Generating text for user {current_user.id} (prompt: {len(request.prompt)} chars)")
        
        # Validate request
        if not request.prompt.strip():
            raise HTTPException(status_code=400, detail="Prompt cannot be empty")
        
        # Generate text using ai_service
        text = await ai_service.generate_text(
            prompt=request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        logger.info(f"✅ Generated text: {len(text)} characters")
        
        return {
            "success": True,
            "text": text,
            "metadata": {
                "prompt_length": len(request.prompt),
                "response_length": len(text),
                "max_tokens": request.max_tokens,
                "temperature": request.temperature
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating text: {e}")
        raise HTTPException(status_code=500, detail=f"Text generation error: {str(e)}")

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
                "name": "gemini-2.5-flash",
                "description": "Fast and efficient model for most tasks",
                "max_tokens": 2048,
                "supported_features": ["text_generation", "function_calling"]
            }
        ],
        "default_model": "gemini-2.5-flash",
        "api_provider": "Google Generative AI"
    }

@router.post("/dev/generate-response")
async def dev_generate_ai_response(request: ChatRequest):
    """
    Development endpoint for AI generation with function calling.
    No authentication required for testing.
    """
    try:
        logger.info(f"🧪 DEV: Generating AI response")
        
        # Validate request
        if not request.contact:
            raise HTTPException(status_code=400, detail="Contact information is required")
        
        if not request.user_message.strip():
            raise HTTPException(status_code=400, detail="User message cannot be empty")
        
        # Generate response with function calling support (now returns dict)
        ai_result = await ai_service.generate_response(
            contact=request.contact,
            user_message=request.user_message,
            chat_history=request.chat_history,
            conversation_documents=request.conversation_documents
        )
        
        # Extract response text and metadata
        ai_response = ai_result.get('response', '')
        token_analysis = ai_result.get('token_analysis', {})
        was_compacted = ai_result.get('was_compacted', False)
        compacted_chat_history = ai_result.get('compacted_chat_history', request.chat_history)
        
        # Log key information for development mode
        logger.info(f"✅ DEV: Response generated: {len(ai_response)} characters")
        if was_compacted:
            logger.info(f"🔄 DEV: Conversation was compacted this turn")
        if token_analysis:
            logger.info(f"📊 DEV: Final tokens: {token_analysis.get('total_tokens', 0)}/{token_analysis.get('max_tokens', 0)} ({token_analysis.get('usage_percentage', 0):.1f}%)")
        
        return {
            "success": True,
            "response": ai_response,
            "compacted_chat_history": compacted_chat_history,
            "development_mode": True,
            "metadata": {
                "contact_name": request.contact.get('name', 'AI'),
                "response_length": len(ai_response),
                "processed_documents": len(request.conversation_documents or []),
                "history_length": len(request.chat_history),
                "functions_available": ["search_web", "scrape_website", "search_past_conversations"],
                "token_analysis": token_analysis,
                "conversation_compacting": {
                    "was_compacted": was_compacted,
                    "original_message_count": ai_result.get('original_message_count', len(request.chat_history)),
                    "compacted_message_count": ai_result.get('compacted_message_count', len(request.chat_history))
                }
            }
        }
        
    except ValueError as e:
        logger.error(f"❌ DEV: AI generation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error(f"❌ DEV: Unexpected error in AI generation: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

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
        
        ai_result = await ai_service.generate_response(
            contact=test_contact,
            user_message="Hello, please respond with a simple greeting.",
            chat_history=[]
        )
        
        # Extract response text
        ai_response = ai_result.get('response', '')
        
        return {
            "success": True,
            "test_response": ai_response,
            "message": "AI generation test successful"
        }
        
    except Exception as e:
        logger.error(f"❌ AI generation test failed: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")