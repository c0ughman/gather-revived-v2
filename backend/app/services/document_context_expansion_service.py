"""
Document Context Expansion Service

Manages dynamic expansion of document context based on AI agent needs.
Supports layer-by-layer context expansion with 2-document Layer 3 limit.
"""

import logging
from typing import Dict, Any, List, Optional, Set
from datetime import datetime

from .database_service import database_service

logger = logging.getLogger(__name__)

class DocumentContextExpansionService:
    
    def __init__(self):
        # Track currently loaded Layer 3 documents per session/agent
        self.layer3_cache: Dict[str, Set[str]] = {}  # agent_id -> set of document_ids
        logger.info("DocumentContextExpansionService initialized")
    
    async def expand_document_context(
        self, 
        agent_id: str, 
        document_names: List[str], 
        target_layer: int = 2,
        user_token: str = None
    ) -> Dict[str, Any]:
        """
        Expand document context by loading deeper layers of specified documents.
        
        Args:
            agent_id: The agent requesting context expansion
            document_names: List of document names to expand (e.g., ["report.pdf", "data.xlsx"])
            target_layer: Target layer to expand to (2 or 3)
            user_token: User authentication token
            
        Returns:
            Dict with expanded context and metadata
        """
        try:
            logger.info(f"📈 Context expansion request for agent {agent_id[:8]}")
            logger.info(f"   Documents: {document_names}")
            logger.info(f"   Target layer: {target_layer}")
            
            # Get agent's documents - use get_all_agent_context for consistency with voice service
            agent_context = await database_service.get_all_agent_context(agent_id, user_token)
            
            # Extract documents from the context structure
            agent_documents = []
            if agent_context:
                agent_documents.extend(agent_context.get("permanentDocuments", []))
                agent_documents.extend(agent_context.get("conversationDocuments", []))
            
            logger.info(f"📚 Retrieved {len(agent_documents)} total documents from agent context")
            
            # Log available documents for debugging
            logger.info(f"📋 Available documents for agent {agent_id[:8]}:")
            for i, doc in enumerate(agent_documents):
                doc_name = doc.get('name', 'Unknown')
                logger.info(f"   {i+1}. '{doc_name}'")
            
            # Find matching documents
            matched_documents = []
            for doc_name in document_names:
                logger.info(f"🔍 Looking for document: '{doc_name}'")
                doc = self._find_document_by_name(agent_documents, doc_name)
                if doc:
                    matched_documents.append(doc)
                    logger.info(f"✅ Found match: '{doc.get('name', 'Unknown')}'")
                else:
                    logger.warning(f"⚠️ Document '{doc_name}' not found for agent {agent_id[:8]}")
            
            if not matched_documents:
                return {
                    "success": False,
                    "error": "No matching documents found",
                    "expanded_context": "",
                    "metadata": {
                        "requested_documents": document_names,
                        "matched_documents": 0,
                        "target_layer": target_layer
                    }
                }
            
            # Build expanded context based on target layer
            if target_layer == 2:
                expanded_context = await self._build_layer2_context(matched_documents)
            elif target_layer == 3:
                expanded_context = await self._build_layer3_context(matched_documents, agent_id)
            else:
                return {
                    "success": False,
                    "error": f"Invalid target layer {target_layer}. Must be 2 or 3.",
                    "expanded_context": "",
                    "metadata": {}
                }
            
            logger.info(f"✅ Context expansion complete for agent {agent_id[:8]}")
            logger.info(f"   Expanded {len(matched_documents)} documents to Layer {target_layer}")
            logger.info(f"   Total context length: {len(expanded_context)} characters")
            
            return {
                "success": True,
                "expanded_context": expanded_context,
                "metadata": {
                    "requested_documents": document_names,
                    "matched_documents": len(matched_documents),
                    "target_layer": target_layer,
                    "context_length": len(expanded_context),
                    "document_details": [
                        {
                            "name": doc["name"],
                            "processing_strategy": "small_document" if doc.get("estimated_tokens", 0) <= 2000 else "large_document",
                            "estimated_tokens": doc.get("estimated_tokens", 0),
                            "layer_used": target_layer
                        }
                        for doc in matched_documents
                    ]
                }
            }
            
        except Exception as error:
            logger.error(f"❌ Context expansion failed for agent {agent_id[:8]}: {error}")
            return {
                "success": False,
                "error": str(error),
                "expanded_context": "",
                "metadata": {
                    "requested_documents": document_names,
                    "target_layer": target_layer
                }
            }
    
    async def _build_layer2_context(self, documents: List[Dict[str, Any]]) -> str:
        """Build Layer 2 context (comprehensive facts or full content)"""
        context_parts = []
        
        for doc in documents:
            if not doc.get("layered_processing_complete"):
                logger.warning(f"⚠️ Document {doc['name']} not fully processed - using basic content")
                content = doc.get("content", "") or doc.get("extracted_text", "")
                context_parts.append(f"📄 **{doc['name']}** (unprocessed content):\n{content[:2000]}...")
                continue
            
            layer2_summary = doc.get("layer2_summary")
            if layer2_summary:
                estimated_tokens = doc.get("estimated_tokens", 0)
                strategy = "Full Content" if estimated_tokens <= 2000 else "Comprehensive Summary"
                context_parts.append(f"📄 **{doc['name']}** ({strategy}):\n{layer2_summary}")
            else:
                logger.warning(f"⚠️ Document {doc['name']} missing Layer 2 summary")
                
        return "\n\n".join(context_parts)
    
    async def _build_layer3_context(self, documents: List[Dict[str, Any]], agent_id: str) -> str:
        """Build Layer 3 context (full document text) with 2-document limit"""
        
        # Initialize cache for this agent if needed
        if agent_id not in self.layer3_cache:
            self.layer3_cache[agent_id] = set()
        
        current_layer3_docs = self.layer3_cache[agent_id]
        
        # Check 2-document limit for Layer 3
        available_slots = 2 - len(current_layer3_docs)
        
        if len(documents) > available_slots:
            # Need to evict some documents
            documents_to_process = documents[:available_slots] if available_slots > 0 else []
            
            if available_slots == 0:
                # Evict oldest document (simple FIFO for now)
                evicted_doc = current_layer3_docs.pop()
                logger.info(f"📤 Evicted document from Layer 3 cache: {evicted_doc[:8]}")
                documents_to_process = documents[:1]
        else:
            documents_to_process = documents
        
        context_parts = []
        
        for doc in documents_to_process:
            doc_id = doc["id"]
            
            if not doc.get("layered_processing_complete"):
                logger.warning(f"⚠️ Document {doc['name']} not fully processed")
                content = doc.get("content", "") or doc.get("extracted_text", "")
                context_parts.append(f"📄 **{doc['name']}** (Full Content - Unprocessed):\n{content}")
                current_layer3_docs.add(doc_id)
                continue
            
            # For documents > 2000 tokens, use layer3_full_text
            # For documents <= 2000 tokens, use layer2_summary (which is full content)
            estimated_tokens = doc.get("estimated_tokens", 0)
            
            if estimated_tokens <= 2000:
                # Small document - Layer 2 already contains full content
                full_content = doc.get("layer2_summary") or doc.get("content", "")
                context_parts.append(f"📄 **{doc['name']}** (Complete Document):\n{full_content}")
            else:
                # Large document - Use Layer 3 full text
                full_content = doc.get("layer3_full_text") or doc.get("content", "")
                context_parts.append(f"📄 **{doc['name']}** (Complete Document):\n{full_content}")
            
            current_layer3_docs.add(doc_id)
            logger.info(f"📥 Loaded document into Layer 3 cache: {doc['name']} ({doc_id[:8]})")
        
        # Update cache
        self.layer3_cache[agent_id] = current_layer3_docs
        
        return "\n\n".join(context_parts)
    
    def _find_document_by_name(self, documents: List[Dict[str, Any]], name: str) -> Optional[Dict[str, Any]]:
        """Find document by name (fuzzy matching)"""
        
        # Exact match first
        for doc in documents:
            if doc.get("name", "").lower() == name.lower():
                logger.info(f"🎯 Exact match: '{name}' -> '{doc.get('name')}'")
                return doc
        
        # Partial match - check both directions
        name_lower = name.lower()
        for doc in documents:
            doc_name = doc.get("name", "").lower()
            if name_lower in doc_name or doc_name in name_lower:
                logger.info(f"🎯 Partial match: '{name}' -> '{doc.get('name')}'")
                return doc
        
        # More aggressive fuzzy matching for very long names
        # Split on common separators and try matching significant parts
        name_parts = [part.strip() for part in name.lower().replace("-", " ").replace("_", " ").split() if len(part.strip()) > 3]
        
        for doc in documents:
            doc_name = doc.get("name", "").lower()
            doc_parts = [part.strip() for part in doc_name.replace("-", " ").replace("_", " ").split() if len(part.strip()) > 3]
            
            # Count matching significant parts
            matching_parts = 0
            for name_part in name_parts:
                for doc_part in doc_parts:
                    if name_part in doc_part or doc_part in name_part:
                        matching_parts += 1
                        break
            
            # If at least 3 significant parts match, consider it a match
            if matching_parts >= min(3, len(name_parts) // 2, len(doc_parts) // 2):
                logger.info(f"🎯 Fuzzy match ({matching_parts} parts): '{name}' -> '{doc.get('name')}'")
                return doc
        
        # Final fallback: try matching just the base filename
        import os
        name_base = os.path.splitext(name)[0].lower()
        for doc in documents:
            doc_name_base = os.path.splitext(doc.get("name", ""))[0].lower()
            if name_base in doc_name_base or doc_name_base in name_base:
                logger.info(f"🎯 Filename match: '{name}' -> '{doc.get('name')}'")
                return doc
        
        return None
    
    def get_layer3_cache_status(self, agent_id: str) -> Dict[str, Any]:
        """Get current Layer 3 cache status for debugging"""
        current_docs = self.layer3_cache.get(agent_id, set())
        
        return {
            "agent_id": agent_id,
            "layer3_documents_loaded": len(current_docs),
            "max_layer3_documents": 2,
            "available_slots": 2 - len(current_docs),
            "loaded_document_ids": list(current_docs)
        }
    
    def clear_layer3_cache(self, agent_id: str) -> None:
        """Clear Layer 3 cache for an agent (useful for testing)"""
        if agent_id in self.layer3_cache:
            del self.layer3_cache[agent_id]
            logger.info(f"🧹 Cleared Layer 3 cache for agent {agent_id[:8]}")

# Create global instance
document_context_expansion_service = DocumentContextExpansionService()