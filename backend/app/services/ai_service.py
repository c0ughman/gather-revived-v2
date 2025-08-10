import asyncio
import logging
import httpx
import json
from typing import Dict, Any, List, Optional
from ..core.config import settings
from .integrations_service import integrations_service

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
            timeout=httpx.Timeout(60.0),  # 60 second timeout for AI requests
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
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
            
            # Build context from contact info and documents
            context = self._build_contact_context(contact, conversation_documents or [])
            
            # Build conversation history for function calling API
            conversation_contents = self._build_conversation_contents(chat_history, user_message, contact.get('name', 'AI'))
            
            logger.debug(f"📝 Sending conversation to Gemini API with function calling support")
            
            # Prepare request payload with function calling
            payload = {
                "contents": conversation_contents,
                "tools": [
                    {
                        "function_declarations": self.function_declarations
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "topK": 40,
                    "topP": 0.95,
                    "maxOutputTokens": 2048,
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
                ],
                "systemInstruction": {
                    "parts": [
                        {
                            "text": context + "\n\nIMPORTANT: You have access to web search and website scraping functions. Use them when users ask about current information, websites, or content from the internet. Available functions:\n\n- search_web: Search for current information using Tavily\n- scrape_website: Extract content from websites using Firecrawl\n\nUse these functions proactively when needed."
                        }
                    ]
                }
            }
            
            # Make initial API request
            response = await self._call_gemini_api('models/gemini-1.5-flash:generateContent', payload)
            
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
{document_content[:4000]}  # Limit content to avoid token limits

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
                "generationConfig": {
                    "temperature": 0.3,  # Lower temperature for more factual summaries
                    "topK": 40,
                    "topP": 0.95,
                    "maxOutputTokens": 1024,
                }
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
    
    def _build_contact_context(self, contact: Dict[str, Any], documents: List[Dict[str, Any]]) -> str:
        """
        Build context string from contact information and documents.
        """
        context = f"You are {contact.get('name', 'AI Assistant')}. {contact.get('description', 'You are a helpful AI assistant.')}"
        
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
                    context += f"📖 CONTENT:\n{doc_content[:2000]}...\n\n"  # Limit content length
            
            context += "This is your knowledge base. Reference this information throughout conversations to provide accurate responses."
        
        return context
    
    def _build_conversation_history(self, chat_history: List[Dict[str, Any]], contact_name: str) -> str:
        """
        Build conversation history string from chat messages.
        """
        if not chat_history:
            return ""
        
        # Take last 10 messages to avoid token limits
        recent_history = chat_history[-10:]
        
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
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 10,
                }
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
            }
        ]
    
    def _build_conversation_contents(self, chat_history: List[Dict[str, Any]], user_message: str, contact_name: str) -> List[Dict[str, Any]]:
        """Build conversation contents for Gemini API function calling format"""
        contents = []
        
        # Add recent chat history
        recent_history = chat_history[-10:] if chat_history else []
        
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