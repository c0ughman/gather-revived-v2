#!/usr/bin/env python3
"""
Diagnose document upload issues
"""
import sys
import asyncio
import httpx
sys.path.append('backend')

from backend.app.services.database_service import database_service

async def main():
    print("🔍 DIAGNOSING DOCUMENT UPLOAD ISSUES\n")
    
    # 1. Check if we have any agents in the database
    print("1. Checking for agents in database...")
    try:
        supabase = database_service.admin_supabase
        agents_result = supabase.table("user_agents").select("id,name,user_id").execute()
        
        if not agents_result.data:
            print("❌ NO AGENTS FOUND IN DATABASE")
            print("   This is the problem! You need to create an agent first.")
            print("   The document upload requires a valid agent ID.")
            print("\n🔧 SOLUTION:")
            print("   1. Create an AI agent in the app")
            print("   2. This will create an entry in user_agents table")
            print("   3. Then document uploads will work")
            return False
        else:
            print(f"✅ Found {len(agents_result.data)} agents:")
            for agent in agents_result.data:
                print(f"   - {agent['name']} (ID: {agent['id'][:8]}..., User: {agent.get('user_id', 'N/A')[:8]}...)")
                
    except Exception as e:
        print(f"❌ Error checking agents: {e}")
        return False
    
    # 2. Check if we have any users
    print("\n2. Checking for users in database...")
    try:
        users_result = supabase.table("user_profiles").select("id,display_name").limit(5).execute()
        print(f"✅ Found {len(users_result.data)} users:")
        for user in users_result.data:
            print(f"   - {user.get('display_name', 'Unknown')} (ID: {user['id'][:8]}...)")
    except Exception as e:
        print(f"❌ Error checking users: {e}")
    
    # 3. Test the save document endpoint with a real agent
    if agents_result.data:
        print("\n3. Testing document save with real agent...")
        test_agent_id = agents_result.data[0]['id']
        
        # Create test document data
        test_doc_data = {
            "name": "diagnostic-test.txt",
            "type": "text/plain", 
            "size": 100,
            "content": "This is a test document for diagnosing upload issues.",
            "summary": "Test document",
            "extractedText": "This is a test document for diagnosing upload issues.",
            "metadata": {}
        }
        
        try:
            print(f"📤 Testing with agent ID: {test_agent_id[:8]}...")
            
            # Use database service directly
            from backend.app.models.database import DocumentCreate
            doc_create = DocumentCreate(**test_doc_data)
            
            result = await database_service.create_agent_document(test_agent_id, doc_create)
            print(f"✅ Document save test SUCCESSFUL!")
            print(f"   Document ID: {result['id'][:8]}...")
            
            # Check if it triggered layered processing
            print("\n4. Checking if layered processing was triggered...")
            await asyncio.sleep(2)  # Wait a moment
            
            doc_result = supabase.table("agent_documents").select("*").eq("id", result['id']).execute()
            if doc_result.data:
                doc = doc_result.data[0]
                processed = doc.get('layered_processing_complete', False)
                print(f"   Layered processing complete: {processed}")
                if doc.get('layer1_summary'):
                    print(f"   Layer 1 summary exists: YES")
                else:
                    print(f"   Layer 1 summary exists: NO")
            
            return True
            
        except Exception as e:
            print(f"❌ Document save test FAILED: {e}")
            import traceback
            print(f"Full error: {traceback.format_exc()}")
            return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(main())
    if success:
        print(f"\n🎉 DIAGNOSIS COMPLETE - Check results above")
    else:
        print(f"\n❌ DIAGNOSIS FOUND ISSUES - Follow the solutions above")