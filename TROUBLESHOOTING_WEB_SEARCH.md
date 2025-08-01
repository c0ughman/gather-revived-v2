# Web Search Integration Troubleshooting Guide

## 🔍 **Debug Steps**

### 1. **Check Browser Console**
Open your browser's developer tools (F12) and look for these debug messages:

- `🔍 Web Search Integration Debug:` - Shows if the integration is being filtered
- `🎯 Integration clicked:` - Shows when you click on the integration
- `🎯 Integration selected in SettingsScreen:` - Shows when integration is selected
- `💾 Saving integration config:` - Shows the configuration being saved
- `📦 Created integration instance:` - Shows the integration instance created
- `🔄 Settings integrations changed:` - Shows when integrations list changes
- `💾 Saving contact with integrations:` - Shows when contact is being saved
- `🔑 Checking Tavily API key:` - Shows if API key is found

### 2. **Environment Variable Check**
Make sure your `.env` file contains:
```bash
VITE_TAVILY_API_KEY=tvly-your-actual-api-key-here
```

### 3. **Integration List Check**
The web search integration should appear in the integrations library with:
- **ID**: `web-search`
- **Name**: `Web Search (Tavily)`
- **Category**: `source`

### 4. **Common Issues & Solutions**

#### **Issue: Integration not appearing in list**
**Solution**: Check if the integration is properly exported in `allIntegrations`

#### **Issue: Integration appears but can't be selected**
**Solution**: Check browser console for any JavaScript errors

#### **Issue: Integration saves but doesn't persist**
**Solution**: Check if there are database connection issues

#### **Issue: API key not found error**
**Solution**: 
1. Verify `.env` file exists in project root
2. Restart development server after adding environment variable
3. Check that variable name is exactly `VITE_TAVILY_API_KEY`

### 5. **Test the Integration**

1. **Add to Agent**:
   - Go to Settings > Integrations
   - Click "Add Integration"
   - Find "Web Search (Tavily)"
   - Configure settings and save

2. **Test in Chat**:
   - Start a conversation with the agent
   - Say: "search up latest AI news"
   - Should trigger web search

### 6. **Manual Test**
Run the debug script to test the integration:
```bash
node test-integration-debug.js
```

### 7. **Database Check**
If integrations aren't saving, check:
- Supabase connection
- Database permissions
- Console errors during save

### 8. **Reset and Retry**
If all else fails:
1. Clear browser cache
2. Restart development server
3. Try adding integration again

## 🚨 **Emergency Fixes**

### **If integration still doesn't work:**
1. Check browser console for errors
2. Verify environment variable is set
3. Try a different integration to see if the issue is specific to web search
4. Check if the integration appears in the list at all

### **If nothing appears in integrations list:**
1. Check if `allIntegrations` is properly exported
2. Verify no JavaScript errors in console
3. Check if other integrations appear

---

**Need more help?** Check the browser console logs and share any error messages you see! 