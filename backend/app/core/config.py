from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Gather API"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Supabase (will use during Stages 1-3)
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    
    # External APIs (from existing .env)
    GOOGLE_API_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_SECRET_KEY: str = ""
    NOTION_CLIENT_ID: str = ""
    NOTION_CLIENT_SECRET: str = ""
    FIRECRAWL_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    
    # CORS - Allow common development ports
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",   # Common React port
        "http://localhost:5173",   # Vite default port
        "http://localhost:5174",   # Vite alternative port
        "http://localhost:5175",   # Vite alternative port
        "http://localhost:5176",   # Vite alternative port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174", 
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"  # Allow extra fields from .env

settings = Settings()