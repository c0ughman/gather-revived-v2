/**
 * Test script to debug the document upload flow
 * Open browser console and paste this to test manually
 */

console.log("🧪 Testing Document Upload Flow");

// Mock a document like the ones created by pythonApiService.processDocument
const testDocument = {
  id: `test-${Date.now()}`,
  name: "test-document.txt",
  type: "text/plain", 
  size: 150,
  uploadedAt: new Date(),
  content: "This is test content for debugging layered document processing.",
  extractedText: "This is test content for debugging layered document processing.",
  summary: "Test document for debugging",
  metadata: {}
};

// Mock agent ID (you'll need to replace this with a real agent ID)
const testAgentId = "test-agent-id";

async function testDocumentSave() {
  console.log("1. Testing document save to backend...");
  
  try {
    // Get auth token (same method as in documentApiService)
    function getAuthToken() {
      try {
        const supabaseAuth = localStorage.getItem('sb-lixfceaaekvltvroqxqj-auth-token');
        if (supabaseAuth) {
          const authData = JSON.parse(supabaseAuth);
          if (authData?.access_token) {
            return authData.access_token;
          }
        }
        return '';
      } catch (error) {
        console.warn('Error getting auth token:', error);
        return '';
      }
    }
    
    const authToken = getAuthToken();
    console.log(`🔐 Auth token available: ${authToken ? 'YES' : 'NO'} (${authToken.length} chars)`);
    
    if (!authToken) {
      console.error("❌ No auth token found. Are you logged in?");
      return;
    }
    
    const documentData = {
      name: testDocument.name,
      type: testDocument.type,
      size: testDocument.size,
      content: testDocument.content,
      summary: testDocument.summary,
      extractedText: testDocument.extractedText,
      metadata: testDocument.metadata || {}
    };
    
    console.log("📤 Sending document to backend:", documentData);
    
    const response = await fetch(`http://localhost:8000/api/v1/database/agents/${testAgentId}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(documentData)
    });
    
    console.log(`📥 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Request failed: ${response.status} - ${errorText}`);
      return;
    }
    
    const result = await response.json();
    console.log("✅ Document save successful:", result);
    
    // Wait a bit then check if layered processing happened
    setTimeout(async () => {
      console.log("2. Checking if layered processing occurred...");
      await checkLayeredProcessing(result.document_id || result.id);
    }, 3000);
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

async function checkLayeredProcessing(documentId) {
  console.log(`🔍 Checking layered processing for document: ${documentId}`);
  
  // You'd need to check the database directly or via another API
  // For now, just log that we would check
  console.log("⚠️ To check layered processing, run:");
  console.log(`   python3 check-documents.py`);
  console.log("   Look for layered_processing_complete = True");
}

// Instructions
console.log(`
🔧 INSTRUCTIONS:
1. Make sure you're logged into the app
2. Open browser developer console  
3. Replace 'test-agent-id' with a real agent ID from your app
4. Run: testDocumentSave()
5. Check console for results
6. Check database with: python3 check-documents.py

To get a real agent ID:
- Go to your agent settings
- Check the browser network tab for API calls
- Look for agent_id in the URLs
`);

// Auto-run if you want (comment out if testing manually)
// testDocumentSave();