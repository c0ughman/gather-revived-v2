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
        conversation_documents: List[Dict[str, Any]] = None
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
            
            # Apply conversation compacting if needed
            logger.info(f"🔍 Checking if conversation needs compacting...")
            compacted_chat_history = await self._apply_conversation_compacting(chat_history, contact.get('name', 'AI'))
            
            # Build conversation history for function calling API
            conversation_contents = self._build_conversation_contents(compacted_chat_history, user_message, contact.get('name', 'AI'))
            
            logger.info(f"📝 Sending conversation to Gemini API with {len(self.function_declarations)} function declarations")
            logger.info(f"🔧 Available functions: {[f['name'] for f in self.function_declarations]}")
            
            # Build full system instruction
            full_system_instruction = context + "\n\nIMPORTANT: You have access to helpful functions. Use them when appropriate:\n\n- search_web: Search for current information using Tavily\n- scrape_website: Extract content from websites using Firecrawl\n- search_past_conversations: Search through past CHAT CONVERSATIONS with this user\n\nCRITICAL SEARCH INSTRUCTIONS:\nYour memory context above contains general notes and knowledge. However, when users ask about specific past conversations, you MUST use the search_past_conversations function to find actual chat history.\n\nUse search_past_conversations when users mention:\n- \"What did we talk about\" / \"What did we discuss\"\n- \"Remember when\" / \"Do you remember\"\n- \"Last time\" / \"Previously\" / \"Earlier\"\n- \"You said\" / \"I told you\" / \"We talked about\"\n- References to past topics, recommendations, or conversations\n- Follow-up questions about previous discussions\n\nEXAMPLES REQUIRING SEARCH:\n- \"What movie did you recommend last time?\"\n- \"Remember when we discussed TypeScript?\"\n- \"What was that book we talked about?\"\n- \"You mentioned something about React earlier\"\n- \"What did I tell you about my project?\"\n\nDo NOT mention that you're searching - just use the results naturally. If no results are found, say you don't recall that specific conversation but offer to help with the topic anyway."
            
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
            ai_response = await self._handle_function_calling_response(response, conversation_contents, payload, contact)
            
            # Calculate final token analysis after compacting AND including the current AI response
            from ..core.token_utils import TokenCounter
            
            # Count tokens in the generated AI response
            ai_response_tokens = TokenCounter.count_tokens(ai_response)
            logger.info(f"🤖 Generated response: {ai_response_tokens} tokens")
            
            # Create temporary chat history that includes the upcoming AI response
            # This gives us the TRUE final state after this message is sent
            upcoming_chat_history = compacted_chat_history + [
                {
                    'sender': contact.get('name', 'AI'),
                    'content': ai_response,
                    'timestamp': None  # Will be set by frontend
                }
            ]
            
            # Calculate token analysis including the upcoming AI response
            final_analysis = TokenCounter.get_conversation_token_analysis(
                upcoming_chat_history,
                context_limits.CHAT_HISTORY_MAX_TOKENS,
                context_limits.CHAT_COMPACTING_THRESHOLD
            )
            
            # Log final context status including the current AI response
            logger.info(f"📊 Final context (including current AI response): {final_analysis['message_count']} messages, {final_analysis['total_tokens']} tokens ({final_analysis['usage_percentage']:.1f}% of {final_analysis['max_tokens']} max)")
            
            was_compacted = len(compacted_chat_history) != len(chat_history)
            
            # Return response with token analysis and compacted history
            return {
                'response': ai_response,
                'token_analysis': final_analysis,
                'was_compacted': was_compacted,
                'original_message_count': len(chat_history),
                'compacted_message_count': len(compacted_chat_history),
                'compacted_chat_history': compacted_chat_history
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
            context += "You have access to the following documents. Use this information to provide accurate and detailed responses:\n\n"
            
            for doc in documents:
                # Format document for AI consumption (simplified version)
                doc_content = doc.get('extracted_text') or doc.get('content', '')
                if doc_content:
                    context += f"📄 DOCUMENT: {doc.get('name', 'Unknown')}\n"
                    context += f"📋 Type: {doc.get('type', 'Unknown')}\n"
                    context += f"📖 CONTENT:\n{context_limits.truncate_document_content(doc_content, 'chat')}\n\n"  # Limit content length
            
            context += "This is your knowledge base. Reference this information throughout conversations to provide accurate responses."
        
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
                "description": "Search through past conversations with this user to find relevant information, context, or details. Use this tool when the user asks about previous discussions, mentions something from earlier conversations, asks follow-up questions about past topics, or when you think past context would help provide a better answer. This is especially useful for questions like 'What did we discuss about X?', 'Remember when...', or when the user references previous conversations.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search terms to find in past conversations. Use keywords related to the topic the user is asking about."
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of conversations to return (1-10)",
                            "default": 3,
                            "minimum": 1,
                            "maximum": 10
                        }
                    },
                    "required": ["query"]
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
    
    async def _handle_function_calling_response(self, response: Dict[str, Any], conversation_contents: List[Dict[str, Any]], original_payload: Dict[str, Any], contact: Dict[str, Any]) -> str:
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
                            logger.info(f"🔍 Search past conversations: agent_id={agent_id}, args={function_args}")
                            if not agent_id:
                                result = {"success": False, "error": "Agent ID not found"}
                            else:
                                query = function_args.get('query')
                                limit = context_limits.clamp_search_limit(
                                    function_args.get('limit', context_limits.SEARCH_PAST_CONVERSATIONS_DEFAULT_LIMIT),
                                    'past_conversations'
                                )
                                
                                logger.info(f"🔍 Searching conversations for query: '{query}', limit: {limit}")
                                
                                # Search past conversations
                                conversations = await database_service.search_past_conversations(agent_id, query, limit)
                                
                                logger.info(f"🔍 Search results: {len(conversations) if conversations else 0} conversations found")
                                
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
                                    logger.info(f"🔍 Formatted {len(formatted_results)} conversation results for AI")
                                else:
                                    result = {
                                        "success": True,
                                        "query": query,
                                        "results_count": 0,
                                        "message": "No relevant past conversations found for this query."
                                    }
                                    logger.info(f"🔍 No conversations found for query: '{query}'")
                        else:
                            result = {"success": False, "error": f"Unknown function: {function_name}"}
                        
                        function_responses.append({
                            "name": function_name,
                            "response": result
                        })
                        
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
    
    async def summarize_conversation(
        self,
        messages: List[Dict[str, Any]],
        existing_summary: str = None,  # Kept for compatibility but unused
        max_tokens: int = 250
    ) -> str:
        """
        Summarize a conversation using fixed token budget approach.
        
        Args:
            messages: List of messages to summarize (including any existing summaries)
            existing_summary: Kept for compatibility but unused
            max_tokens: Maximum tokens for the summary
            
        Returns:
            Conversation summary within token limit
        """
        try:
            if not messages:
                return "No conversation to summarize."
            
            logger.info(f"🔄 Summarizing {len(messages)} messages (max {max_tokens} tokens)")
            
            # Build conversation text
            conversation_text = ""
            for msg in messages:
                sender = msg.get('sender', 'Unknown')
                content = msg.get('content', '')
                conversation_text += f"{sender}: {content}\n"
            
            # Build simplified summarization prompt
            prompt = f"""Please create a concise summary of this conversation content that captures:
1. Key facts and information discussed
2. Important decisions or conclusions reached
3. Main topics covered
4. User preferences or context mentioned

Keep the summary to approximately {max_tokens} tokens or less.
Focus on information that would help maintain conversation continuity.

Conversation content to summarize:
{conversation_text}

Summary:"""
            
            # Generate summary using Gemini
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,  # Lower temperature for factual summaries
                    "topK": 40,
                    "topP": 0.95,
                    "maxOutputTokens": max_tokens
                },
                "safetySettings": [
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
                ]
            }
            
            response = await self._call_gemini_api('models/gemini-2.5-flash:generateContent', payload)
            
            if not response or 'candidates' not in response:
                raise ValueError("No summary generated by AI")
            
            candidates = response.get('candidates', [])
            if not candidates:
                raise ValueError("No summary candidates returned")
            
            candidate = candidates[0]
            if 'content' not in candidate or 'parts' not in candidate['content']:
                raise ValueError("Invalid summary response format")
            
            parts = candidate['content']['parts']
            if not parts or 'text' not in parts[0]:
                raise ValueError("No summary text in response")
            
            summary = parts[0]['text'].strip()
            
            # Validate summary token count
            from ..core.token_utils import TokenCounter
            summary_tokens = TokenCounter.count_tokens(summary)
            
            # Show first 100 characters of summary for context
            summary_preview = summary[:100] + "..." if len(summary) > 100 else summary
            logger.info(f"✅ Generated summary: {summary_tokens} tokens")
            logger.info(f"📝 Summary preview: {summary_preview}")
            
            # Truncate if still too long
            if summary_tokens > max_tokens:
                summary = TokenCounter.truncate_to_token_limit(summary, max_tokens)
                logger.info(f"📏 Truncated summary to fit {max_tokens} token limit")
            
            return summary
            
        except Exception as e:
            logger.error(f"❌ Error summarizing conversation: {e}")
            logger.error(f"❌ Summary request details: {len(messages)} messages, max_tokens={max_tokens}")
            if hasattr(e, '__traceback__'):
                import traceback
                logger.error(f"❌ Full error traceback: {traceback.format_exc()}")
            # Return a basic fallback summary
            fallback_summary = f"Conversation with {len(messages)} messages"
            logger.warning(f"🔄 Using fallback summary: '{fallback_summary}'")
            return fallback_summary
    
    async def _apply_conversation_compacting(
        self, 
        chat_history: List[Dict[str, Any]], 
        contact_name: str = "AI"
    ) -> List[Dict[str, Any]]:
        """
        Apply conversation compacting if token threshold is exceeded.
        
        Args:
            chat_history: Original chat history
            contact_name: Name of the contact for logging
            
        Returns:
            Compacted chat history with summary if needed
        """
        try:
            from ..core.token_utils import TokenCounter
            
            logger.info("🔍 COMPACTING ANALYSIS STARTED")
            
            if not chat_history:
                logger.info("💬 No chat history to compact")
                return chat_history
            
            
            # Analyze conversation tokens
            analysis = TokenCounter.get_conversation_token_analysis(
                chat_history,
                context_limits.CHAT_HISTORY_MAX_TOKENS,
                context_limits.CHAT_COMPACTING_THRESHOLD
            )
            
            # Log clear token analysis for frontend console with breakdown
            logger.info(f"💬 Conversation: {analysis['message_count']} messages, {analysis['total_tokens']} tokens ({analysis['usage_percentage']:.1f}% of {analysis['max_tokens']} max)")
            logger.info(f"🚨 Compacting threshold: {context_limits.CHAT_COMPACTING_THRESHOLD*100:.0f}% ({analysis['threshold_tokens']} tokens)")
            logger.info(f"⚠️ Compacting needed: {'YES' if analysis['needs_compacting'] else 'NO'}")
            
            # Add token breakdown: summary vs chat messages (always show this)
            summary_tokens = 0
            chat_tokens = 0
            
            for msg in chat_history:
                msg_tokens = TokenCounter.count_tokens(msg.get('content', ''))
                if msg.get('sender') == 'summary' and msg.get('content', '').startswith('[SUMMARY]'):
                    summary_tokens += msg_tokens
                else:
                    chat_tokens += msg_tokens
            
            total_breakdown_tokens = summary_tokens + chat_tokens
            if total_breakdown_tokens > 0:
                summary_percentage = (summary_tokens / total_breakdown_tokens) * 100
                chat_percentage = (chat_tokens / total_breakdown_tokens) * 100
                logger.info(f"📊 Token breakdown: {summary_tokens} summary tokens ({summary_percentage:.1f}%) + {chat_tokens} chat tokens ({chat_percentage:.1f}%)")
            else:
                logger.info(f"📊 Token breakdown: 0 summary tokens + {chat_tokens} chat tokens (100.0%)")
            
            if not analysis['needs_compacting']:
                logger.info(f"✅ No compacting needed - under threshold ({analysis['usage_percentage']:.1f}% < {context_limits.CHAT_COMPACTING_THRESHOLD*100:.0f}%)")
                return chat_history
            
            # Select messages for compacting
            compacting_selection = TokenCounter.select_messages_for_compacting(
                chat_history,
                context_limits.CHAT_MESSAGES_TO_KEEP_RECENT,
                None  # No existing summary handling
            )
            
            if not compacting_selection['can_compact']:
                logger.info(f"✅ Cannot compact - only {len(chat_history)} messages (keeping {context_limits.CHAT_MESSAGES_TO_KEEP_RECENT} recent)")
                return chat_history
            
            logger.info("🔄 COMPACTING STARTED")
            logger.info(f"📦 Compacting {compacting_selection['compacting_count']} old messages, keeping {compacting_selection['keeping_count']} recent")
            
            # Use all messages to compact (including any existing summaries)
            messages_to_compact = compacting_selection['messages_to_compact']
            
            if not messages_to_compact:
                logger.info("✅ No messages to compact")
                return chat_history
            
            logger.info(f"📝 Compacting {len(messages_to_compact)} messages...")
            
            # Generate new summary with fixed token budget
            new_summary = await self.summarize_conversation(
                messages_to_compact,
                None,  # No existing summary - everything gets summarized together
                context_limits.CHAT_SUMMARY_MAX_TOKENS
            )
            
            # Build compacted chat history
            compacted_history = []
            
            # Add the new summary as a special message
            summary_message = {
                'sender': 'summary',
                'content': f'[SUMMARY] {new_summary}',
                'timestamp': chat_history[0].get('timestamp') if chat_history else None
            }
            compacted_history.append(summary_message)
            
            # Add recent messages to keep
            compacted_history.extend(compacting_selection['messages_to_keep'])
            
            # Final token analysis
            final_analysis = TokenCounter.get_conversation_token_analysis(
                compacted_history,
                context_limits.CHAT_HISTORY_MAX_TOKENS,
                context_limits.CHAT_COMPACTING_THRESHOLD
            )
            
            logger.info("✅ COMPACTING COMPLETED")
            logger.info(f"📉 Before: {analysis['message_count']} messages, {analysis['total_tokens']} tokens ({analysis['usage_percentage']:.1f}%)")
            logger.info(f"📈 After: {final_analysis['message_count']} messages, {final_analysis['total_tokens']} tokens ({final_analysis['usage_percentage']:.1f}%)")
            logger.info(f"💾 New summary: {TokenCounter.count_tokens(new_summary)} tokens")
            logger.info(f"🔒 Kept {len(compacting_selection['messages_to_keep'])} recent messages")
            
            # Add token breakdown for final compacted result
            summary_tokens_final = TokenCounter.count_tokens(new_summary)
            recent_tokens_final = 0
            for msg in compacting_selection['messages_to_keep']:
                recent_tokens_final += TokenCounter.count_tokens(msg.get('content', ''))
            
            total_final_tokens = summary_tokens_final + recent_tokens_final
            if total_final_tokens > 0:
                summary_percentage_final = (summary_tokens_final / total_final_tokens) * 100
                recent_percentage_final = (recent_tokens_final / total_final_tokens) * 100
                logger.info(f"📊 Final breakdown: {summary_tokens_final} summary tokens ({summary_percentage_final:.1f}%) + {recent_tokens_final} recent chat tokens ({recent_percentage_final:.1f}%)")
            
            return compacted_history
            
        except Exception as e:
            logger.error(f"❌ Error in conversation compacting: {e}")
            # Return original history if compacting fails
            logger.info("🔄 Falling back to original chat history due to compacting error")
            return chat_history
    
    async def close(self):
        """Close HTTP client connections."""
        await self.client.aclose()

# Create singleton instance
ai_service = AIService()