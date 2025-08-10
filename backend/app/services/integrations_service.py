"""
Integration Services for Backend

This service handles all integration logic that was previously on the frontend:
- HTTP API requests
- Web search (Tavily)
- Google News
- RSS feeds
- Financial markets
- Firecrawl web scraping
- Domain checking

All OAuth functionality has been removed as it was incorrectly set up.
"""

import asyncio
import aiohttp
import json
import logging
import time
import feedparser
import whois
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

class IntegrationsService:
    def __init__(self):
        self.integration_cache: Dict[str, Dict[str, Any]] = {}
        logger.info("🔧 Integration Service initialized")

    # ============================================================================
    # CACHE MANAGEMENT
    # ============================================================================

    def store_integration_data(self, contact_id: str, integration_id: str, data: Any, summary: str) -> None:
        """Store integration data in cache"""
        cache_key = f"{contact_id}:{integration_id}"
        self.integration_cache[cache_key] = {
            "data": data,
            "timestamp": datetime.now(),
            "summary": summary
        }
        logger.info(f"💾 Stored integration data for {integration_id}")

    def get_integration_data(self, contact_id: str, integration_id: str) -> Optional[Dict[str, Any]]:
        """Get integration data from cache"""
        cache_key = f"{contact_id}:{integration_id}"
        return self.integration_cache.get(cache_key)

    def clear_integration_data(self, contact_id: str, integration_id: str) -> None:
        """Clear integration data from cache"""
        cache_key = f"{contact_id}:{integration_id}"
        if cache_key in self.integration_cache:
            del self.integration_cache[cache_key]
            logger.info(f"🧹 Cleared integration data for {integration_id}")

    # ============================================================================
    # HTTP API REQUESTS
    # ============================================================================

    async def execute_api_request(self, url: str, method: str = "GET", headers: Optional[Dict[str, str]] = None, body: Optional[str] = None) -> Dict[str, Any]:
        """Execute HTTP API request"""
        try:
            logger.info(f"🌐 Making {method} request to {url}")
            
            if not url:
                raise ValueError("URL is required")

            headers = headers or {}
            
            async with aiohttp.ClientSession() as session:
                request_kwargs = {
                    "headers": headers,
                    "timeout": aiohttp.ClientTimeout(total=30)
                }
                
                if body and method.upper() in ["POST", "PUT"]:
                    request_kwargs["data"] = body

                async with session.request(method.upper(), url, **request_kwargs) as response:
                    if not response.ok:
                        raise Exception(f"HTTP request failed: {response.status} {response.reason}")
                    
                    try:
                        result = await response.json()
                    except:
                        result = await response.text()
                    
                    return {
                        "success": True,
                        "status": response.status,
                        "data": result
                    }

        except Exception as e:
            logger.error(f"❌ API request failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ============================================================================
    # WEB SEARCH (TAVILY)
    # ============================================================================

    async def execute_web_search_tool(self, query: str, search_depth: str = "basic", max_results: int = 5, include_answer: bool = True) -> Dict[str, Any]:
        """Execute web search using Tavily API"""
        try:
            from ..core.config import settings
            
            if not settings.TAVILY_API_KEY:
                logger.error("❌ Tavily API key not configured")
                return {
                    "success": False,
                    "error": "Tavily API key not configured in backend environment"
                }
            
            logger.info(f"🔍 Web search request: {query} (depth: {search_depth}, max: {max_results})")
            
            # Tavily API endpoint
            tavily_url = "https://api.tavily.com/search"
            
            payload = {
                "api_key": settings.TAVILY_API_KEY,
                "query": query,
                "search_depth": search_depth,
                "include_answer": include_answer,
                "include_images": False,
                "include_raw_content": False,
                "max_results": max_results,
                "include_domains": [],
                "exclude_domains": []
            }
            
            # Create SSL context to handle certificate issues
            import ssl
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.post(
                    tavily_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30),
                    headers={"Content-Type": "application/json"}
                ) as response:
                    
                    if not response.ok:
                        error_text = await response.text()
                        logger.error(f"❌ Tavily API error: {response.status} - {error_text}")
                        return {
                            "success": False,
                            "error": f"Tavily API error: {response.status}"
                        }
                    
                    result = await response.json()
                    
                    # Format response to match expected structure
                    formatted_results = []
                    if "results" in result:
                        for item in result["results"]:
                            formatted_results.append({
                                "title": item.get("title", ""),
                                "url": item.get("url", ""),
                                "content": item.get("content", ""),
                                "score": item.get("score", 0)
                            })
                    
                    return {
                        "success": True,
                        "query": query,
                        "results": formatted_results,
                        "answer": result.get("answer", ""),
                        "search_depth": search_depth,
                        "total_results": len(formatted_results)
                    }
            
        except Exception as e:
            logger.error(f"❌ Web search failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ============================================================================
    # DOMAIN CHECKING
    # ============================================================================

    async def check_domain_availability(self, domain: str, variations: Optional[List[str]] = None) -> Dict[str, Any]:
        """Check domain availability using RDAP/WHOIS"""
        try:
            logger.info(f"🔍 Checking domain availability: {domain}")
            
            results = []
            domains_to_check = [domain]
            
            if variations:
                # Replace {domain} placeholder in variations
                for variation in variations:
                    if "{domain}" in variation:
                        domains_to_check.append(variation.replace("{domain}", domain))
                    else:
                        domains_to_check.append(variation)
            else:
                # Default variations
                default_extensions = [".com", ".net", ".org", ".io", ".co"]
                base_domain = domain.split('.')[0] if '.' in domain else domain
                domains_to_check.extend([f"{base_domain}{ext}" for ext in default_extensions])
            
            for check_domain in domains_to_check:
                try:
                    # Simple availability check using whois
                    domain_info = whois.whois(check_domain)
                    available = not domain_info.domain_name
                    
                    results.append({
                        "domain": check_domain,
                        "available": available,
                        "status": "available" if available else "registered"
                    })
                    
                except Exception as e:
                    results.append({
                        "domain": check_domain,
                        "available": None,
                        "status": "error",
                        "error": str(e)
                    })
            
            return {
                "success": True,
                "domain": domain,
                "results": results,
                "total_checked": len(results)
            }
            
        except Exception as e:
            logger.error(f"❌ Domain check failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ============================================================================
    # WEBHOOK TRIGGERS
    # ============================================================================

    async def trigger_webhook(self, webhook_url: str, action: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Trigger webhook for automations"""
        try:
            logger.info(f"🪝 Triggering webhook: {action}")
            
            payload = {
                "action": action,
                "timestamp": datetime.now().isoformat(),
                "data": data or {}
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    result = {
                        "success": response.ok,
                        "status": response.status,
                        "action": action
                    }
                    
                    if response.ok:
                        try:
                            result["response"] = await response.json()
                        except:
                            result["response"] = await response.text()
                    else:
                        result["error"] = f"Webhook failed: {response.status} {response.reason}"
                    
                    return result
                    
        except Exception as e:
            logger.error(f"❌ Webhook trigger failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ============================================================================
    # FIRECRAWL WEB SCRAPING
    # ============================================================================

    async def execute_firecrawl_tool_operation(self, url: str, extract_type: str = "text", include_images: bool = False, max_pages: int = 5) -> Dict[str, Any]:
        """Execute Firecrawl web scraping"""
        try:
            from ..core.config import settings
            
            if not settings.FIRECRAWL_API_KEY:
                logger.error("❌ Firecrawl API key not configured")
                return {
                    "success": False,
                    "error": "Firecrawl API key not configured in backend environment"
                }
            
            logger.info(f"🕷️ Firecrawl scraping: {url} (type: {extract_type}, max_pages: {max_pages})")
            
            # Firecrawl API endpoint for scraping
            firecrawl_url = "https://api.firecrawl.dev/v0/scrape"
            
            # Basic Firecrawl API payload
            payload = {
                "url": url
            }
            
            # Add page options if needed
            if extract_type in ["markdown", "text"]:
                payload["formats"] = ["markdown"]
            elif extract_type == "html":
                payload["formats"] = ["html"]
            else:
                payload["formats"] = ["markdown"]  # default
            
            # Note: include_images is handled via pageOptions.includeMarkdown/includeHtml
            
            headers = {
                "Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}",
                "Content-Type": "application/json"
            }
            
            # Create SSL context to handle certificate issues  
            import ssl
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.post(
                    firecrawl_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60),
                    headers=headers
                ) as response:
                    
                    if not response.ok:
                        error_text = await response.text()
                        logger.error(f"❌ Firecrawl API error: {response.status} - {error_text}")
                        return {
                            "success": False,
                            "error": f"Firecrawl API error: {response.status}"
                        }
                    
                    result = await response.json()
                    
                    # Extract the content based on the response structure
                    content = ""
                    title = ""
                    
                    if result.get("success") and "data" in result:
                        data = result["data"]
                        
                        # Get content based on extract_type
                        if extract_type == "markdown" and "markdown" in data:
                            content = data["markdown"]
                        elif extract_type == "html" and "html" in data:
                            content = data["html"]
                        elif "markdown" in data:
                            content = data["markdown"]  # Default to markdown
                        else:
                            content = data.get("content", "")
                        
                        # Extract title
                        metadata = data.get("metadata", {})
                        title = metadata.get("title", "") or metadata.get("ogTitle", "")
                    
                    # Format response to match expected structure
                    formatted_pages = [{
                        "url": url,
                        "title": title,
                        "content": content,
                        "extract_type": extract_type,
                        "success": result.get("success", False)
                    }]
                    
                    return {
                        "success": True,
                        "url": url,
                        "pages": formatted_pages,
                        "total_pages": len(formatted_pages),
                        "extract_type": extract_type,
                        "include_images": include_images
                    }
            
        except Exception as e:
            logger.error(f"❌ Firecrawl scraping failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ============================================================================
    # GOOGLE SHEETS (MOCK - OAuth removed)
    # ============================================================================

    async def execute_google_sheets_tool_operation(self, operation: str, sheet_url: str, access_level: str, sheet_name: Optional[str] = None, range_spec: Optional[str] = None, data: Optional[List[List[str]]] = None, search_term: Optional[str] = None) -> Dict[str, Any]:
        """Execute Google Sheets operations (OAuth removed)"""
        try:
            logger.info(f"📊 Google Sheets operation: {operation}")
            
            return {
                "success": False,
                "error": "Google Sheets integration removed - OAuth was incorrectly configured and has been disabled",
                "operation": operation
            }
            
        except Exception as e:
            logger.error(f"❌ Google Sheets operation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ============================================================================
    # NOTION (MOCK - OAuth removed)
    # ============================================================================

    async def execute_notion_tool_operation(self, operation: str, query: Optional[str] = None, page_id: Optional[str] = None, database_id: Optional[str] = None, title: Optional[str] = None, content: Optional[str] = None, parent_id: Optional[str] = None, properties: Optional[Dict[str, Any]] = None, filter_criteria: Optional[Dict[str, Any]] = None, sorts: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Execute Notion operations (OAuth removed)"""
        try:
            logger.info(f"📝 Notion operation: {operation}")
            
            return {
                "success": False,
                "error": "Notion integration removed - OAuth was incorrectly configured and has been disabled",
                "operation": operation
            }
            
        except Exception as e:
            logger.error(f"❌ Notion operation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Global instance
integrations_service = IntegrationsService()