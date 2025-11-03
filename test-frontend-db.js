/**
 * Test what the FRONTEND sees in the database
 * Copy/paste this into browser console while on your app
 */

console.log("🔍 TESTING FRONTEND DATABASE ACCESS");

// Test if supabase is available globally
if (typeof window !== 'undefined' && window.supabase) {
  console.log("✅ Supabase found on window object");
  testWithWindowSupabase();
} else {
  console.log("⚠️ No global supabase - testing with manual connection");
  testWithManualConnection();
}

async function testWithWindowSupabase() {
  try {
    console.log("📡 Testing with window.supabase...");
    
    const result = await window.supabase
      .from('user_agents')
      .select('id,name,user_id')
      .limit(5);
    
    console.log("✅ Frontend query result:", result);
    console.log(`📊 Found ${result.data?.length || 0} agents`);
    
    if (result.data && result.data.length > 0) {
      console.log("🎯 Sample agent:", result.data[0]);
      
      // Test documents for this agent
      const agentId = result.data[0].id;
      console.log(`📄 Checking documents for agent: ${agentId}`);
      
      const docsResult = await window.supabase
        .from('agent_documents')
        .select('*')
        .eq('agent_id', agentId);
      
      console.log(`📊 Found ${docsResult.data?.length || 0} documents for this agent`);
      
      return { agents: result.data.length, documents: docsResult.data?.length || 0 };
    }
    
    return { agents: 0, documents: 0 };
    
  } catch (error) {
    console.error("❌ Frontend query failed:", error);
    return null;
  }
}

async function testWithManualConnection() {
  console.log("📡 Testing with manual Supabase connection...");
  
  // Check if we can access env vars
  const supabaseUrl = 'https://lixfceaaekvltvroqxqj.supabase.co'; // from your config
  console.log(`🔗 Using URL: ${supabaseUrl}`);
  
  // Get auth token from localStorage
  const authToken = getAuthToken();
  console.log(`🔐 Auth token available: ${authToken ? 'YES' : 'NO'} (${authToken?.length || 0} chars)`);
  
  if (!authToken) {
    console.log("❌ No auth token - you might not be logged in");
    console.log("🔧 Make sure you're logged into the app first");
    return null;
  }
  
  // Test direct API call
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/user_agents?select=id,name,user_id&limit=5`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeGZjZWFhZWt2bHR2cm9xeHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NTIwNTEsImV4cCI6MjA2NjQyODA1MX0.skdpRL6lteP1QkG9IZ3NaaOCmIFskmSulZ4Pq2DkBfM',
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Direct API query successful:", data);
      console.log(`📊 Found ${data.length} agents via direct API`);
      return { agents: data.length, documents: 0 };
    } else {
      console.error(`❌ Direct API query failed: ${response.status}`);
      const errorText = await response.text();
      console.error("Error details:", errorText);
      return null;
    }
    
  } catch (error) {
    console.error("❌ Direct API query error:", error);
    return null;
  }
}

function getAuthToken() {
  try {
    const supabaseAuth = localStorage.getItem('sb-lixfceaaekvltvroqxqj-auth-token');
    if (supabaseAuth) {
      const authData = JSON.parse(supabaseAuth);
      return authData?.access_token || null;
    }
    return null;
  } catch (error) {
    console.warn('Error getting auth token:', error);
    return null;
  }
}

// Auto-run the test
setTimeout(() => {
  console.log("\n🔧 INSTRUCTIONS:");
  console.log("1. Open your app in the browser");
  console.log("2. Make sure you're logged in");
  console.log("3. Open browser console (F12)");
  console.log("4. Copy and paste this entire script");
  console.log("5. Check the results");
  console.log("\n💡 This will tell us if the frontend can see your agents");
}, 100);