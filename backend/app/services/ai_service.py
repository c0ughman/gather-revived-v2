import asyncio
import logging
import httpx
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from ..core.config import settings
from ..core.context_limits import context_limits
from .integrations_service import integrations_service
from .database_service import database_service

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.google_api_key = settings.GOOGLE_API_KEY
        if not self.google_api_key:
            logger.warning("Google API key not configured")
        
        # Gemini API endpoints
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        
        # Initialize HTTP client with proper configuration
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(context_limits.HTTP_TIMEOUT_SECONDS),
            limits=httpx.Limits(
                max_keepalive_connections=context_limits.HTTP_MAX_KEEPALIVE_CONNECTIONS,
                max_connections=context_limits.HTTP_MAX_CONNECTIONS
            )
        )
        
        # Function declarations for integrations
        self.function_declarations = self._get_function_declarations()
        
        # Context testing configuration
        self.context_testing_enabled = settings.CONTEXT_TESTING_ENABLED
        self.context_testing_webhook_url = settings.CONTEXT_TESTING_WEBHOOK_URL
        
        if self.context_testing_enabled:
            logger.info(f"🔬 Context testing mode ENABLED - webhook: {self.context_testing_webhook_url}")
        else:
            logger.info("🔬 Context testing mode DISABLED")
    
    async def _send_to_context_testing_webhook(self, test_data: Dict[str, Any]) -> None:
        """
        Send request data to context testing webhook for debugging.
        This runs asynchronously and doesn't impact performance.
        """
        if not self.context_testing_enabled or not self.context_testing_webhook_url:
            return
            
        try:
            # Create a copy of the data with sensitive information redacted
            safe_data = test_data.copy()
            
            # Redact API keys and sensitive data
            if "payload" in safe_data and "generationConfig" in safe_data["payload"]:
                safe_data["payload"] = safe_data["payload"].copy()
                # Don't redact generation config as it's useful for testing
                
            # Add metadata
            safe_data["_metadata"] = {
                "timestamp": datetime.now().isoformat(),
                "source": "gather_backend_ai_service",
                "testing_mode": "context_testing",
                "version": "1.0.0"
            }
            
            # Send to webhook asynchronously without blocking
            asyncio.create_task(self._send_webhook_data_async(safe_data))
            
        except Exception as e:
            # Never let testing mode break the main flow
            logger.debug(f"Context testing webhook failed (non-blocking): {e}")
    
    async def _send_webhook_data_async(self, data: Dict[str, Any]) -> None:
        """Send data to webhook asynchronously"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    self.context_testing_webhook_url,
                    json=data,
                    headers={"Content-Type": "application/json"}
                )
                if response.status_code == 200:
                    logger.debug("🔬 Context testing data sent to webhook successfully")
                else:
                    logger.debug(f"🔬 Context testing webhook returned {response.status_code}")
        except Exception as e:
            logger.debug(f"🔬 Context testing webhook error: {e}")
    
    async def generate_response(
        self,
        contact: Dict[str, Any],
        user_message: str,
        chat_history: List[Dict[str, Any]],
        conversation_documents: List[Dict[str, Any]] = None,
        current_conversation: List[Dict[str, Any]] = None,
        user_token: str = None
    ) -> Dict[str, Any]:
        """
        Generate AI response using Google Gemini API.
        This replaces the frontend geminiService for better performance and security.
        """
        try:
            logger.info(f"🤖 Generating response for {contact.get('name', 'Unknown Contact')}")
            
            if not self.google_api_key:
                raise ValueError("Google API key not configured")
            
            # Build context from contact info, memory, and documents
            context = await self._build_contact_context(contact, conversation_documents or [])
            
            # Use chat history as-is (frontend handles truncation to stay within token limits)
            compacted_chat_history = chat_history
            
            # Build conversation history for function calling API
            conversation_contents = self._build_conversation_contents(compacted_chat_history, user_message, contact.get('name', 'AI'))
            
            logger.info(f"📝 Sending conversation to Gemini API with {len(self.function_declarations)} function declarations")
            logger.info(f"🔧 Available functions: {[f['name'] for f in self.function_declarations]}")
            
            # Build full system instruction
            full_system_instruction = context + "\n\n🚨 SEARCH CAPABILITY 🚨\n\nYou have access to search functions to find information from past conversations when needed. Use search_conversation_history for detailed conversation context and search_past_conversations for quick fact lookups. Your memory context above contains general patterns, but you can search for specific details when helpful."
            
            # Log the full prompt being sent to Gemini API
            logger.info("=" * 80)
            logger.info("🔍 FULL PROMPT BEING SENT TO GEMINI API:")
            logger.info("=" * 80)
            logger.info(f"📜 SYSTEM INSTRUCTION ({len(full_system_instruction)} chars):")
            logger.info(full_system_instruction)
            logger.info("-" * 40)
            logger.info(f"💬 CONVERSATION CONTENTS ({len(conversation_contents)} messages):")
            for i, content in enumerate(conversation_contents):
                role = content.get('role', 'unknown')
                parts = content.get('parts', [])
                text_parts = [part.get('text', '') for part in parts if 'text' in part]
                full_text = ' | '.join(text_parts)
                logger.info(f"  {i+1}. {role.upper()}: {full_text}")
            logger.info("=" * 80)
            
            # Prepare request payload with function calling
            payload = {
                "contents": conversation_contents,
                "tools": [
                    {
                        "function_declarations": self.function_declarations
                    }
                ],
                "generationConfig": context_limits.get_ai_config(),
                "safetySettings": [
                    {
                        "category": "HARM_CATEGORY_HARASSMENT", 
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_HATE_SPEECH",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ],
                "systemInstruction": {
                    "parts": [
                        {
                            "text": full_system_instruction
                        }
                    ]
                }
            }
            
            # Send to context testing webhook if enabled (non-blocking)
            if self.context_testing_enabled:
                # Capture the EXACT data that gets sent to Gemini API
                test_data = {
                    "request_type": "gemini_api_request",
                    "metadata": {
                        "contact_name": contact.get('name', 'Unknown'),
                        "contact_id": contact.get('id', 'Unknown'),
                        "original_chat_history_length": len(chat_history),
                        "processed_conversation_contents_length": len(conversation_contents),
                        "compacted_chat_history_length": len(compacted_chat_history),
                        "user_message": user_message,
                        "documents_count": len(conversation_documents or []),
                        "function_declarations_count": len(self.function_declarations)
                    },
                    "gemini_request": {
                        "url": f"{self.base_url}/models/gemini-2.5-flash:generateContent",
                        "method": "POST",
                        "payload": payload,
                        "system_instruction_full": full_system_instruction,
                        "conversation_contents_processed": conversation_contents,
                        "function_declarations": self.function_declarations
                    },
                    "processing_info": {
                        "was_conversation_compacted": len(compacted_chat_history) != len(chat_history),
                        "original_message_count": len(chat_history),
                        "compacted_message_count": len(compacted_chat_history),
                        "final_conversation_contents": len(conversation_contents)
                    }
                }
                await self._send_to_context_testing_webhook(test_data)
            
            # Make initial API request
            response = await self._call_gemini_api('models/gemini-2.5-flash:generateContent', payload)
            
            # Log response structure for debugging
            candidates = response.get('candidates', [])
            if candidates:
                candidate = candidates[0]
                content = candidate.get('content', {})
                parts = content.get('parts', [])
                has_function_calls = any('functionCall' in part for part in parts)
                has_text = any('text' in part for part in parts)
                logger.info(f"📋 Gemini response: {len(parts)} parts, function_calls={has_function_calls}, text={has_text}")
            
            # Handle function calling response
            ai_response = await self._handle_function_calling_response(response, conversation_contents, payload, contact, user_token)
            
            # Return simple response (no compacting, no token analysis)
            return {
                'response': ai_response
            }
            
        except Exception as error:
            logger.error(f"❌ Error generating AI response: {error}")
            raise ValueError(f"Failed to generate AI response: {str(error)}")
    
    async def summarize_document(self, document_content: str, filename: str) -> str:
        """
        Generate a summary of a document using Gemini API.
        """
        try:
            logger.info(f"📄 Summarizing document: {filename}")
            
            if not self.google_api_key:
                raise ValueError("Google API key not configured")
            
            prompt = f"""Please provide a comprehensive summary of this document:

**Document:** {filename}

**Content:**
{context_limits.truncate_document_content(document_content, "summary")}  # Limit content to avoid token limits

Please summarize:
1. Main topics and themes
2. Key points and findings
3. Important details
4. Overall purpose/conclusion

Keep the summary detailed but concise."""
            
            payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": prompt
                            }
                        ]
                    }
                ],
                "generationConfig": context_limits.get_summary_config()
            }
            
            response = await self._call_gemini_api('models/gemini-2.5-flash:generateContent', payload)
            
            candidates = response.get('candidates', [])
            if not candidates:
                return f"Summary: {filename} - Content analysis not available"
            
            candidate = candidates[0]
            content = candidate.get('content', {})
            parts = content.get('parts', [])
            
            if not parts:
                return f"Summary: {filename} - Content analysis not available"
            
            summary = parts[0].get('text', '')
            
            logger.info(f"✅ Generated summary for {filename}")
            return summary
            
        except Exception as error:
            logger.error(f"❌ Error summarizing document {filename}: {error}")
            return f"Summary: {filename} - Error generating summary: {str(error)}"

    async def generate_text(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
        """
        Generate text using Gemini API for document processing tasks.
        This method is optimized for layered document processing.
        """
        if not self.google_api_key:
            raise Exception("Google API key not configured")
        
        try:
            logger.info(f"🤖 Generating text with Gemini (prompt: {len(prompt)} chars, max_tokens: {max_tokens})")
            
            # Build request payload
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "maxOutputTokens": max_tokens,
                    "temperature": temperature,
                    "topP": 1.0,
                    "topK": 1
                },
                "safetySettings": [
                    {
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_HATE_SPEECH",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            }
            
            # Make API call
            response = await self._call_gemini_api("models/gemini-1.5-flash:generateContent", payload)
            
            # Extract text from response
            if "candidates" in response and len(response["candidates"]) > 0:
                candidate = response["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    generated_text = candidate["content"]["parts"][0].get("text", "")
                    logger.info(f"✅ Text generated successfully ({len(generated_text)} chars)")
                    return generated_text
            
            # Fallback if no valid response
            logger.warning("⚠️ No valid text generated from Gemini API")
            return "Error: No text generated"
            
        except Exception as error:
            logger.error(f"❌ Error generating text: {error}")
            raise Exception(f"Text generation failed: {str(error)}")
    
    async def _call_gemini_api(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make authenticated request to Gemini API.
        """
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = await self.client.post(
                url,
                json=payload,
                params={"key": self.google_api_key}
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"❌ Gemini API error: {response.status_code} - {error_detail}")
                raise ValueError(f"Gemini API error: {response.status_code}")
            
            return response.json()
            
        except httpx.RequestError as e:
            logger.error(f"❌ HTTP request error: {e}")
            raise ValueError(f"Request failed: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Unexpected error calling Gemini API: {e}")
            raise ValueError(f"API call failed: {str(e)}")
    
    async def _build_contact_context(self, contact: Dict[str, Any], documents: List[Dict[str, Any]]) -> str:
        """
        Build context string from contact information, memory, and documents.
        """
        # Extract clean description - if it contains formatted context, clean it
        raw_description = contact.get('description', 'A helpful AI assistant.')
        
        # Clean the description if it contains formatted context (starts with "You are...")
        if raw_description.startswith(f"You are {contact.get('name', '')}."):
            # Extract only the basic description after the name
            parts = raw_description.split('\n\n', 1)
            if len(parts) > 1:
                # Take the first line which should be the basic description
                first_part = parts[0]
                if '. ' in first_part:
                    description = first_part.split('. ', 1)[1]
                else:
                    description = 'A helpful AI assistant.'
            else:
                # Fallback - extract text after "You are NAME. "
                name_prefix = f"You are {contact.get('name', '')}.  "
                if raw_description.startswith(name_prefix):
                    description = raw_description[len(name_prefix):].split('\n')[0].strip()
                else:
                    description = 'A helpful AI assistant.'
        else:
            description = raw_description
        
        # Truncate clean description to fit token limits
        truncated_description = context_limits.truncate_agent_description(description)
        
        context = f"You are {contact.get('name', 'AI Assistant')}. {truncated_description}"
        
        # Add memory context if available
        agent_id = contact.get('id')
        logger.info(f"🧠 Attempting to load memory context for agent: {agent_id}")
        if agent_id:
            try:
                # Get agent memory context
                memory_context = await database_service.get_agent_memory_context(agent_id)
                logger.info(f"🧠 Memory context result: {memory_context is not None}")
                if memory_context:
                    logger.info(f"🧠 Memory context length: {len(memory_context)} characters")
                    logger.info(f"🧠 Memory context preview: {memory_context[:200]}...")
                    context += f"\n\n=== YOUR MEMORY ===\n"
                    context += "You have access to your memory from previous conversations. Use this to provide continuity and personalization:\n\n"
                    context += memory_context
                    context += "\n\nUse your memory to:\n"
                    context += "- Reference previous conversations and topics\n"
                    context += "- Maintain consistency in your responses\n"
                    context += "- Provide personalized interactions based on past context"
                else:
                    logger.warning(f"🧠 No memory context returned for agent {agent_id}")
            except Exception as e:
                logger.error(f"❌ Failed to load memory context for agent {agent_id}: {e}")
        else:
            logger.warning("🧠 No agent ID provided, skipping memory context")
        
        # Add documents to context if available
        if documents:
            context += "\n\n=== YOUR KNOWLEDGE BASE ===\n"
            context += "You have access to the following documents. Use the expand_document_context function when you need more detailed information:\n\n"
            
            for doc in documents:
                # Use Layer 1 context (always available) - summary + word bank
                doc_name = doc.get('name', 'Unknown')
                
                # Check if document has layered processing
                if doc.get('layered_processing_complete'):
                    # Use Layer 1 summary and word bank
                    layer1_summary = doc.get('layer1_summary', '')
                    layer1_word_bank = doc.get('layer1_word_bank', '')
                    estimated_tokens = doc.get('estimated_tokens', 0)
                    
                    context += f"📄 **{doc_name}** ({estimated_tokens} tokens)\n"
                    if layer1_summary:
                        context += f"📋 Summary: {layer1_summary}\n"
                    if layer1_word_bank:
                        context += f"🏷️ Keywords: {layer1_word_bank}\n"
                    context += "\n"
                else:
                    # Fallback to basic content for unprocessed documents
                    doc_content = doc.get('extracted_text') or doc.get('content', '')
                    if doc_content:
                        context += f"📄 **{doc_name}** (unprocessed)\n"
                        context += f"📖 Content: {context_limits.truncate_document_content(doc_content, 'chat')}\n\n"
            
            context += "💡 **IMPORTANT**: These are lightweight Layer 1 summaries (~700 tokens each). When you need more detailed information from any document, you MUST use the `expand_document_context` function to access:\n"
            context += "- Layer 2: Comprehensive facts and details (~2000 tokens) - for most detailed questions\n"
            context += "- Layer 3: Complete document content - for exact quotes, specific data, or comprehensive analysis\n"
            context += "\n🔍 **USE expand_document_context WHEN**:\n"
            context += "- User asks specific questions requiring document details\n"
            context += "- User wants exact quotes, data, or specific information from documents\n" 
            context += "- Layer 1 summaries don't contain sufficient detail to answer the question\n"
            context += "- User asks 'what does the document say about X' or similar detailed queries\n"
            context += "\n**Example**: If user asks 'What are the specific recommendations in the report?', call `expand_document_context([\"report.pdf\"], target_layer=2, reason=\"User needs specific recommendations\")`"
        
        return context
    
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check if AI service is healthy and can connect to Gemini API.
        """
        try:
            if not self.google_api_key:
                return {
                    "status": "unhealthy",
                    "error": "Google API key not configured"
                }
            
            # Test simple API call
            test_payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": "Hello, respond with 'OK' if you can hear me."
                            }
                        ]
                    }
                ],
                "generationConfig": context_limits.get_health_check_config()
            }
            
            response = await self._call_gemini_api('models/gemini-2.5-flash:generateContent', test_payload)
            
            candidates = response.get('candidates', [])
            if candidates:
                return {
                    "status": "healthy",
                    "api_connection": "successful",
                    "model": "gemini-2.5-flash"
                }
            else:
                return {
                    "status": "unhealthy",
                    "error": "No response from API"
                }
                
        except Exception as e:
            logger.error(f"❌ AI service health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def _get_function_declarations(self) -> List[Dict[str, Any]]:
        """Get function declarations for chat integration support"""
        return [
            {
                "name": "search_web",
                "description": "Search the web for current information, news, facts, or real-time data using Tavily AI search engine. Use when users ask to search, look up, google, find information, or get current/recent data about anything.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query - what to search for on the web"
                        },
                        "searchDepth": {
                            "type": "string",
                            "description": "Search depth for better results",
                            "enum": ["basic", "advanced"],
                            "default": "basic"
                        },
                        "maxResults": {
                            "type": "integer",
                            "description": "Maximum number of search results to return (1-20)",
                            "default": 5
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "scrape_website",
                "description": "Extract content from websites when users ask to scrape, crawl, or get content from specific URLs. Use when user asks to go to a website and get its content.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to scrape content from"
                        },
                        "extractType": {
                            "type": "string",
                            "description": "Type of content to extract",
                            "enum": ["text", "markdown", "html"],
                            "default": "markdown"
                        },
                        "includeImages": {
                            "type": "boolean",
                            "description": "Whether to include images",
                            "default": False
                        }
                    },
                    "required": ["url"]
                }
            },
            {
                "name": "search_past_conversations",
                "description": "Search past conversations and saved memories to find specific information, facts, or details from previous interactions. Use when you need to recall specific information the user has shared or discussed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Key search terms extracted from user's question. Examples: 'password' for 'what was the password', 'book' for 'that book you mentioned', 'project' for 'my project', 'React' for 'React discussion', etc. Use the main subject/topic the user is asking about."
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results to return (1-10). Default is 3.",
                            "default": 3,
                            "minimum": 1,
                            "maximum": 10
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "search_conversation_history",
                "description": "Search detailed conversation history for discussions, topics, and context. Use when you need to find specific past conversations, detailed discussion context, or when the user asks about previous chats or topics you've discussed together.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Key search terms for finding conversations. Examples: 'project discussion', 'API documentation', 'meeting notes', 'code review', etc."
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of conversation results to return (1-10). Default is 5.",
                            "default": 5,
                            "minimum": 1,
                            "maximum": 10
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "expand_document_context",
                "description": "🔍 EXPAND DOCUMENT CONTEXT: Use this function when you need more detailed information from specific documents in your knowledge base. This loads deeper layers of document content when the basic summaries aren't sufficient to answer the user's question. WHEN TO USE: User asks specific questions about document details, wants comprehensive information from a particular document, needs exact quotes or data from documents, or when Layer 1 summaries don't contain enough detail to provide a complete answer.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "document_names": {
                            "type": "array",
                            "description": "List of document names to expand context for (e.g., ['report.pdf', 'data.xlsx']). Use the exact document names from your knowledge base.",
                            "items": {
                                "type": "string"
                            },
                            "minItems": 1,
                            "maxItems": 5
                        },
                        "target_layer": {
                            "type": "string", 
                            "description": "Target layer for expansion: 2 = comprehensive facts summary (~2000 tokens), 3 = complete document content (use sparingly, max 2 docs)",
                            "enum": ["2", "3"],
                            "default": "2"
                        },
                        "reason": {
                            "type": "string",
                            "description": "Brief explanation of why you need expanded context (for logging and optimization)"
                        }
                    },
                    "required": ["document_names", "reason"]
                }
            }
        ]
    
    def _build_conversation_contents(self, chat_history: List[Dict[str, Any]], user_message: str, contact_name: str) -> List[Dict[str, Any]]:
        """Build conversation contents for Gemini API function calling format"""
        contents = []
        
        # Use the chat history as-is (it's already been compacted if needed)
        # No additional filtering since compacting already handled token limits
        recent_history = chat_history or []
        
        for message in recent_history:
            sender = message.get('sender', 'unknown')
            content = message.get('content', '')
            
            if sender == 'user':
                contents.append({
                    "role": "user",
                    "parts": [{"text": content}]
                })
            else:
                contents.append({
                    "role": "model", 
                    "parts": [{"text": content}]
                })
        
        # Add current user message
        contents.append({
            "role": "user",
            "parts": [{"text": user_message}]
        })
        
        return contents
    
    async def _handle_function_calling_response(self, response: Dict[str, Any], conversation_contents: List[Dict[str, Any]], original_payload: Dict[str, Any], contact: Dict[str, Any], user_token: str = None) -> str:
        """Handle Gemini API response with function calling"""
        try:
            candidates = response.get('candidates', [])
            if not candidates:
                raise ValueError('No response candidates from Gemini API')
            
            candidate = candidates[0]
            content = candidate.get('content', {})
            parts = content.get('parts', [])
            
            if not parts:
                raise ValueError('No content parts in Gemini API response')
            
            # Check if there's a function call
            function_calls = []
            text_response = ""
            
            for part in parts:
                if 'functionCall' in part:
                    function_calls.append(part['functionCall'])
                elif 'text' in part:
                    text_response += part['text']
            
            # If there are function calls, execute them
            if function_calls:
                logger.info(f"🔧 Executing {len(function_calls)} function call(s)")
                
                # Add the model's function call to conversation
                conversation_contents.append({
                    "role": "model",
                    "parts": [{"functionCall": fc} for fc in function_calls]
                })
                
                # Execute function calls and add responses
                function_responses = []
                for function_call in function_calls:
                    function_name = function_call.get('name')
                    function_args = function_call.get('args', {})
                    
                    logger.info(f"🔧 Executing function: {function_name}")
                    
                    try:
                        if function_name == "search_web":
                            result = await integrations_service.execute_web_search_tool(
                                query=function_args.get('query'),
                                search_depth=function_args.get('searchDepth', 'basic'),
                                max_results=function_args.get('maxResults', 5),
                                include_answer=True
                            )
                        elif function_name == "scrape_website":
                            result = await integrations_service.execute_firecrawl_tool_operation(
                                url=function_args.get('url'),
                                extract_type=function_args.get('extractType', 'markdown'),
                                include_images=function_args.get('includeImages', False),
                                max_pages=5
                            )
                        elif function_name == "search_past_conversations":
                            # Get agent_id from contact
                            agent_id = contact.get('id')
                            query = function_args.get('query')
                            logger.info(f"🏴‍☠️ AI CALLED PAST CHATS - Barcelona - Agent: {agent_id} - SEARCH KEYWORD: \"{query}\"")
                            logger.info(f"🚀 AI CALLED search_past_conversations")
                            logger.info(f"🔍 AI Function args: {function_args}")
                            logger.info(f"🔍 Contact agent_id: {agent_id}")
                            logger.info(f"🔍 Contact name: {contact.get('name', 'Unknown')}")
                            
                            if not agent_id:
                                logger.error(f"❌ Agent ID not found in contact: {contact}")
                                result = {"success": False, "error": "Agent ID not found"}
                            else:
                                query = function_args.get('query')
                                limit = context_limits.clamp_search_limit(
                                    function_args.get('limit', context_limits.SEARCH_PAST_CONVERSATIONS_DEFAULT_LIMIT),
                                    'past_conversations'
                                )
                                
                                logger.info(f"🔍 AI SEARCH PARAMETERS: query='{query}', limit={limit}")
                                logger.info(f"🔍 About to call database_service.search_past_conversations...")
                                
                                # Search past conversations in database (NOT current chat history)
                                conversations = await database_service.search_past_conversations(agent_id, query, limit)
                                
                                logger.info(f"🔍 AI SEARCH COMPLETED: {len(conversations) if conversations else 0} results returned")
                                
                                if conversations:
                                    logger.info(f"🔍 AI received conversation results:")
                                    for i, conv in enumerate(conversations[:3]):
                                        logger.info(f"🔍   {i+1}. {conv.get('conversation_type', 'unknown')} - {conv.get('title', 'No title')}")
                                
                                if conversations:
                                    # Format results for AI consumption
                                    formatted_results = []
                                    for conv in conversations:
                                        formatted_results.append({
                                            "date": conv.get("date"),
                                            "summary": conv.get("summary", ""),
                                            "relevant_excerpt": conv.get("excerpt", ""),
                                            "message_count": conv.get("message_count", 0),
                                            "conversation_type": conv.get("conversation_type", "chat")
                                        })
                                    
                                    result = {
                                        "success": True,
                                        "query": query,
                                        "results_count": len(formatted_results),
                                        "conversations": formatted_results,
                                        "message": f"Found {len(formatted_results)} relevant past conversation{'s' if len(formatted_results) != 1 else ''}."
                                    }
                                    
                                    logger.info(f"🔍 AI RESULT SUCCESS: {len(formatted_results)} results formatted for AI")
                                    if formatted_results:
                                        logger.info(f"🔍 Sample result structure: {list(formatted_results[0].keys()) if formatted_results else 'N/A'}")
                                else:
                                    result = {
                                        "success": True,
                                        "query": query,
                                        "results_count": 0,
                                        "message": "No relevant past conversations found for this query."
                                    }
                                    logger.info(f"🔍 AI RESULT EMPTY: No conversations found for query '{query}'")
                        elif function_name == "search_conversation_history":
                            # Get agent_id from contact
                            agent_id = contact.get('id')
                            query = function_args.get('query')
                            logger.info(f"🏴‍☠️ AI CALLED CONVERSATION HISTORY - Barcelona - Agent: {agent_id} - SEARCH KEYWORD: \"{query}\"")
                            logger.info(f"🔍 AI CALLED search_conversation_history")
                            logger.info(f"🔍 Function args: {function_args}")
                            logger.info(f"👤 Agent ID: {agent_id}")
                            
                            if not agent_id:
                                logger.error(f"❌ Agent ID not found in contact: {contact}")
                                result = {"success": False, "error": "Agent ID not found"}
                            else:
                                query = function_args.get('query')
                                limit = context_limits.clamp_search_limit(
                                    function_args.get('limit', 5),
                                    'past_conversations'
                                )
                                
                                logger.info(f"🔍 CONVERSATION HISTORY SEARCH PARAMETERS: query='{query}', limit={limit}")
                                logger.info(f"🔍 About to call database_service.search_conversation_history...")
                                
                                # Search conversation history using the new separate function
                                conversations = await database_service.search_conversation_history(agent_id, query, limit, user_token)
                                
                                logger.info(f"🔍 CONVERSATION HISTORY SEARCH COMPLETED: {len(conversations) if conversations else 0} results returned")
                                
                                if conversations:
                                    logger.info(f"🔍 Conversation history results:")
                                    for i, conv in enumerate(conversations[:3]):
                                        logger.info(f"🔍   {i+1}. Score: {conv.get('relevance_score', 0):.2f}, Type: {conv.get('conversation_type', 'unknown')}, Title: {conv.get('title', 'No title')}")
                                
                                if conversations:
                                    # Format results for AI consumption
                                    formatted_results = []
                                    for conv in conversations:
                                        formatted_results.append({
                                            "date": conv.get("date"),
                                            "summary": conv.get("summary", ""),
                                            "relevant_excerpt": conv.get("excerpt", ""),
                                            "message_count": conv.get("message_count", 0),
                                            "conversation_type": conv.get("conversation_type", "chat"),
                                            "title": conv.get("title", "Untitled Conversation"),
                                            "relevance_score": conv.get("relevance_score", 0),
                                            "search_type": "conversation_history"
                                        })
                                    
                                    result = {
                                        "success": True,
                                        "query": query,
                                        "results_count": len(formatted_results),
                                        "conversations": formatted_results,
                                        "message": f"Found {len(formatted_results)} relevant conversation{'s' if len(formatted_results) != 1 else ''} in chat history.",
                                        "search_type": "conversation_history"
                                    }
                                    
                                    logger.info(f"🔍 CONVERSATION HISTORY RESULT SUCCESS: {len(formatted_results)} results formatted for AI")
                                else:
                                    result = {
                                        "success": True,
                                        "query": query,
                                        "results_count": 0,
                                        "message": "No relevant conversations found in chat history for this query.",
                                        "search_type": "conversation_history"
                                    }
                                    logger.info(f"🔍 CONVERSATION HISTORY RESULT EMPTY: No conversations found for query '{query}'")
                        elif function_name == "expand_document_context":
                            # Get agent_id from contact
                            agent_id = contact.get('id')
                            logger.info(f"📈 AI CALLED expand_document_context")
                            logger.info(f"🔍 Function args: {function_args}")
                            logger.info(f"👤 Agent ID: {agent_id}")
                            
                            if not agent_id:
                                logger.error(f"❌ Agent ID not found in contact: {contact}")
                                result = {"success": False, "error": "Agent ID not found"}
                            else:
                                # Import here to avoid circular imports
                                from .document_context_expansion_service import document_context_expansion_service
                                
                                document_names = function_args.get('document_names', [])
                                target_layer = int(function_args.get('target_layer', "2"))
                                reason = function_args.get('reason', 'AI requested expansion')
                                
                                logger.info(f"📈 EXPANSION REQUEST: documents={document_names}, layer={target_layer}, reason='{reason}'")
                                
                                # Use the user token passed from the API endpoint
                                logger.info(f"📈 Using user token: {'✅ Available' if user_token else '❌ None'}")
                                
                                # Execute context expansion
                                result = await document_context_expansion_service.expand_document_context(
                                    agent_id=agent_id,
                                    document_names=document_names,
                                    target_layer=target_layer,
                                    user_token=user_token
                                )
                                
                                logger.info(f"📈 EXPANSION RESULT: success={result.get('success')}, docs_matched={result.get('metadata', {}).get('matched_documents', 0)}")
                                if result.get('success'):
                                    context_length = result.get('metadata', {}).get('context_length', 0)
                                    logger.info(f"📈 EXPANSION SUCCESS: {context_length} chars of additional context loaded")
                        else:
                            result = {"success": False, "error": f"Unknown function: {function_name}"}
                        
                        function_responses.append({
                            "name": function_name,
                            "response": result
                        })
                        
                        if function_name == "search_past_conversations":
                            logger.info(f"🔍 AI FUNCTION RESPONSE ADDED: {function_name} -> success={result.get('success')}, count={result.get('results_count', 0)}")
                        
                    except Exception as e:
                        logger.error(f"❌ Function {function_name} failed: {e}")
                        function_responses.append({
                            "name": function_name,
                            "response": {"success": False, "error": str(e)}
                        })
                
                # Add function responses to conversation
                conversation_contents.append({
                    "role": "function",
                    "parts": [{"functionResponse": {
                        "name": fr["name"],
                        "response": fr["response"]
                    }} for fr in function_responses]
                })
                
                # Make follow-up request to get final response
                follow_up_payload = original_payload.copy()
                follow_up_payload["contents"] = conversation_contents
                
                follow_up_response = await self._call_gemini_api('models/gemini-2.5-flash:generateContent', follow_up_payload)
                
                # Extract final response
                follow_up_candidates = follow_up_response.get('candidates', [])
                if follow_up_candidates:
                    follow_up_content = follow_up_candidates[0].get('content', {})
                    follow_up_parts = follow_up_content.get('parts', [])
                    
                    final_text = ""
                    for part in follow_up_parts:
                        if 'text' in part:
                            final_text += part['text']
                    
                    if final_text:
                        logger.info(f"✅ Generated response with function calls ({len(final_text)} characters)")
                        return final_text
                
                # Fallback if follow-up fails
                return "I executed the requested function but couldn't generate a proper response. Please try again."
            
            else:
                # No function calls, return text response
                if text_response:
                    logger.info(f"✅ Generated response ({len(text_response)} characters)")
                    return text_response
                else:
                    raise ValueError('Empty response from Gemini API')
        
        except Exception as e:
            logger.error(f"❌ Error handling function calling response: {e}")
            raise
    
    # Removed compacting functionality - frontend now handles truncation
    
    async def close(self):
        """Close HTTP client connections."""
        await self.client.aclose()

# Create singleton instance
ai_service = AIService()