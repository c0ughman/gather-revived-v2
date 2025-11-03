#!/usr/bin/env python3
"""
Check which database the backend is actually connected to
"""
import sys
import os
sys.path.append('backend')

from backend.app.core.config import settings
from backend.app.services.database_service import database_service

def main():
    print("🔍 CHECKING DATABASE CONNECTION\n")
    
    # Check environment variables
    print("1. Environment Variables:")
    print(f"   SUPABASE_URL: {getattr(settings, 'SUPABASE_URL', 'NOT SET')}")
    print(f"   SUPABASE_ANON_KEY: {'SET' if getattr(settings, 'SUPABASE_ANON_KEY', None) else 'NOT SET'}")
    print(f"   SUPABASE_SERVICE_ROLE_KEY: {'SET' if getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', None) else 'NOT SET'}")
    
    # Check if .env file exists
    env_path = 'backend/.env'
    if os.path.exists(env_path):
        print(f"   .env file: EXISTS at {env_path}")
    else:
        print(f"   .env file: NOT FOUND at {env_path}")
        
    # Check root .env
    root_env = '.env'
    if os.path.exists(root_env):
        print(f"   Root .env file: EXISTS at {root_env}")
        with open(root_env, 'r') as f:
            lines = f.readlines()
            for line in lines:
                if 'SUPABASE' in line and not line.strip().startswith('#'):
                    print(f"      {line.strip()}")
    else:
        print(f"   Root .env file: NOT FOUND")
    
    # Test database connection
    print(f"\n2. Database Service Test:")
    try:
        supabase = database_service.admin_supabase
        print(f"   Supabase client: INITIALIZED")
        print(f"   URL: {supabase.supabase_url}")
        
        # Try a simple query
        result = supabase.table("user_agents").select("id,name").limit(1).execute()
        print(f"   Connection test: SUCCESS")
        print(f"   Query result: {len(result.data)} agents found")
        
        if result.data:
            print(f"   Sample agent: {result.data[0]}")
        
    except Exception as e:
        print(f"   Connection test: FAILED")
        print(f"   Error: {e}")
    
    # Check if we can see tables at all
    print(f"\n3. Table Structure Check:")
    try:
        # Try different ways to query
        tables_to_check = ["user_agents", "agent_documents", "user_profiles"]
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select("*").limit(1).execute()
                print(f"   {table}: {len(result.data)} records found")
            except Exception as e:
                print(f"   {table}: ERROR - {e}")
                
    except Exception as e:
        print(f"   Table check failed: {e}")

if __name__ == "__main__":
    main()