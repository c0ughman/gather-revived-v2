#!/usr/bin/env python3
"""
Debug script for layered document processing
Run this to test if the processing pipeline is working
"""

import asyncio
import httpx
import json
import os
import sys
import logging
from datetime import datetime

# Add the backend to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from backend.app.services.layered_document_service import layered_document_service
    from backend.app.services.database_service import database_service
    from backend.app.services.ai_service import ai_service
    BACKEND_AVAILABLE = True
    print("✅ Backend services imported successfully")
except ImportError as e:
    print(f"❌ Failed to import backend services: {e}")
    BACKEND_AVAILABLE = False

async def test_ai_service():
    """Test if AI service can generate text"""
    print("\n🤖 Testing AI Service...")
    
    try:
        if not BACKEND_AVAILABLE:
            print("❌ Backend not available for AI testing")
            return False
            
        test_prompt = "Summarize this in one sentence: This is a test document about layered processing."
        
        response = await ai_service.generate_text(
            prompt=test_prompt,
            max_tokens=50,
            temperature=0.3
        )
        
        print(f"✅ AI Service working: {response[:100]}...")
        return True
        
    except Exception as e:
        print(f"❌ AI Service failed: {e}")
        return False

async def test_database_connection():
    """Test database connection and check for layered columns"""
    print("\n🗄️ Testing Database Connection...")
    
    try:
        if not BACKEND_AVAILABLE:
            print("❌ Backend not available for database testing")
            return False
            
        # Try to query agent_documents table
        supabase = database_service.admin_supabase
        
        # Get table info to check if layered columns exist
        result = supabase.table("agent_documents").select("*").limit(1).execute()
        
        if result.data:
            doc = result.data[0]
            layered_columns = [
                'layer1_summary', 'layer1_word_bank', 'layer2_summary', 
                'layer3_full_text', 'layered_processing_complete', 'estimated_tokens'
            ]
            
            missing_columns = []
            for col in layered_columns:
                if col not in doc:
                    missing_columns.append(col)
            
            if missing_columns:
                print(f"❌ Missing columns in database: {missing_columns}")
                print("   → Run the SQL migration to add layered columns")
                return False
            else:
                print("✅ All layered columns exist in database")
                return True
        else:
            print("⚠️ No documents found in database to check columns")
            return True
            
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

async def test_document_processing(document_id=None):
    """Test processing a specific document"""
    print(f"\n📄 Testing Document Processing...")
    
    try:
        if not BACKEND_AVAILABLE:
            print("❌ Backend not available for document processing")
            return False
            
        # If no document_id provided, find one
        if not document_id:
            supabase = database_service.admin_supabase
            result = supabase.table("agent_documents").select("id,name").limit(1).execute()
            
            if not result.data:
                print("❌ No documents found in database to test with")
                return False
                
            document_id = result.data[0]['id']
            document_name = result.data[0]['name']
            print(f"📄 Testing with document: {document_name} ({document_id})")
        
        # Test the layered processing
        result = await layered_document_service.process_document_layers(document_id)
        
        print(f"✅ Document processing result: {result}")
        return result.get('status') == 'success'
        
    except Exception as e:
        print(f"❌ Document processing failed: {e}")
        import traceback
        print(f"Full error: {traceback.format_exc()}")
        return False

async def check_backend_logs():
    """Check for backend processing logs"""
    print("\n📋 Checking Backend Status...")
    
    try:
        # Test health endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8000/health")
            if response.status_code == 200:
                print("✅ Backend health check passed")
            else:
                print(f"❌ Backend health check failed: {response.status_code}")
                return False
                
            # Test generate-text endpoint (without auth - just to see if it exists)
            response = await client.post(
                "http://localhost:8000/api/v1/ai/generate-text",
                json={"prompt": "test"}
            )
            
            if response.status_code == 401:  # Not authenticated is expected
                print("✅ Generate-text endpoint exists (auth required)")
                return True
            elif response.status_code == 404:
                print("❌ Generate-text endpoint not found - backend not updated")
                return False
            else:
                print(f"⚠️ Generate-text endpoint responded with: {response.status_code}")
                return True
                
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        return False

async def main():
    """Run all diagnostic tests"""
    print("🔍 LAYERED DOCUMENT PROCESSING DIAGNOSTICS")
    print("=" * 50)
    
    # Run all tests
    tests = [
        ("Backend Connection", check_backend_logs),
        ("Database Connection", test_database_connection),
        ("AI Service", test_ai_service),
        ("Document Processing", test_document_processing)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            results[test_name] = await test_func()
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 DIAGNOSTIC SUMMARY")
    print("=" * 50)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    # Recommendations
    failed_tests = [name for name, passed in results.items() if not passed]
    
    if failed_tests:
        print(f"\n🔧 RECOMMENDATIONS:")
        if "Backend Connection" in failed_tests:
            print("- Ensure Python backend is running: cd backend && python -m uvicorn app.main:app --reload")
        if "Database Connection" in failed_tests:
            print("- Apply database migration: Run the SQL snippet in Supabase")
        if "AI Service" in failed_tests:
            print("- Check Google API key configuration")
        if "Document Processing" in failed_tests:
            print("- Check backend logs for detailed error messages")
    else:
        print(f"\n🎉 ALL TESTS PASSED - Layered processing should be working!")
        print("   If documents still aren't processing, check:")
        print("   1. Backend logs for processing attempts")
        print("   2. Database for documents with layered_processing_complete = false")
        
    return len(failed_tests) == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)