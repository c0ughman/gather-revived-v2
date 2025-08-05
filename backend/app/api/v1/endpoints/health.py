from fastapi import APIRouter, Depends, HTTPException
from supabase import create_client
from ....core.config import settings
from ....core.auth import get_current_user
import httpx
import time

router = APIRouter()

# Initialize Supabase client for health checks
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

@router.get("/")
async def basic_health_check():
    """Basic health check - no dependencies"""
    return {
        "status": "healthy",
        "service": "gather-python-api",
        "version": "1.0.0",
        "stage": "1 - Foundation"
    }

@router.get("/supabase")
async def supabase_health_check():
    """Check Supabase connection"""
    try:
        # Simple query to test connection
        result = supabase.table('user_profiles').select('count').limit(1).execute()
        return {
            "status": "healthy",
            "supabase": "connected",
            "query_success": True
        }
    except Exception as e:
        return {
            "status": "unhealthy", 
            "supabase": "disconnected",
            "error": str(e)
        }

@router.get("/auth")
async def auth_health_check(current_user = Depends(get_current_user)):
    """Test authentication - requires valid Supabase JWT"""
    return {
        "status": "healthy",
        "auth": "working",
        "user_id": current_user.id,
        "user_email": current_user.email
    }

@router.get("/external-apis")
async def external_apis_health_check():
    """Check external API connectivity"""
    checks = {}
    
    # Test Google API (if key provided)
    if settings.GOOGLE_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                # Simple test to Google's API
                response = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={settings.GOOGLE_API_KEY}",
                    timeout=5.0
                )
                checks["google"] = {
                    "status": "healthy" if response.status_code == 200 else "unhealthy",
                    "response_code": response.status_code
                }
        except Exception as e:
            checks["google"] = {"status": "unhealthy", "error": str(e)}
    else:
        checks["google"] = {"status": "not_configured"}
    
    # Test Supabase connectivity
    try:
        result = supabase.table('user_profiles').select('count').limit(1).execute()
        checks["supabase"] = {"status": "healthy", "connected": True}
    except Exception as e:
        checks["supabase"] = {"status": "unhealthy", "error": str(e)}
    
    overall_status = "healthy" if all(
        check.get("status") == "healthy" 
        for check in checks.values() 
        if check.get("status") != "not_configured"
    ) else "unhealthy"
    
    return {
        "status": overall_status,
        "checks": checks,
        "timestamp": time.time()
    }

@router.get("/detailed")
async def detailed_health_check():
    """Comprehensive health check"""
    checks = {}
    start_time = time.time()
    
    # Basic app health
    checks["app"] = {"status": "healthy", "uptime": time.time()}
    
    # Supabase connection
    try:
        supabase_start = time.time()
        result = supabase.table('user_profiles').select('count').limit(1).execute()
        supabase_time = time.time() - supabase_start
        checks["supabase"] = {
            "status": "healthy",
            "response_time_ms": round(supabase_time * 1000, 2)
        }
    except Exception as e:
        checks["supabase"] = {"status": "unhealthy", "error": str(e)}
    
    # Environment variables
    env_checks = {
        "SUPABASE_URL": bool(settings.SUPABASE_URL),
        "SUPABASE_ANON_KEY": bool(settings.SUPABASE_ANON_KEY),
        "GOOGLE_API_KEY": bool(settings.GOOGLE_API_KEY),
    }
    checks["environment"] = {
        "status": "healthy" if all(env_checks.values()) else "warning",
        "configured": env_checks
    }
    
    total_time = time.time() - start_time
    overall_status = "healthy" if all(
        check.get("status") == "healthy" 
        for check in checks.values()
        if check.get("status") not in ["warning", "not_configured"]
    ) else "unhealthy"
    
    return {
        "status": overall_status,
        "checks": checks,
        "total_check_time_ms": round(total_time * 1000, 2),
        "timestamp": time.time()
    }