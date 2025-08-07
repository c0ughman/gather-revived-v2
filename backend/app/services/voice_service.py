"""
Voice Service for Gemini Live API Integration

This service handles the backend components of voice calls as recommended by the Live API docs:
- Authentication and ephemeral tokens
- Tool use and function calling (paper tool, integrations)
- Session management and context
- Audio pre-processing (if needed)

Frontend handles:
- Real-time audio streaming
- Audio playback
- Voice Activity Detection
- UI updates
- Direct WebSocket connection to Live API
"""

import asyncio
import json
import logging
import time
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
import uuid

from .integrations_service import integrations_service

logger = logging.getLogger(__name__)

class VoiceService:
    def __init__(self):
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.function_handlers: Dict[str, Callable] = {}
        self.session_contexts: Dict[str, List[Dict[str, Any]]] = {}
        
        # Register built-in function handlers
        self._register_function_handlers()
        
        logger.info("🎤 Voice Service initialized")

    def _register_function_handlers(self):
        """Register all available function handlers"""
        self.function_handlers = {
            "generate_document": self._handle_document_generation,
            "make_api_request": self._handle_api_request,
            "check_domain_availability": self._handle_domain_check,
            "trigger_webhook": self._handle_webhook_trigger,
            "manage_google_sheets": self._handle_google_sheets,
            "manage_notion": self._handle_notion,
            "search_web": self._handle_web_search,
            "scrape_website": self._handle_website_scraping,
        }
        logger.info(f"📋 Registered {len(self.function_handlers)} function handlers")

    async def create_session(self, user_id: str, contact: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new voice session with ephemeral authentication
        
        Returns session info including ephemeral token for secure frontend connection
        """
        try:
            session_id = f"voice_session_{int(time.time())}_{uuid.uuid4().hex[:8]}"
            
            # Generate ephemeral token (valid for session duration)
            ephemeral_token = self._generate_ephemeral_token(session_id, user_id)
            
            # Initialize session context
            session_context = {
                "session_id": session_id,
                "user_id": user_id,
                "contact": contact,
                "created_at": datetime.utcnow().isoformat(),
                "ephemeral_token": ephemeral_token,
                "function_declarations": self._get_function_declarations(contact),
                "system_prompt": self._build_system_prompt(contact),
                "status": "initialized"
            }
            
            self.active_sessions[session_id] = session_context
            self.session_contexts[session_id] = []
            
            logger.info(f"🎤 Created voice session {session_id} for user {user_id}")
            
            return {
                "session_id": session_id,
                "ephemeral_token": ephemeral_token,
                "function_declarations": session_context["function_declarations"],
                "system_prompt": session_context["system_prompt"],
                "expires_in": 3600  # 1 hour
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to create voice session: {e}")
            raise

    def _generate_ephemeral_token(self, session_id: str, user_id: str) -> str:
        """
        Generate ephemeral token for secure frontend authentication
        In production, this would use proper JWT with expiration
        """
        # For now, create a simple token - in production use proper JWT
        token_data = {
            "session_id": session_id,
            "user_id": user_id,
            "created_at": int(time.time()),
            "expires_at": int(time.time()) + 3600  # 1 hour
        }
        
        # In production, sign this with secret key
        import base64
        token = base64.b64encode(json.dumps(token_data).encode()).decode()
        return f"ephemeral_{token}"

    def _get_function_declarations(self, contact: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Get function declarations for this session based on contact configuration
        """
        function_declarations = []
        
        # Check contact integrations to determine which functions to include
        integrations = contact.get("integrations", [])
        
        # Always include document generation (paper tool)
        function_declarations.append({
            "name": "generate_document",
            "description": "Generate a written document, essay, report, or any written content when the user asks for it. Use this function when user asks to: write something down, put something on paper, write an essay, create a document, make a report, draft something, write X words about, give me X words on, create written content, or produce any type of written material.",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "The complete content to write in the document, formatted in markdown with proper headings, paragraphs, and structure"
                    },
                    "wordCount": {
                        "type": "number",
                        "description": "Target word count if specified by the user (optional)"
                    }
                },
                "required": ["content"]
            }
        })

        # Check for API Request Tool integration
        if any(i.get("integrationId") == "api-request-tool" and i.get("config", {}).get("enabled") for i in integrations):
            function_declarations.append({
                "name": "make_api_request",
                "description": "Make an HTTP API request to fetch data from external services",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to make the request to"
                        },
                        "method": {
                            "type": "string",
                            "description": "HTTP method (GET, POST, PUT, DELETE)",
                            "enum": ["GET", "POST", "PUT", "DELETE"]
                        },
                        "headers": {
                            "type": "object",
                            "description": "HTTP headers as key-value pairs"
                        },
                        "body": {
                            "type": "string",
                            "description": "Request body for POST/PUT requests"
                        }
                    },
                    "required": ["url"]
                }
            })

        # Check for Domain Checker Tool integration
        if any(i.get("integrationId") == "domain-checker-tool" and i.get("config", {}).get("enabled") for i in integrations):
            function_declarations.append({
                "name": "check_domain_availability",
                "description": "Check domain availability using RDAP with customizable variations",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "domain": {
                            "type": "string",
                            "description": "Base domain name to check (without TLD)"
                        },
                        "variations": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "description": "Optional domain variations to check. Use {domain} as placeholder. If not provided, uses default variations."
                        }
                    },
                    "required": ["domain"]
                }
            })

        # Check for Webhook Trigger integration  
        if any(i.get("integrationId") == "webhook-trigger" and i.get("config", {}).get("enabled") for i in integrations):
            function_declarations.append({
                "name": "trigger_webhook",
                "description": "Trigger a webhook based on natural language commands. Use when user asks to activate, trigger, start, launch, or execute something.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "description": "The action the user wants to perform (e.g., 'activate marketing', 'trigger workflow', 'send notification')"
                        }
                    },
                    "required": ["action"]
                }
            })

        # Check for Google Sheets integration (disabled due to OAuth issues)
        if any(i.get("integrationId") == "google-sheets" and i.get("config", {}).get("enabled") for i in integrations):
            function_declarations.append({
                "name": "manage_google_sheets",
                "description": "Google Sheets integration has been disabled due to OAuth configuration issues",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "description": "This integration has been disabled"
                        }
                    },
                    "required": ["operation"]
                }
            })

        # Check for Notion integration (disabled due to OAuth issues)
        if any(i.get("integrationId") in ["notion-oauth-source", "notion-oauth-action"] and i.get("config", {}).get("enabled") for i in integrations):
            function_declarations.append({
                "name": "manage_notion", 
                "description": "Notion integration has been disabled due to OAuth configuration issues",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "description": "This integration has been disabled"
                        }
                    },
                    "required": ["operation"]
                }
            })

        # Always add web search function since Tavily API is configured via environment variable
        function_declarations.append({
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
                        "type": "number",
                        "description": "Maximum number of search results to return (1-20)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        })

        # Always add Firecrawl scraping function since it's configured via environment variable
        function_declarations.append({
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
                        "enum": ["text", "markdown", "html", "screenshot"]
                    },
                    "includeImages": {
                        "type": "boolean",
                        "description": "Whether to include images",
                        "default": False
                    },
                    "maxPages": {
                        "type": "number",
                        "description": "Maximum number of pages to scrape",
                        "default": 5
                    }
                },
                "required": ["url"]
            }
        })
        
        logger.info(f"📋 Generated {len(function_declarations)} function declarations")
        return function_declarations

    def _build_system_prompt(self, contact: Dict[str, Any]) -> str:
        """
        Build system prompt for the voice session
        """
        system_prompt = f"""You are {contact.get('name', 'Assistant')}, {contact.get('description', 'a helpful AI assistant')}.

🎤 VOICE MODE INSTRUCTIONS:
- Speak naturally and conversationally
- Keep responses concise but helpful
- Use a warm, friendly tone
- Never mention technical terms like "function", "tool", "API", etc.
- When performing actions (like writing documents), do so seamlessly without explaining the technical process

DOCUMENT GENERATION INSTRUCTIONS:
- Use the generate_document function when users ask you to write something down, put something on paper, create written content, or produce documents
- Trigger phrases include: "write that down", "put that on paper", "write me this", "write an essay", "write X words on", "give me X words on", "create a document", "make me a report", etc.
- Generate well-formatted markdown content with proper headings, paragraphs, lists, and structure
- If the user specifies a word count (e.g., "write 100 words on..."), aim to meet that target
- The document will be displayed in a clean interface for the user to read and scroll through
- Do not mention document titles, URLs, or file locations - just generate and display the content
- IMPORTANT: Do not mention that you are using a tool or function to generate the document. Simply respond naturally and let the document appear automatically
- If document generation fails, explain the issue to the user and suggest they try again

CRITICAL VOICE MODE INSTRUCTIONS:
- NEVER read out technical details, data structures, or code-like content
- NEVER say words like "tool", "function", "response", "data", "content", "underscore", "curly bracket", etc.
- When you receive information from tools, speak it naturally as if you knew it yourself
- Keep responses under 100 words unless specifically asked for longer content
- Use natural speech patterns and contractions
- If you need to pause, use natural speech fillers like "let me think..." rather than silence"""

        return system_prompt

    async def handle_function_call(self, session_id: str, function_name: str, function_args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle function calls from the voice session
        """
        try:
            if session_id not in self.active_sessions:
                raise ValueError(f"Session {session_id} not found")
            
            if function_name not in self.function_handlers:
                raise ValueError(f"Function {function_name} not supported")
            
            logger.info(f"🔧 Handling function call: {function_name} for session {session_id}")
            
            # Get session context
            session = self.active_sessions[session_id]
            
            # Call the function handler
            result = await self.function_handlers[function_name](session, function_args)
            
            # Add to session context
            self.session_contexts[session_id].append({
                "type": "function_call",
                "function": function_name,
                "args": function_args,
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            logger.info(f"✅ Function call {function_name} completed successfully")
            
            return {
                "success": True,
                "function": function_name,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"❌ Function call {function_name} failed: {e}")
            return {
                "success": False,
                "function": function_name,
                "error": str(e)
            }

    async def _handle_document_generation(self, session: Dict[str, Any], args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle document generation (paper tool)
        """
        try:
            content = args.get("content", "")
            word_count = args.get("wordCount")
            
            if not content:
                raise ValueError("Document content is required")
            
            # Create document info
            document_id = f"voice_doc_{int(time.time())}_{uuid.uuid4().hex[:8]}"
            document_info = {
                "id": document_id,
                "name": f"Voice Generated Document {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                "type": "text/markdown",
                "content": content,
                "extracted_text": content,
                "size": len(content.encode('utf-8')),
                "uploaded_at": datetime.utcnow().isoformat(),
                "summary": f"Voice-generated document{f' ({word_count} words)' if word_count else ''}",
                "metadata": {
                    "source": "voice_call",
                    "session_id": session["session_id"],
                    "contact_name": session["contact"].get("name", "Unknown"),
                    "word_count": word_count,
                    "generated_at": datetime.utcnow().isoformat()
                }
            }
            
            logger.info(f"📄 Generated document {document_id} ({len(content)} characters)")
            
            return {
                "document": document_info,
                "message": "Document generated successfully"
            }
            
        except Exception as e:
            logger.error(f"❌ Document generation failed: {e}")
            raise

    async def _handle_api_request(self, session: Dict[str, Any], args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle API request function calls"""
        try:
            url = args.get("url")
            method = args.get("method", "GET")
            headers = args.get("headers", {})
            body = args.get("body")
            
            if not url:
                raise ValueError("URL is required for API request")
            
            logger.info(f"🌐 Processing API request: {method} {url}")
            result = await integrations_service.execute_api_request(url, method, headers, body)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ API request failed: {e}")
            raise

    async def _handle_domain_check(self, session: Dict[str, Any], args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle domain availability checking"""
        try:
            domain = args.get("domain")
            variations = args.get("variations")
            
            if not domain:
                raise ValueError("Domain is required for domain check")
            
            logger.info(f"🔍 Processing domain check: {domain}")
            result = await integrations_service.check_domain_availability(domain, variations)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Domain check failed: {e}")
            raise

    async def _handle_webhook_trigger(self, session: Dict[str, Any], args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle webhook trigger function calls"""
        try:
            action = args.get("action")
            
            if not action:
                raise ValueError("Action is required for webhook trigger")
            
            # For webhook triggers, we'd need the webhook URL from the contact's integration config
            # For now, return a mock response
            logger.info(f"🪝 Processing webhook trigger: {action}")
            
            return {
                "success": True,
                "action": action,
                "message": "Webhook functionality needs integration configuration",
                "note": "Contact-specific webhook URLs need to be configured"
            }
            
        except Exception as e:
            logger.error(f"❌ Webhook trigger failed: {e}")
            raise

    async def _handle_google_sheets(self, session: Dict[str, Any], args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle Google Sheets operations"""
        try:
            operation = args.get("operation")
            
            if not operation:
                raise ValueError("Operation is required for Google Sheets")
            
            logger.info(f"📊 Processing Google Sheets operation: {operation}")
            
            # OAuth was incorrectly configured, so return disabled message
            return {
                "success": False,
                "error": "Google Sheets integration has been disabled - OAuth was incorrectly configured",
                "operation": operation
            }
            
        except Exception as e:
            logger.error(f"❌ Google Sheets operation failed: {e}")
            raise

    async def _handle_notion(self, session: Dict[str, Any], args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle Notion operations"""
        try:
            operation = args.get("operation")
            
            if not operation:
                raise ValueError("Operation is required for Notion")
            
            logger.info(f"📝 Processing Notion operation: {operation}")
            
            # OAuth was incorrectly configured, so return disabled message  
            return {
                "success": False,
                "error": "Notion integration has been disabled - OAuth was incorrectly configured",
                "operation": operation
            }
            
        except Exception as e:
            logger.error(f"❌ Notion operation failed: {e}")
            raise

    async def _handle_web_search(self, session: Dict[str, Any], args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle web search function calls"""
        try:
            query = args.get("query")
            search_depth = args.get("searchDepth", "basic")
            max_results = args.get("maxResults", 5)
            
            if not query:
                raise ValueError("Query is required for web search")
            
            logger.info(f"🔍 Processing web search: {query}")
            result = await integrations_service.execute_web_search_tool(query, search_depth, max_results, True)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Web search failed: {e}")
            raise

    async def _handle_website_scraping(self, session: Dict[str, Any], args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle website scraping function calls"""
        try:
            url = args.get("url")
            extract_type = args.get("extractType", "text")
            include_images = args.get("includeImages", False)
            max_pages = args.get("maxPages", 5)
            
            if not url:
                raise ValueError("URL is required for website scraping")
            
            logger.info(f"🕷️ Processing website scraping: {url}")
            result = await integrations_service.execute_firecrawl_tool_operation(url, extract_type, include_images, max_pages)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Website scraping failed: {e}")
            raise

    async def get_session_context(self, session_id: str) -> Dict[str, Any]:
        """
        Get current session context and history
        """
        if session_id not in self.active_sessions:
            raise ValueError(f"Session {session_id} not found")
        
        return {
            "session": self.active_sessions[session_id],
            "context": self.session_contexts.get(session_id, [])
        }

    async def end_session(self, session_id: str) -> Dict[str, Any]:
        """
        End a voice session and cleanup resources
        """
        try:
            if session_id in self.active_sessions:
                session = self.active_sessions[session_id]
                session["status"] = "ended"
                session["ended_at"] = datetime.utcnow().isoformat()
                
                # Keep session data for a short time for potential retrieval
                # In production, you might want to store this in a database
                
                logger.info(f"🎤 Ended voice session {session_id}")
                
                return {
                    "success": True,
                    "session_id": session_id,
                    "duration": self._calculate_session_duration(session)
                }
            else:
                logger.warning(f"⚠️ Attempted to end non-existent session {session_id}")
                return {
                    "success": False,
                    "error": "Session not found"
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to end session {session_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def _calculate_session_duration(self, session: Dict[str, Any]) -> int:
        """Calculate session duration in seconds"""
        try:
            start_time = datetime.fromisoformat(session["created_at"])
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            return int(duration)
        except:
            return 0

    async def cleanup_expired_sessions(self):
        """
        Cleanup expired sessions (should be called periodically)
        """
        try:
            now = datetime.utcnow()
            expired_sessions = []
            
            for session_id, session in self.active_sessions.items():
                created_at = datetime.fromisoformat(session["created_at"])
                if now - created_at > timedelta(hours=2):  # 2 hour max session
                    expired_sessions.append(session_id)
            
            for session_id in expired_sessions:
                await self.end_session(session_id)
                del self.active_sessions[session_id]
                if session_id in self.session_contexts:
                    del self.session_contexts[session_id]
            
            if expired_sessions:
                logger.info(f"🧹 Cleaned up {len(expired_sessions)} expired sessions")
                
        except Exception as e:
            logger.error(f"❌ Session cleanup failed: {e}")

# Global voice service instance
voice_service = VoiceService()