from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict, Any, List
import logging
from ....services.document_service import document_service
from ....core.auth import get_current_user
from ....core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

async def ensure_dev_user_agent_exists(supabase, dev_user_id: str, dev_agent_id: str):
    """Ensure the dev user profile and agent exist for development mode"""
    try:
        # Check if dev user profile exists
        user_result = supabase.table("user_profiles").select("id").eq("id", dev_user_id).execute()
        if not user_result.data:
            # Create dev user profile
            user_profile = {
                "id": dev_user_id,
                "display_name": "Dev User",
                "created_at": "now()",
                "updated_at": "now()"
            }
            supabase.table("user_profiles").insert(user_profile).execute()
            logger.info(f"🔧 DEV: Created dev user profile {dev_user_id}")
        
        # Check if dev agent exists
        agent_result = supabase.table("user_agents").select("id").eq("id", dev_agent_id).execute()
        if not agent_result.data:
            # Create dev agent
            dev_agent = {
                "id": dev_agent_id,
                "user_id": dev_user_id,
                "name": "Dev Agent",
                "description": "Development mode agent for testing documents",
                "initials": "DA",
                "color": "#3b82f6",
                "voice": "Puck",
                "status": "online",
                "last_seen": "now",
                "created_at": "now()",
                "updated_at": "now()"
            }
            supabase.table("user_agents").insert(dev_agent).execute()
            logger.info(f"🔧 DEV: Created dev agent {dev_agent_id}")
            
    except Exception as e:
        logger.warning(f"⚠️ DEV: Failed to ensure dev user/agent exists: {e}")
        # Continue anyway - the service role key should bypass RLS

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
            
            # For dev mode, also save the document to database 
            # We'll use a default agent_id of 'dev_agent' for development
            try:
                from supabase import create_client
                from ....core.config import settings
                
                supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
                supabase = create_client(settings.SUPABASE_URL, supabase_key)
                
                # Save to agent_documents table with basic fields only
                import uuid
                dev_user_id = "550e8400-e29b-41d4-a716-446655440001"  # Fixed dev user UUID
                dev_agent_id = "550e8400-e29b-41d4-a716-446655440000"  # Fixed UUID for dev mode
                
                # Ensure dev user and agent exist
                await ensure_dev_user_agent_exists(supabase, dev_user_id, dev_agent_id)
                
                document_row = {
                    "id": document_info["id"],
                    "agent_id": dev_agent_id,
                    "name": document_info["name"],
                    "content": document_info["content"]
                }
                
                result = supabase.table("agent_documents").insert(document_row).execute()
                logger.info(f"💾 DEV: Saved document {document_info['id']} to database")
                
            except Exception as db_error:
                logger.warning(f"⚠️ DEV: Failed to save document to database: {db_error}")
                # Continue anyway - document processing succeeded even if DB save failed
            
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

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user = Depends(get_current_user)
):
    """
    Delete a document from the database.
    Only the document owner can delete their documents.
    """
    try:
        logger.info(f"🗑️ Deleting document {document_id} for user {current_user.id}")
        
        # Use the document service to delete the document
        await document_service.delete_document(document_id, current_user.id)
        
        logger.info(f"✅ Successfully deleted document {document_id}")
        
        return {
            "success": True,
            "message": f"Document {document_id} deleted successfully"
        }
        
    except ValueError as e:
        logger.error(f"❌ Document deletion error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Unexpected error deleting document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Development endpoint (no auth required in DEBUG mode)
if settings.DEBUG:
    @router.delete("/dev/{document_id}")
    async def dev_delete_document(document_id: str):
        """
        Development endpoint for deleting documents without authentication
        Only available when DEBUG=True
        """
        try:
            logger.info(f"🧪 DEV: Deleting document {document_id}")
            
            # Use the document service to delete the document (with dev user)
            await document_service.delete_document(document_id, "dev_user")
            
            logger.info(f"✅ DEV: Successfully deleted document {document_id}")
            
            return {
                "success": True,
                "development_mode": True,
                "message": f"Document {document_id} deleted successfully"
            }
            
        except ValueError as e:
            logger.error(f"❌ DEV: Document deletion error: {e}")
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"❌ DEV: Unexpected error deleting document {document_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/dev/debug-storage")
async def debug_storage():
    """Debug endpoint to understand document storage and persistence"""
    try:
        from supabase import create_client
        
        # Use anon key for basic access
        supabase_key = settings.SUPABASE_ANON_KEY
        supabase = create_client(settings.SUPABASE_URL, supabase_key)
        
        # Check all tables for any data
        debug_info = {}
        
        tables = ["user_profiles", "user_agents", "agent_documents", "agent_integrations"]
        for table in tables:
            try:
                result = supabase.table(table).select("*").limit(10).execute()
                debug_info[table] = {
                    "count": len(result.data) if result.data else 0,
                    "sample": result.data[:3] if result.data else []
                }
            except Exception as e:
                debug_info[table] = {"error": str(e)}
        
        return {
            "success": True,
            "development_mode": True,
            "debug_info": debug_info,
            "message": "Debug information collected"
        }
        
    except Exception as e:
        logger.error(f"❌ DEV: Debug endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Debug error: {str(e)}")

@router.get("/dev/list-all")
async def dev_list_all_documents():
    """Development endpoint to list all documents in the database for debugging"""
    try:
        logger.info("🔍 DEV: Listing all documents in database")
        
        from supabase import create_client
        
        supabase_key = settings.SUPABASE_ANON_KEY
        supabase = create_client(settings.SUPABASE_URL, supabase_key)
        
        all_docs = supabase.table("agent_documents").select("*").execute()
        user_agents = supabase.table("user_agents").select("*").execute()
        
        return {
            "success": True,
            "development_mode": True,
            "agent_documents_count": len(all_docs.data or []),
            "user_agents_count": len(user_agents.data or []),
            "message": f"Found {len(all_docs.data or [])} documents, {len(user_agents.data or [])} agents"
        }
        
    except Exception as e:
        logger.error(f"❌ DEV: Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")