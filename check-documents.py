#!/usr/bin/env python3
"""
Check if documents exist in the database
"""
import os
import sys

# Add backend to path
sys.path.append('backend')

from backend.app.services.database_service import database_service

def check_documents():
    try:
        supabase = database_service.admin_supabase
        
        # Check agent_documents table
        result = supabase.table("agent_documents").select("id,name,agent_id,layered_processing_complete,created_at").execute()
        
        print(f"📄 Found {len(result.data)} documents in agent_documents table:")
        
        if result.data:
            for doc in result.data[:5]:  # Show first 5
                print(f"  - {doc['name']} (ID: {doc['id'][:8]}..., Agent: {doc.get('agent_id', 'N/A')[:8]}..., Processed: {doc.get('layered_processing_complete', False)})")
        else:
            print("  → No documents found!")
            
        # Also check user_agents table to see if there are any agents
        agents_result = supabase.table("user_agents").select("id,name").limit(5).execute()
        print(f"\n👤 Found {len(agents_result.data)} agents:")
        for agent in agents_result.data:
            print(f"  - {agent['name']} (ID: {agent['id'][:8]}...)")
            
    except Exception as e:
        print(f"❌ Error checking documents: {e}")

if __name__ == "__main__":
    check_documents()