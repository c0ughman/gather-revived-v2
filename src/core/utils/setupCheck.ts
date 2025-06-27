/**
 * Setup verification utility to check if all required configurations are in place
 */

export interface SetupCheckResult {
  isReady: boolean;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    required: boolean;
  }[];
  summary: string;
}

export function checkNotionIntegrationSetup(): SetupCheckResult {
  const checks: SetupCheckResult['checks'] = [];
  
  // Check Supabase configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  checks.push({
    name: 'Supabase URL',
    status: supabaseUrl ? 'pass' : 'fail',
    message: supabaseUrl 
      ? `✅ Configured: ${supabaseUrl}` 
      : '❌ Missing VITE_SUPABASE_URL environment variable',
    required: true
  });
  
  checks.push({
    name: 'Supabase Anonymous Key',
    status: supabaseAnonKey ? 'pass' : 'fail',
    message: supabaseAnonKey 
      ? `✅ Configured (${supabaseAnonKey.length} characters)` 
      : '❌ Missing VITE_SUPABASE_ANON_KEY environment variable',
    required: true
  });
  
  // Check Notion OAuth configuration
  const notionClientId = import.meta.env.VITE_NOTION_CLIENT_ID;
  const notionClientSecret = import.meta.env.VITE_NOTION_CLIENT_SECRET;
  
  checks.push({
    name: 'Notion Client ID',
    status: notionClientId ? 'pass' : 'fail',
    message: notionClientId 
      ? `✅ Configured: ${notionClientId}` 
      : '❌ Missing VITE_NOTION_CLIENT_ID environment variable',
    required: true
  });
  
  checks.push({
    name: 'Notion Client Secret',
    status: notionClientSecret ? 'pass' : 'fail',
    message: notionClientSecret 
      ? `✅ Configured (${notionClientSecret.length} characters)` 
      : '❌ Missing VITE_NOTION_CLIENT_SECRET environment variable',
    required: true
  });
  
  // Check OAuth tokens table (simulate check - would need actual DB connection)
  checks.push({
    name: 'OAuth Tokens Table',
    status: 'warning',
    message: '⚠️ Please verify the oauth_tokens table exists in Supabase (see SUPABASE_NOTION_SETUP.md)',
    required: true
  });
  
  // Check Supabase Edge Function
  checks.push({
    name: 'Notion OAuth Edge Function',
    status: 'warning',
    message: '⚠️ Please verify the notion-oauth Edge Function is deployed (see SUPABASE_NOTION_SETUP.md)',
    required: true
  });
  
  // Check optional configurations
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  checks.push({
    name: 'Gemini API Key',
    status: geminiApiKey ? 'pass' : 'warning',
    message: geminiApiKey 
      ? '✅ Configured for AI features' 
      : '⚠️ Optional: Add VITE_GEMINI_API_KEY for AI features',
    required: false
  });
  
  // Calculate overall status
  const requiredChecks = checks.filter(c => c.required);
  const passedRequired = requiredChecks.filter(c => c.status === 'pass').length;
  const failedRequired = requiredChecks.filter(c => c.status === 'fail').length;
  
  const isReady = failedRequired === 0;
  
  let summary: string;
  if (isReady) {
    summary = `🎉 Setup complete! ${passedRequired}/${requiredChecks.length} required checks passed.`;
  } else {
    summary = `❌ Setup incomplete: ${failedRequired} required configuration(s) missing.`;
  }
  
  return {
    isReady,
    checks,
    summary
  };
}

/**
 * Display setup check results in the console
 */
export function logSetupCheck(): SetupCheckResult {
  const result = checkNotionIntegrationSetup();
  
  console.group('🔧 Notion Integration Setup Check');
  console.log(result.summary);
  console.log('');
  
  result.checks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    const required = check.required ? '(Required)' : '(Optional)';
    console.log(`${icon} ${check.name} ${required}`);
    console.log(`   ${check.message}`);
  });
  
  if (!result.isReady) {
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Create a .env file in your project root');
    console.log('2. Add the missing environment variables');
    console.log('3. Follow the SUPABASE_NOTION_SETUP.md guide');
    console.log('4. Restart your development server');
  }
  
  console.groupEnd();
  
  return result;
}

/**
 * Check if user has completed OAuth flow
 */
export function checkNotionConnection(userId: string): {
  isConnected: boolean;
  hasAuthCode: boolean;
  message: string;
} {
  const connectionKey = `oauth_connected_notion_${userId}`;
  const authKey = `oauth_auth_notion_${userId}`;
  
  const isConnected = localStorage.getItem(connectionKey) === 'true';
  const authData = localStorage.getItem(authKey);
  const hasAuthCode = !!authData;
  
  let message: string;
  if (isConnected && hasAuthCode) {
    message = '✅ Notion is connected and ready to use';
  } else if (hasAuthCode) {
    message = '⚠️ OAuth authorization received but connection not verified';
  } else {
    message = '❌ Notion not connected. Please use OAuth Connect button.';
  }
  
  return {
    isConnected,
    hasAuthCode,
    message
  };
} 