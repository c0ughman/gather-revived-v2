"""
Token Counting Utilities

Provides consistent token counting across the application using character-based approximation.
1 token ≈ 4 characters for simplicity and performance.
"""

from typing import List, Dict, Any, Optional, Union
import re

class TokenCounter:
    """
    Token counting utility using character-based approximation.
    Provides consistent token counting across all application components.
    """
    
    # Token approximation: 1 token ≈ 4 characters
    CHARS_PER_TOKEN = 4
    
    @classmethod
    def count_tokens(cls, text: str) -> int:
        """
        Count tokens in text using character-based approximation.
        
        Args:
            text: Text to count tokens for
            
        Returns:
            Estimated token count
        """
        if not text:
            return 0
        
        # Clean up text (remove excessive whitespace, normalize)
        cleaned_text = re.sub(r'\s+', ' ', text.strip())
        char_count = len(cleaned_text)
        
        # Convert to tokens using approximation
        token_count = max(1, (char_count + cls.CHARS_PER_TOKEN - 1) // cls.CHARS_PER_TOKEN)
        
        return token_count
    
    @classmethod
    def count_tokens_in_messages(cls, messages: List[Dict[str, Any]]) -> int:
        """
        Count total tokens in a list of messages.
        
        Args:
            messages: List of message dictionaries with 'content' field
            
        Returns:
            Total token count across all messages
        """
        total_tokens = 0
        
        for message in messages:
            content = message.get('content', '')
            if isinstance(content, str):
                total_tokens += cls.count_tokens(content)
        
        return total_tokens
    
    @classmethod
    def count_tokens_in_documents(cls, documents: List[Dict[str, Any]]) -> int:
        """
        Count total tokens in a list of documents.
        
        Args:
            documents: List of document dictionaries
            
        Returns:
            Total token count across all documents
        """
        total_tokens = 0
        
        for doc in documents:
            # Try different content fields
            content = (
                doc.get('extracted_text') or 
                doc.get('content') or 
                doc.get('summary') or 
                ''
            )
            
            if isinstance(content, str):
                total_tokens += cls.count_tokens(content)
        
        return total_tokens
    
    @classmethod
    def count_tokens_in_notes(cls, notes: List[Dict[str, Any]]) -> int:
        """
        Count total tokens in a list of paper notes.
        
        Args:
            notes: List of paper note dictionaries
            
        Returns:
            Total token count across all notes
        """
        total_tokens = 0
        
        for note in notes:
            content = note.get('content', '') or note.get('text', '')
            if isinstance(content, str):
                total_tokens += cls.count_tokens(content)
        
        return total_tokens
    
    @classmethod
    def truncate_to_token_limit(cls, text: str, max_tokens: int) -> str:
        """
        Truncate text to stay within token limit.
        
        Args:
            text: Text to truncate
            max_tokens: Maximum tokens allowed
            
        Returns:
            Truncated text that fits within token limit
        """
        if not text:
            return text
        
        current_tokens = cls.count_tokens(text)
        
        if current_tokens <= max_tokens:
            return text
        
        # Calculate target character count
        max_chars = max_tokens * cls.CHARS_PER_TOKEN
        
        # Truncate to approximate character limit
        if len(text) > max_chars:
            truncated = text[:max_chars].rsplit(' ', 1)[0]  # Break at word boundary
            return truncated + "..."
        
        return text
    
    @classmethod
    def filter_messages_by_token_limit(
        cls, 
        messages: List[Dict[str, Any]], 
        max_tokens: int,
        reverse_chronological: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Filter messages to stay within token limit, keeping most recent first.
        
        Args:
            messages: List of message dictionaries
            max_tokens: Maximum total tokens allowed
            reverse_chronological: If True, keep newest messages first
            
        Returns:
            Filtered list of messages within token limit
        """
        if not messages:
            return []
        
        # Sort messages by preference (newest first by default)
        sorted_messages = messages.copy()
        if reverse_chronological:
            sorted_messages.reverse()
        
        filtered_messages = []
        current_tokens = 0
        
        for message in sorted_messages:
            message_tokens = cls.count_tokens(message.get('content', ''))
            
            if current_tokens + message_tokens <= max_tokens:
                filtered_messages.append(message)
                current_tokens += message_tokens
            else:
                # Stop adding messages once we hit the limit
                break
        
        # Restore original order if we reversed it
        if reverse_chronological:
            filtered_messages.reverse()
        
        return filtered_messages
    
    @classmethod
    def filter_items_by_token_limit(
        cls,
        items: List[Dict[str, Any]],
        max_tokens: int,
        content_field: str = 'content',
        keep_pinned: bool = False,
        pinned_field: str = 'is_pinned'
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Filter items by token limit, optionally keeping pinned items.
        
        Args:
            items: List of item dictionaries  
            max_tokens: Maximum total tokens allowed
            content_field: Field name containing the text content
            keep_pinned: Whether to always include pinned items
            pinned_field: Field name indicating if item is pinned
            
        Returns:
            Tuple of (included_items, excluded_items)
        """
        if not items:
            return [], []
        
        included_items = []
        excluded_items = []
        current_tokens = 0
        
        # First pass: Always include all pinned items and count their tokens
        pinned_tokens = 0
        for item in items:
            is_pinned = item.get(pinned_field, False)
            if is_pinned and keep_pinned:
                item_tokens = cls.count_tokens(item.get(content_field, ''))
                included_items.append(item)
                pinned_tokens += item_tokens
        
        # Second pass: Add unpinned items until total (pinned + unpinned) exceeds limit
        current_tokens = pinned_tokens
        for item in items:
            is_pinned = item.get(pinned_field, False)
            if not is_pinned:  # Only process unpinned items
                item_tokens = cls.count_tokens(item.get(content_field, ''))
                
                if current_tokens + item_tokens <= max_tokens:
                    # Include unpinned items that fit within total limit
                    included_items.append(item)
                    current_tokens += item_tokens
                else:
                    # Exclude unpinned items that exceed total limit
                    excluded_items.append(item)
        
        return included_items, excluded_items
    
    @classmethod
    def is_over_token_limit(cls, text: str, max_tokens: int) -> bool:
        """
        Check if text exceeds token limit.
        
        Args:
            text: Text to check
            max_tokens: Maximum tokens allowed
            
        Returns:
            True if text exceeds limit
        """
        return cls.count_tokens(text) > max_tokens
    
    @classmethod
    def get_token_usage_info(cls, text: str, max_tokens: int) -> Dict[str, Any]:
        """
        Get detailed token usage information.
        
        Args:
            text: Text to analyze
            max_tokens: Maximum tokens allowed
            
        Returns:
            Dictionary with usage information
        """
        current_tokens = cls.count_tokens(text)
        
        return {
            'current_tokens': current_tokens,
            'max_tokens': max_tokens,
            'remaining_tokens': max(0, max_tokens - current_tokens),
            'over_limit': current_tokens > max_tokens,
            'usage_percentage': min(100.0, (current_tokens / max_tokens) * 100.0) if max_tokens > 0 else 0.0
        }


# Create singleton instance for easy importing
token_counter = TokenCounter()

# Export commonly used functions for direct access
count_tokens = TokenCounter.count_tokens
count_tokens_in_messages = TokenCounter.count_tokens_in_messages
count_tokens_in_documents = TokenCounter.count_tokens_in_documents
truncate_to_token_limit = TokenCounter.truncate_to_token_limit
is_over_token_limit = TokenCounter.is_over_token_limit

__all__ = [
    'TokenCounter',
    'token_counter',
    'count_tokens',
    'count_tokens_in_messages', 
    'count_tokens_in_documents',
    'truncate_to_token_limit',
    'is_over_token_limit',
]