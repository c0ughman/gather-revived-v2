from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict, Any, List
import logging
from ....services.document_service import document_service
from ....core.auth import get_current_user
from ....core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/process", response_model=Dict[str, Any])
async def process_document(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """
    Process an uploaded document and extract its content.
    This endpoint replaces the frontend document processing for better performance.
    """
    try:
        logger.info(f"🔍 Processing document: {file.filename} for user {current_user.id}")
        
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Read file content
        file_data = await file.read()
        
        if len(file_data) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Process the document
        document_info = await document_service.process_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type or ""
        )
        
        logger.info(f"✅ Successfully processed {file.filename}")
        
        return {
            "success": True,
            "document": document_info,
            "message": f"Successfully processed {file.filename}"
        }
        
    except ValueError as e:
        logger.error(f"❌ Document processing error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error(f"❌ Unexpected error processing {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error processing document: {str(e)}")

@router.post("/bulk-process")
async def process_multiple_documents(
    files: list[UploadFile] = File(...),
    current_user = Depends(get_current_user)
):
    """
    Process multiple documents in one request for better performance.
    """
    try:
        logger.info(f"🔍 Processing {len(files)} documents for user {current_user.id}")
        
        if len(files) == 0:
            raise HTTPException(status_code=400, detail="No files provided")
        
        if len(files) > 10:  # Limit to prevent overload
            raise HTTPException(status_code=400, detail="Maximum 10 files allowed per request")
        
        results = []
        errors = []
        
        for file in files:
            try:
                # Read file content
                file_data = await file.read()
                
                if len(file_data) == 0:
                    errors.append(f"{file.filename}: Empty file")
                    continue
                
                # Process the document
                document_info = await document_service.process_file(
                    file_data=file_data,
                    filename=file.filename or "unknown",
                    content_type=file.content_type or ""
                )
                
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "document": document_info
                })
                
            except Exception as e:
                logger.error(f"❌ Error processing {file.filename}: {e}")
                errors.append(f"{file.filename}: {str(e)}")
        
        logger.info(f"✅ Processed {len(results)}/{len(files)} documents successfully")
        
        return {
            "success": len(results) > 0,
            "processed_count": len(results),
            "total_count": len(files),
            "results": results,
            "errors": errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in bulk processing: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.get("/supported-types")
async def get_supported_types():
    """
    Get list of supported document types and extensions.
    """
    return {
        "supported_extensions": document_service._get_supported_extensions(),
        "text_file_types": document_service.TEXT_FILE_TYPES,
        "binary_file_types": document_service.BINARY_FILE_TYPES,
        "max_file_size_mb": document_service.MAX_FILE_SIZE // (1024 * 1024),
        "max_file_size_bytes": document_service.MAX_FILE_SIZE
    }

@router.post("/format-for-ai")
async def format_document_for_ai(
    document: Dict[str, Any],
    current_user = Depends(get_current_user)
):
    """
    Format a document for AI consumption.
    """
    try:
        formatted_content = document_service.format_document_for_ai(document)
        
        return {
            "success": True,
            "formatted_content": formatted_content
        }
        
    except Exception as e:
        logger.error(f"❌ Error formatting document for AI: {e}")
        raise HTTPException(status_code=500, detail=f"Formatting error: {str(e)}")

@router.get("/health")
async def document_service_health():
    """
    Health check for document processing service.
    """
    try:
        # Test basic functionality
        test_text = "Hello, world!"
        test_bytes = test_text.encode('utf-8')
        
        # Test text extraction
        extracted = await document_service._extract_text_content(test_bytes)
        
        return {
            "status": "healthy",
            "service": "document-processing",
            "test_extraction": "passed" if extracted == test_text else "failed",
            "supported_formats": len(document_service._get_supported_extensions()),
            "max_file_size_mb": document_service.MAX_FILE_SIZE // (1024 * 1024)
        }
        
    except Exception as e:
        logger.error(f"❌ Document service health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "document-processing",
            "error": str(e)
        }

# Development endpoints (no authentication required)
if settings.DEBUG:
    @router.post("/dev/process")
    async def dev_process_document(file: UploadFile = File(...)):
        """
        Development endpoint for document processing without authentication.
        Only available when DEBUG=True.
        """
        try:
            logger.info(f"🧪 DEV: Processing document: {file.filename}")
            
            # Validate file
            if not file.filename:
                raise HTTPException(status_code=400, detail="No filename provided")
            
            # Read file content
            file_data = await file.read()
            
            if len(file_data) == 0:
                raise HTTPException(status_code=400, detail="Empty file uploaded")
            
            # Process the document
            document_info = await document_service.process_file(
                file_data=file_data,
                filename=file.filename,
                content_type=file.content_type or ""
            )
            
            logger.info(f"✅ DEV: Successfully processed {file.filename}")
            
            return {
                "success": True,
                "development_mode": True,
                "document": document_info,
                "message": f"Successfully processed {file.filename}"
            }
            
        except ValueError as e:
            logger.error(f"❌ DEV: Processing error: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        
        except Exception as e:
            logger.error(f"❌ DEV: Unexpected error: {e}")
            raise HTTPException(status_code=500, detail=f"Development error: {str(e)}")

    @router.post("/dev/bulk-process")
    async def dev_bulk_process_documents(files: List[UploadFile] = File(...)):
        """
        Development endpoint for bulk document processing without authentication.
        Only available when DEBUG=True.
        """
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        if len(files) > 10:  # Limit for development
            raise HTTPException(status_code=400, detail="Too many files (max 10 for dev endpoint)")
        
        results = []
        errors = []
        
        for file in files:
            try:
                logger.info(f"🧪 DEV: Processing {file.filename}")
                
                if not file.filename:
                    errors.append("File without filename")
                    continue
                
                # Read file content
                file_data = await file.read()
                
                if len(file_data) == 0:
                    errors.append(f"{file.filename}: Empty file")
                    continue
                
                # Process the document
                document_info = await document_service.process_file(
                    file_data=file_data,
                    filename=file.filename,
                    content_type=file.content_type or ""
                )
                
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "document": document_info
                })
                
            except Exception as e:
                logger.error(f"❌ DEV: Error processing {file.filename}: {e}")
                errors.append(f"{file.filename}: {str(e)}")
        
        logger.info(f"✅ DEV: Processed {len(results)}/{len(files)} documents successfully")
        
        return {
            "success": len(results) > 0,
            "development_mode": True,
            "processed_count": len(results),
            "total_count": len(files),
            "results": results,
            "errors": errors
        }