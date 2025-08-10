from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from supabase import create_client
from .config import settings

# Initialize Supabase client
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validate Supabase JWT token and return user info
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        
        # Validate token with Supabase
        try:
            user = supabase.auth.get_user(token)
            if not user or not user.user:
                raise credentials_exception
            return user.user
        except Exception as e:
            print(f"Auth error: {e}")
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception

async def get_current_user_with_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validate Supabase JWT token and return both user info and token
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        
        # Validate token with Supabase
        try:
            user = supabase.auth.get_user(token)
            if not user or not user.user:
                raise credentials_exception
            return {"user": user.user, "token": token}
        except Exception as e:
            print(f"Auth error: {e}")
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception

# Optional: Simple API key auth for internal services
async def get_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Simple API key validation for internal services
    """
    if credentials.credentials == settings.SECRET_KEY:
        return {"service": "internal"}
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API key"
    )