from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any
import logging
from ....services.document_service import document_service
from ....services.ai_service import ai_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/test-document-processing")
async def test_document_processing(file: UploadFile = File(...)):
    """
    Test endpoint for document processing without authentication.
    Used for testing Stage 2 functionality.
    """
    try:
        logger.info(f"🧪 Testing document processing: {file.filename}")
        
        # Read file content
        file_data = await file.read()
        
        if len(file_data) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Process the document
        document_info = await document_service.process_file(
            file_data=file_data,
            filename=file.filename or "test_file",
            content_type=file.content_type or ""
        )
        
        logger.info(f"✅ Test processing successful for {file.filename}")
        
        return {
            "success": True,
            "test_mode": True,
            "document": document_info,
            "message": f"Successfully processed {file.filename} in test mode"
        }
        
    except ValueError as e:
        logger.error(f"❌ Test processing error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error(f"❌ Unexpected test error: {e}")
        raise HTTPException(status_code=500, detail=f"Test error: {str(e)}")

@router.post("/test-ai-generation")
async def test_ai_generation():
    """
    Test endpoint for AI generation without authentication.
    """
    try:
        logger.info("🧪 Testing AI generation")
        
        test_contact = {
            "name": "Test Assistant",
            "description": "A helpful test assistant for Stage 2 testing."
        }
        
        response = await ai_service.generate_response(
            contact=test_contact,
            user_message="Hello! Please respond with a brief confirmation that the Python AI service is working correctly.",
            chat_history=[]
        )
        
        logger.info("✅ Test AI generation successful")
        
        return {
            "success": True,
            "test_mode": True,
            "response": response,
            "message": "AI generation test successful"
        }
        
    except Exception as e:
        logger.error(f"❌ AI generation test failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI test failed: {str(e)}")

@router.get("/stage2-status")
async def get_stage2_status():
    """
    Get status of Stage 2 implementation.
    """
    try:
        # Test document service
        doc_health = await test_document_service_basic()
        
        # Test AI service  
        ai_health = await ai_service.health_check()
        
        return {
            "stage": "Stage 2 - Performance Heavy Operations",
            "status": "active",
            "services": {
                "document_processing": doc_health,
                "ai_generation": ai_health
            },
            "features": [
                "Document processing (PDF, DOCX, PPTX, XLSX, text files)",
                "AI response generation with Gemini API",
                "File upload and content extraction",
                "Document summarization",
                "Multi-format support"
            ],
            "endpoints": [
                "/api/v1/documents/process",
                "/api/v1/documents/bulk-process", 
                "/api/v1/ai/generate-response",
                "/api/v1/ai/summarize-document"
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Stage 2 status check failed: {e}")
        return {
            "stage": "Stage 2 - Performance Heavy Operations",
            "status": "error",
            "error": str(e)
        }

async def test_document_service_basic():
    """Basic test of document service functionality"""
    try:
        # Test text extraction
        test_text = "Hello, world! This is a test document."
        test_bytes = test_text.encode('utf-8')
        
        extracted = await document_service._extract_text_content(test_bytes)
        
        if extracted == test_text:
            return {
                "status": "healthy",
                "text_extraction": "working",
                "supported_formats": len(document_service._get_supported_extensions())
            }
        else:
            return {
                "status": "unhealthy",
                "error": "Text extraction test failed"
            }
            
    except Exception as e:
        return {
            "status": "unhealthy", 
            "error": str(e)
        }