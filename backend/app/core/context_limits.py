"""
Context Limits Configuration

This file contains all context and token limits used throughout the application.
Centralized configuration for easy management and consistency.
"""

from typing import Dict, Any

class ContextLimits:
    """
    Centralized configuration for all context limits across the application.
    
    This class provides a single source of truth for:
    - Token limits for AI models
    - Content length limits for documents
    - Message history limits
    - Search result limits
    - Memory context limits
    """
    
    # ===========================================
    # AI MODEL TOKEN LIMITS
    # ===========================================
    
    # Gemini API token limits
    AI_MAX_OUTPUT_TOKENS_CHAT = 2048          # Standard chat responses
    AI_MAX_OUTPUT_TOKENS_SUMMARY = 1024       # Document summaries
    AI_MAX_OUTPUT_TOKENS_HEALTH_CHECK = 10    # Health check responses
    AI_TEMPERATURE_CHAT = 0.7                 # Chat creativity level
    AI_TEMPERATURE_SUMMARY = 0.3              # Summary factual level
    AI_TOP_K = 40
    AI_TOP_P = 0.95
    
    # ===========================================
    # TOKEN-BASED CONTENT LIMITS (NEW SYSTEM)
    # ===========================================
    
    # Conversation context limit - 4k tokens
    CONVERSATION_CONTEXT_MAX_TOKENS = 4000     # Max tokens for chat message history
    
    # Agent description limit - 4k tokens  
    AGENT_DESCRIPTION_MAX_TOKENS = 4000        # Max tokens for agent description
    
    # Paper notes context limit - 4k tokens
    PAPER_NOTES_CONTEXT_MAX_TOKENS = 4000      # Max tokens for paper notes in context
    
    # Medium term memory limit - 4k tokens
    MEDIUM_TERM_MEMORY_MAX_TOKENS = 4000       # Max tokens for medium term memory
    
    # Document limits
    DOCUMENT_MAX_TOKENS_PER_DOCUMENT = 20000   # 20k tokens per individual document
    AGENT_DOCUMENTS_MAX_COUNT = 10             # Max 10 documents per agent
    CONVERSATION_DOCUMENTS_MAX_TOKENS = 20000  # 20k tokens cumulative for conversation docs
    
    # ===========================================
    # LEGACY CHARACTER-BASED LIMITS
    # ===========================================
    
    # Document processing and context inclusion (kept for backward compatibility)
    DOCUMENT_CONTENT_MAX_CHARS_CHAT = 2000         # Document content in chat context
    DOCUMENT_CONTENT_MAX_CHARS_VOICE = 2000        # Document content in voice context  
    DOCUMENT_CONTENT_MAX_CHARS_SUMMARY = 4000      # Document content for summarization
    DOCUMENT_EXCERPT_TRUNCATION_INDICATOR = "..."   # Shown when content is truncated
    
    # ===========================================
    # CHAT HISTORY LIMITS
    # ===========================================
    
    # Message history for context (now token-based)
    CHAT_HISTORY_MAX_MESSAGES = None           # No message count limit, use token limit instead
    CHAT_HISTORY_MAX_TOKENS = 1000             # Restored to reasonable limit (was 1000 for testing)
    CHAT_HISTORY_MAX_CHARS_PER_MESSAGE = None  # No limit on individual messages
    
    # ===========================================
    # CONVERSATION COMPACTING CONFIGURATION
    # ===========================================
    
    # Conversation compacting thresholds and limits
    CHAT_COMPACTING_THRESHOLD = 0.8            # 80% - When to trigger compacting
    CHAT_MESSAGES_TO_KEEP_RECENT = 2           # Keep last 2 messages uncompacted
    CHAT_SUMMARY_MAX_TOKENS = 250              # 25% of chat limit for summary
    
    # ===========================================
    # SEARCH AND MEMORY LIMITS
    # ===========================================
    
    # Past conversations search
    SEARCH_PAST_CONVERSATIONS_DEFAULT_LIMIT = 3    # Default number of conversations to return
    SEARCH_PAST_CONVERSATIONS_MAX_LIMIT = 10       # Maximum conversations allowed
    SEARCH_PAST_CONVERSATIONS_MIN_LIMIT = 1        # Minimum conversations allowed
    SEARCH_PAST_CONVERSATIONS_DB_MULTIPLIER = 3    # Get N*3 from DB to find best matches
    
    # Search result excerpts
    SEARCH_EXCERPT_CONTEXT_CHARS = 100         # Characters before/after match
    SEARCH_EXCERPT_MAX_LENGTH = 300            # Maximum excerpt length
    
    # Memory context (now token-based)
    MEMORY_CONTEXT_MAX_ITEMS = None            # No limit on memory items count
    MEMORY_CONTEXT_MAX_TOKENS = 4000           # Token limit for paper notes context
    MEMORY_CONTEXT_MAX_CHARS_PER_ITEM = None   # No limit on individual memory items
    
    # ===========================================
    # DATABASE QUERY LIMITS
    # ===========================================
    
    # General database pagination
    DB_DEFAULT_LIMIT = 50                      # Default limit for list queries
    DB_MAX_LIMIT = 100                         # Maximum limit for list queries
    
    # Agent conversations
    CONVERSATION_SESSIONS_DEFAULT_LIMIT = 50   # Default conversation sessions to fetch
    CONVERSATION_MESSAGES_MAX_FOR_PREVIEW = 4  # Messages to show in conversation preview
    
    # ===========================================
    # HTTP AND CONNECTION LIMITS
    # ===========================================
    
    # HTTP client configuration
    HTTP_MAX_KEEPALIVE_CONNECTIONS = 5         # HTTP client keepalive connections
    HTTP_MAX_CONNECTIONS = 10                  # HTTP client total connections
    HTTP_TIMEOUT_SECONDS = 60.0                # HTTP request timeout
    
    # ===========================================
    # VOICE SPECIFIC LIMITS
    # ===========================================
    
    # Voice conversation limits (optimized for lower latency)
    VOICE_DOCUMENT_CONTENT_MAX_CHARS = 2000    # Same as chat for consistency
    VOICE_SEARCH_DEFAULT_LIMIT = 5             # More results for voice context
    VOICE_SEARCH_MAX_LIMIT = 10                # Maximum for voice search
    VOICE_SYSTEM_INSTRUCTION_MAX_CHARS = 8000  # System instruction limit for Gemini Live API
    
    # ===========================================
    # INTEGRATION LIMITS
    # ===========================================
    
    # Web search and integrations
    WEB_SEARCH_DEFAULT_MAX_RESULTS = 5         # Default web search results
    WEB_SEARCH_MAX_RESULTS_LIMIT = 20          # Maximum web search results
    FIRECRAWL_MAX_PAGES = 5                    # Maximum pages to scrape
    
    # ===========================================
    # HELPER METHODS
    # ===========================================
    
    @classmethod
    def get_ai_config(cls) -> Dict[str, Any]:
        """Get AI generation configuration for chat responses."""
        return {
            "temperature": cls.AI_TEMPERATURE_CHAT,
            "topK": cls.AI_TOP_K,
            "topP": cls.AI_TOP_P,
            "maxOutputTokens": cls.AI_MAX_OUTPUT_TOKENS_CHAT,
        }
    
    @classmethod
    def get_summary_config(cls) -> Dict[str, Any]:
        """Get AI generation configuration for document summaries."""
        return {
            "temperature": cls.AI_TEMPERATURE_SUMMARY,
            "topK": cls.AI_TOP_K,
            "topP": cls.AI_TOP_P,
            "maxOutputTokens": cls.AI_MAX_OUTPUT_TOKENS_SUMMARY,
        }
    
    @classmethod
    def get_health_check_config(cls) -> Dict[str, Any]:
        """Get AI generation configuration for health checks."""
        return {
            "temperature": 0.1,
            "maxOutputTokens": cls.AI_MAX_OUTPUT_TOKENS_HEALTH_CHECK,
        }
    
    @classmethod
    def truncate_document_content(cls, content: str, context_type: str = "chat") -> str:
        """
        Truncate document content based on context type.
        
        Args:
            content: The document content to truncate
            context_type: "chat", "voice", or "summary"
            
        Returns:
            Truncated content with indicator if needed
        """
        if context_type == "chat":
            max_chars = cls.DOCUMENT_CONTENT_MAX_CHARS_CHAT
        elif context_type == "voice":
            max_chars = cls.DOCUMENT_CONTENT_MAX_CHARS_VOICE
        elif context_type == "summary":
            max_chars = cls.DOCUMENT_CONTENT_MAX_CHARS_SUMMARY
        else:
            max_chars = cls.DOCUMENT_CONTENT_MAX_CHARS_CHAT  # Default to chat
        
        if len(content) <= max_chars:
            return content
        
        return content[:max_chars] + cls.DOCUMENT_EXCERPT_TRUNCATION_INDICATOR
    
    @classmethod
    def clamp_search_limit(cls, limit: int, search_type: str = "past_conversations") -> int:
        """
        Clamp search limits to valid ranges.
        
        Args:
            limit: Requested limit
            search_type: "past_conversations", "web", etc.
            
        Returns:
            Clamped limit within valid range
        """
        if search_type == "past_conversations":
            return max(cls.SEARCH_PAST_CONVERSATIONS_MIN_LIMIT, 
                      min(cls.SEARCH_PAST_CONVERSATIONS_MAX_LIMIT, limit))
        elif search_type == "web":
            return max(1, min(cls.WEB_SEARCH_MAX_RESULTS_LIMIT, limit))
        else:
            return max(1, min(10, limit))  # Default range
    
    @classmethod
    def get_recent_messages(cls, messages: list, max_messages: int = None) -> list:
        """
        Get recent messages for context, respecting limits.
        
        Args:
            messages: List of messages
            max_messages: Override for max messages (uses default if None)
            
        Returns:
            List of recent messages
        """
        # Use token-based filtering if max_messages is not provided
        if max_messages is None:
            from .token_utils import TokenCounter
            return TokenCounter.filter_messages_by_token_limit(
                messages, cls.CONVERSATION_CONTEXT_MAX_TOKENS
            )
        
        # Legacy message count limit
        return messages[-max_messages:] if len(messages) > max_messages else messages
    
    @classmethod
    def validate_agent_description(cls, description: str) -> Dict[str, Any]:
        """
        Validate agent description against token limit.
        
        Args:
            description: Agent description text
            
        Returns:
            Validation result with token info
        """
        from .token_utils import TokenCounter
        tokens = TokenCounter.count_tokens(description)
        
        return {
            'valid': tokens <= cls.AGENT_DESCRIPTION_MAX_TOKENS,
            'tokens': tokens,
            'max_tokens': cls.AGENT_DESCRIPTION_MAX_TOKENS,
            'over_limit': tokens > cls.AGENT_DESCRIPTION_MAX_TOKENS,
            'remaining_tokens': max(0, cls.AGENT_DESCRIPTION_MAX_TOKENS - tokens)
        }
    
    @classmethod
    def truncate_agent_description(cls, description: str) -> str:
        """
        Truncate agent description to fit token limit.
        
        Args:
            description: Agent description text
            
        Returns:
            Truncated description
        """
        from .token_utils import TokenCounter
        return TokenCounter.truncate_to_token_limit(
            description, cls.AGENT_DESCRIPTION_MAX_TOKENS
        )
    
    @classmethod
    def validate_document_tokens(cls, content: str, is_agent_document: bool = True) -> Dict[str, Any]:
        """
        Validate document content against token limits.
        
        Args:
            content: Document content
            is_agent_document: Whether this is an agent document (vs conversation document)
            
        Returns:
            Validation result
        """
        from .token_utils import TokenCounter
        tokens = TokenCounter.count_tokens(content)
        
        if is_agent_document:
            max_tokens = cls.DOCUMENT_MAX_TOKENS_PER_DOCUMENT
        else:
            # For conversation documents, we validate cumulative in separate method
            max_tokens = cls.DOCUMENT_MAX_TOKENS_PER_DOCUMENT  # Still limit individual docs
        
        return {
            'valid': tokens <= max_tokens,
            'tokens': tokens,
            'max_tokens': max_tokens,
            'over_limit': tokens > max_tokens
        }
    
    @classmethod
    def validate_agent_document_limits(cls, existing_docs: list, new_docs: list) -> Dict[str, Any]:
        """
        Validate agent document count and token limits.
        
        Args:
            existing_docs: List of existing documents
            new_docs: List of new documents to add
            
        Returns:
            Validation result
        """
        from .token_utils import TokenCounter
        
        # Check count limit
        total_count = len(existing_docs) + len(new_docs)
        if total_count > cls.AGENT_DOCUMENTS_MAX_COUNT:
            return {
                'valid': False,
                'error': f'Maximum {cls.AGENT_DOCUMENTS_MAX_COUNT} documents per agent',
                'current_count': len(existing_docs),
                'max_count': cls.AGENT_DOCUMENTS_MAX_COUNT
            }
        
        # Check individual document token limits
        for doc in new_docs:
            content = doc.get('extracted_text') or doc.get('content') or doc.get('summary') or ''
            validation = cls.validate_document_tokens(content, is_agent_document=True)
            if not validation['valid']:
                return {
                    'valid': False,
                    'error': f'Document exceeds {cls.DOCUMENT_MAX_TOKENS_PER_DOCUMENT:,} token limit',
                    'tokens': validation['tokens'],
                    'max_tokens': cls.DOCUMENT_MAX_TOKENS_PER_DOCUMENT
                }
        
        return {'valid': True}
    
    @classmethod
    def validate_conversation_document_limits(cls, existing_docs: list, new_docs: list) -> Dict[str, Any]:
        """
        Validate conversation document cumulative token limits.
        
        Args:
            existing_docs: List of existing conversation documents
            new_docs: List of new documents to add
            
        Returns:
            Validation result
        """
        from .token_utils import TokenCounter
        
        current_tokens = TokenCounter.count_tokens_in_documents(existing_docs)
        new_tokens = TokenCounter.count_tokens_in_documents(new_docs)
        total_tokens = current_tokens + new_tokens
        
        if total_tokens > cls.CONVERSATION_DOCUMENTS_MAX_TOKENS:
            return {
                'valid': False,
                'error': f'Conversation documents would exceed {cls.CONVERSATION_DOCUMENTS_MAX_TOKENS:,} token limit',
                'current_tokens': current_tokens,
                'new_tokens': new_tokens,
                'total_tokens': total_tokens,
                'max_tokens': cls.CONVERSATION_DOCUMENTS_MAX_TOKENS
            }
        
        return {
            'valid': True,
            'current_tokens': current_tokens,
            'new_tokens': new_tokens,
            'total_tokens': total_tokens
        }
    
    @classmethod
    def filter_notes_by_token_limit(cls, notes: list, keep_pinned: bool = True) -> Dict[str, Any]:
        """
        Filter paper notes to stay within token limit.
        
        Args:
            notes: List of paper notes (should be sorted newest first)
            keep_pinned: Whether to always include pinned notes
            
        Returns:
            Dictionary with included and excluded notes
        """
        from .token_utils import TokenCounter
        
        included, excluded = TokenCounter.filter_items_by_token_limit(
            notes,
            cls.PAPER_NOTES_CONTEXT_MAX_TOKENS,
            content_field='content',
            keep_pinned=keep_pinned,
            pinned_field='is_pinned'
        )
        
        return {
            'included_notes': included,
            'excluded_notes': excluded,
            'total_tokens': TokenCounter.count_tokens_in_notes(included),
            'max_tokens': cls.PAPER_NOTES_CONTEXT_MAX_TOKENS
        }
    
    @classmethod
    def filter_memory_by_token_limit(cls, memory_items: list) -> Dict[str, Any]:
        """
        Filter medium term memory items to stay within token limit.
        
        Args:
            memory_items: List of memory items (should be sorted by timestamp)
            
        Returns:
            Dictionary with included and excluded memory items
        """
        from .token_utils import TokenCounter
        
        included, excluded = TokenCounter.filter_items_by_token_limit(
            memory_items,
            cls.MEDIUM_TERM_MEMORY_MAX_TOKENS,
            content_field='content'
        )
        
        return {
            'included_memory': included,
            'excluded_memory': excluded,
            'total_tokens': TokenCounter.count_tokens_in_notes(included),
            'max_tokens': cls.MEDIUM_TERM_MEMORY_MAX_TOKENS
        }


# Create singleton instance for easy importing
context_limits = ContextLimits()

# Export commonly used limits for direct access
__all__ = [
    'ContextLimits',
    'context_limits',
]