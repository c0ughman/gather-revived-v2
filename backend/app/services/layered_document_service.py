"""
Layered Document Processing Service

Handles AI-powered processing of documents into 3 layers:
- Layer 1: Short summary (~500 tokens) + Word bank (~200 tokens) - Always in context
- Layer 2: Comprehensive facts (~2000 tokens) OR full content if ≤2000 tokens
- Layer 3: Full document text (only for >2000 token documents)
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

from .ai_service import ai_service
from .database_service import database_service
from ..core.context_limits import context_limits

logger = logging.getLogger(__name__)

class LayeredDocumentService:
    
    def __init__(self):
        logger.info("LayeredDocumentService initialized")
    
    async def process_document_layers(self, document_id: str, user_token: str = None) -> Dict[str, Any]:
        """
        Process a document into layered context representations
        """
        try:
            logger.info(f"🔄 Starting layered processing for document: {document_id}")
            
            # Get document from database
            document = await self._get_document(document_id, user_token)
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            # Check if already processed
            if document.get('layered_processing_complete', False):
                logger.info(f"📄 Document {document_id} already processed")
                return {"status": "already_processed", "document_id": document_id}
            
            # Get document content
            content = document.get('extracted_text') or document.get('content', '')
            if not content or content.strip() == '':
                logger.warning(f"⚠️ Document {document_id} has no content to process")
                return {"status": "no_content", "document_id": document_id}
            
            # Estimate token count (rough approximation: 1 token ≈ 4 characters)
            estimated_tokens = max(1, len(content) // 4)
            logger.info(f"📊 Estimated tokens for document {document_id}: {estimated_tokens}")
            
            # Process based on size
            if estimated_tokens <= 2000:
                result = await self._process_small_document(document, content, estimated_tokens)
            else:
                result = await self._process_large_document(document, content, estimated_tokens)
            
            # Update document in database with layers
            await self._save_document_layers(document_id, result, user_token)
            
            logger.info(f"✅ Layered processing complete for document: {document_id}")
            return {
                "status": "success",
                "document_id": document_id,
                "processing_strategy": result["processing_strategy"],
                "estimated_tokens": result["estimated_tokens"]
            }
            
        except Exception as error:
            logger.error(f"❌ Failed to process layers for document {document_id}: {error}")
            return {
                "status": "error", 
                "document_id": document_id,
                "error": str(error)
            }
    
    async def _process_small_document(self, document: Dict[str, Any], content: str, estimated_tokens: int) -> Dict[str, Any]:
        """Process small documents (≤2000 tokens)"""
        logger.info(f"📄 Processing small document: {document.get('name', 'unknown')} ({estimated_tokens} tokens)")
        
        try:
            # Generate Layer 1 components in parallel
            layer1_tasks = [
                self._generate_layer1_summary(document, content),
                self._generate_layer1_word_bank(document, content)
            ]
            
            layer1_summary, layer1_word_bank = await asyncio.gather(*layer1_tasks)
            
            # For small documents, Layer 2 is the full content
            layer2_summary = content
            
            return {
                "layer1_summary": layer1_summary,
                "layer1_word_bank": layer1_word_bank,
                "layer2_summary": layer2_summary,
                "layer3_full_text": None,  # No Layer 3 for small documents
                "estimated_tokens": estimated_tokens,
                "processing_strategy": "small_document"
            }
            
        except Exception as error:
            logger.error(f"❌ Error processing small document: {error}")
            raise error
    
    async def _process_large_document(self, document: Dict[str, Any], content: str, estimated_tokens: int) -> Dict[str, Any]:
        """Process large documents (>2000 tokens)"""
        logger.info(f"📚 Processing large document: {document.get('name', 'unknown')} ({estimated_tokens} tokens)")
        
        try:
            # Generate all layers in parallel
            layer_tasks = [
                self._generate_layer1_summary(document, content),
                self._generate_layer1_word_bank(document, content),
                self._generate_layer2_summary(document, content)
            ]
            
            layer1_summary, layer1_word_bank, layer2_summary = await asyncio.gather(*layer_tasks)
            
            return {
                "layer1_summary": layer1_summary,
                "layer1_word_bank": layer1_word_bank,
                "layer2_summary": layer2_summary,
                "layer3_full_text": content,  # Store full text for large documents
                "estimated_tokens": estimated_tokens,
                "processing_strategy": "large_document"
            }
            
        except Exception as error:
            logger.error(f"❌ Error processing large document: {error}")
            raise error
    
    async def _generate_layer1_summary(self, document: Dict[str, Any], content: str) -> str:
        """Generate Layer 1 Summary (~500 tokens)"""
        document_name = document.get('name', 'unknown')
        document_type = document.get('file_type', 'unknown')
        
        prompt = f"""Create a concise summary of this document in approximately {context_limits.DOCUMENT_LAYER1_SUMMARY_MAX_TOKENS} tokens or less. Focus on:

1. **Main Theme/Purpose**: What is this document fundamentally about?
2. **Key Insights**: The most important ideas, findings, or messages
3. **Context**: Relevant background information that helps understand the document
4. **Practical Relevance**: Why this information matters

Style Guidelines:
- Write clearly and informatively
- Capture the "gestalt" or overall essence
- Include specific details that matter
- Avoid fluff and filler
- Make it standalone readable

Document: {document_name}
Type: {document_type}

Content:
{content}

Summary:"""
        
        try:
            response = await ai_service.generate_text(
                prompt=prompt,
                max_tokens=context_limits.DOCUMENT_LAYER1_SUMMARY_MAX_TOKENS + 100,  # Add buffer for generation
                temperature=0.3
            )
            logger.info(f"✅ Layer 1 summary generated for: {document_name}")
            return response.strip()
            
        except Exception as error:
            logger.error(f"❌ Failed to generate Layer 1 summary for {document_name}: {error}")
            # Fallback to truncated content
            fallback = content[:2000] + ("..." if len(content) > 2000 else "")
            return f"{fallback}\n\n[AI summary generation failed - showing truncated content]"
    
    async def _generate_layer1_word_bank(self, document: Dict[str, Any], content: str) -> str:
        """Generate Layer 1 Word Bank (~200 tokens)"""
        document_name = document.get('name', 'unknown')
        
        prompt = f"""Extract a comprehensive word bank from this document. Include:

**ENTITIES** (People, Places, Organizations):
- Names of people mentioned
- Geographic locations  
- Companies, institutions, brands
- Specific products or services

**CONCEPTS** (Topics, Technologies, Ideas):
- Technical terms and jargon
- Key topics and themes
- Methodologies or approaches
- Important concepts explained

**KEYWORDS** (Repeated Important Terms):
- Domain-specific vocabulary
- Frequently mentioned terms
- Acronyms and abbreviations
- Process names or systems

Format as a clean, organized list. Keep it concise (~{context_limits.DOCUMENT_LAYER1_WORD_BANK_MAX_TOKENS} tokens total). Only include terms that are genuinely important to understanding this document.

Document: {document_name}

Content:
{content}

Word Bank:"""
        
        try:
            response = await ai_service.generate_text(
                prompt=prompt,
                max_tokens=context_limits.DOCUMENT_LAYER1_WORD_BANK_MAX_TOKENS + 100,  # Add buffer for generation
                temperature=0.2
            )
            logger.info(f"✅ Layer 1 word bank generated for: {document_name}")
            return response.strip()
            
        except Exception as error:
            logger.error(f"❌ Failed to generate Layer 1 word bank for {document_name}: {error}")
            # Fallback to simple keyword extraction
            words = content.split()[:50]  # First 50 words as keywords
            return f"Keywords: {', '.join(words)}\n\n[AI word bank generation failed - showing basic extraction]"
    
    async def _generate_layer2_summary(self, document: Dict[str, Any], content: str) -> str:
        """Generate Layer 2 Summary (~2000 tokens)"""
        document_name = document.get('name', 'unknown')
        document_type = document.get('file_type', 'unknown')
        
        prompt = f"""Create a comprehensive factual summary of this document in approximately {context_limits.DOCUMENT_LAYER2_SUMMARY_MAX_TOKENS} tokens. This should be a detailed condensation that:

1. **Preserves All Important Information**: Include key facts, figures, processes, and details
2. **Maintains Logical Structure**: Follow the document's organization where possible
3. **Emphasizes Factual Content**: Focus on concrete information over opinions
4. **Includes Specifics**: Names, dates, numbers, procedures, and technical details
5. **Minimizes Redundancy**: Eliminate repetition and fluff while keeping substance

This summary should allow someone to understand the document's content in detail without needing the full text. Think of it as a detailed executive summary that captures the essence and specifics.

Document: {document_name}
Type: {document_type}

Content:
{content}

Detailed Summary:"""
        
        try:
            response = await ai_service.generate_text(
                prompt=prompt,
                max_tokens=context_limits.DOCUMENT_LAYER2_SUMMARY_MAX_TOKENS + 400,  # Add buffer for generation
                temperature=0.2
            )
            logger.info(f"✅ Layer 2 summary generated for: {document_name}")
            return response.strip()
            
        except Exception as error:
            logger.error(f"❌ Failed to generate Layer 2 summary for {document_name}: {error}")
            # Fallback to truncated content
            fallback = content[:8000] + ("..." if len(content) > 8000 else "")
            return f"{fallback}\n\n[AI detailed summary generation failed - showing truncated content]"
    
    async def _get_document(self, document_id: str, user_token: str = None) -> Optional[Dict[str, Any]]:
        """Get document from database"""
        try:
            # Use user client if token available, otherwise admin client
            if user_token:
                supabase_client = database_service.get_user_client(user_token)
                logger.info(f"🔐 Using user token to fetch document {document_id} (token length: {len(user_token)})")
            else:
                supabase_client = database_service.admin_supabase
                logger.info(f"🔧 Using admin client to fetch document {document_id} (no user token provided)")
            
            logger.info(f"🔍 Executing query: SELECT * FROM agent_documents WHERE id = '{document_id}'")
            result = supabase_client.table("agent_documents").select("*").eq("id", document_id).execute()
            logger.info(f"📊 Query result: {len(result.data) if result.data else 0} documents found")
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            else:
                logger.warning(f"⚠️ Document {document_id} not found in database")
                return None
                
        except Exception as error:
            logger.error(f"❌ Error getting document {document_id}: {error}")
            return None
    
    async def _save_document_layers(self, document_id: str, layer_data: Dict[str, Any], user_token: str = None) -> None:
        """Save processed layers to database"""
        try:
            # Prepare update data
            update_data = {
                "layer1_summary": layer_data["layer1_summary"],
                "layer1_word_bank": layer_data["layer1_word_bank"], 
                "layer2_summary": layer_data["layer2_summary"],
                "layer3_full_text": layer_data.get("layer3_full_text"),
                "estimated_tokens": layer_data["estimated_tokens"],
                "layered_processing_complete": True,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Use user client if token available, otherwise admin client
            if user_token:
                supabase_client = database_service.get_user_client(user_token)
                logger.info(f"🔐 Using user token to save layers for document {document_id}")
            else:
                supabase_client = database_service.admin_supabase
                logger.info(f"🔧 Using admin client to save layers for document {document_id}")
            
            result = supabase_client.table("agent_documents").update(update_data).eq("id", document_id).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"✅ Saved layered data for document: {document_id}")
            else:
                raise Exception("No data returned from update operation")
                
        except Exception as error:
            logger.error(f"❌ Error saving layers for document {document_id}: {error}")
            raise error
    
    async def process_document_async(self, document_id: str, user_token: str = None) -> None:
        """
        Process document layers asynchronously (fire-and-forget)
        This method doesn't block the document upload response
        """
        try:
            logger.info(f"🚀 Starting async layered processing for document: {document_id}")
            result = await self.process_document_layers(document_id, user_token)
            logger.info(f"🎉 Async processing result for {document_id}: {result['status']}")
        except Exception as error:
            logger.error(f"❌ Async processing failed for document {document_id}: {error}")
            # Don't re-raise - this is fire-and-forget

# Create global instance
layered_document_service = LayeredDocumentService()