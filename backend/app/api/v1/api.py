from fastapi import APIRouter
from .endpoints import health, documents, ai, voice, test_endpoints

api_router = APIRouter()

# Health endpoints
api_router.include_router(health.router, prefix="/health", tags=["health"])

# Stage 2: Performance-heavy operations
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])

# Stage 3: Voice and function calling
api_router.include_router(voice.router, prefix="/voice", tags=["voice"])

# Test endpoints (for development and testing)
api_router.include_router(test_endpoints.router, prefix="/test", tags=["testing"])

# Future endpoints will be added in later stages
# api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])