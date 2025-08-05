import asyncio
import logging
import httpx
from typing import Dict, Any, List, Optional
from ..core.config import settings

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
            
            # Build conversation history
            conversation_history = self._build_conversation_history(chat_history, contact.get('name', 'AI'))
            
            # Create the prompt
            prompt = f"""{context}

Previous conversation:
{conversation_history}

User: {user_message}
{contact.get('name', 'AI')}:"""
            
            logger.debug(f"📝 Sending prompt to Gemini API ({len(prompt)} characters)")
            
            # Prepare request payload
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
                ]
            }
            
            # Make API request
            response = await self._call_gemini_api('models/gemini-1.5-flash:generateContent', payload)
            
            # Extract response text
            candidates = response.get('candidates', [])
            if not candidates:
                raise ValueError('No response candidates from Gemini API')
            
            candidate = candidates[0]
            content = candidate.get('content', {})
            parts = content.get('parts', [])
            
            if not parts:
                raise ValueError('No content parts in Gemini API response')
            
            response_text = parts[0].get('text', '')
            
            if not response_text:
                raise ValueError('Empty response from Gemini API')
            
            logger.info(f"✅ Generated response ({len(response_text)} characters)")
            return response_text
            
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
    
    async def close(self):
        """Close HTTP client connections."""
        await self.client.aclose()

# Create singleton instance
ai_service = AIService()