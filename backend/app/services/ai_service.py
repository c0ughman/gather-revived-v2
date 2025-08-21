import asyncio
import logging
import httpx
import json
from typing import Dict, Any, List, Optional
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
    
    async def generate_response(
        self,
        contact: Dict[str, Any],
        user_message: str,
        chat_history: List[Dict[str, Any]],
        conversation_documents: List[Dict[str, Any]] = None
    ) -> str:
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
            
            # Build conversation history for function calling API
            conversation_contents = self._build_conversation_contents(chat_history, user_message, contact.get('name', 'AI'))
            
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
            
            # Make initial API request
            response = await self._call_gemini_api('models/gemini-1.5-flash:generateContent', payload)
            
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
            return await self._handle_function_calling_response(response, conversation_contents, payload, contact)
            
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
            
            response = await self._call_gemini_api('models/gemini-1.5-flash:generateContent', payload)
            
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
        # Truncate agent description to fit token limits (silent truncation)
        description = contact.get('description', 'You are a helpful AI assistant.')
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
    
    def _build_conversation_history(self, chat_history: List[Dict[str, Any]], contact_name: str) -> str:
        """
        Build conversation history string from chat messages.
        """
        if not chat_history:
            return ""
        
        # Take recent messages to avoid token limits (using token-based filtering)
        recent_history = context_limits.get_recent_messages(chat_history)
        
        formatted_history = []
        for message in recent_history:
            sender = message.get('sender', 'unknown')
            content = message.get('content', '')
            
            if sender == 'user':
                formatted_history.append(f"User: {content}")
            else:
                formatted_history.append(f"{contact_name}: {content}")
        
        return '\n'.join(formatted_history)
    
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
            
            response = await self._call_gemini_api('models/gemini-1.5-flash:generateContent', test_payload)
            
            candidates = response.get('candidates', [])
            if candidates:
                return {
                    "status": "healthy",
                    "api_connection": "successful",
                    "model": "gemini-1.5-flash"
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
        
        # Add recent chat history (using token-based filtering)
        recent_history = context_limits.get_recent_messages(chat_history or [])
        
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
                
                follow_up_response = await self._call_gemini_api('models/gemini-1.5-flash:generateContent', follow_up_payload)
                
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
    
    async def close(self):
        """Close HTTP client connections."""
        await self.client.aclose()

# Create singleton instance
ai_service = AIService()