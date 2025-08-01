# Voice Function Calling Debug Guide

## 🎤 **Testing Voice Web Search**

### **Step 1: Check Integration Detection**
1. Start a voice call with an agent that has web search enabled
2. Look for this log in console:
   ```
   🔍 Voice: Web search integration detected and enabled
   ```
   ✅ If you see this, the voice service knows about web search

### **Step 2: Check Function Declaration**
1. Look for this log:
   ```
   🔧 Tools configured: search_web, generate_document, [other tools]
   ```
   ✅ If `search_web` is in the list, the function is available

### **Step 3: Test Voice Triggers**
Try these exact phrases during the voice call:
- **"Search up latest AI news"**
- **"Look up information about quantum computing"** 
- **"Google this: latest tech trends"**
- **"Find current information about space exploration"**

### **Step 4: Check Function Call Detection**
When you say a search phrase, look for:
```
🔧 Voice: Received tool call: [object]
🔧 Voice: Function names: ["search_web"]
🔍 Voice web search requested: "[your query]"
```

### **Step 5: Expected Full Flow**
```
🔍 Voice: Web search integration detected and enabled
🔧 Tools configured: search_web, generate_document
🔧 Voice: Received tool call: {...}
🔧 Voice: Function names: ["search_web"] 
🔍 Voice web search requested: "latest AI news"
🔍 Voice search parameters: {query: "latest AI news", searchDepth: "basic", maxResults: 5}
🔍 Starting dynamic web search tool execution
🔑 API key check for tool: Found (tvly-ABC123...)
📤 Web search tool request body: {...}
✅ Web search tool successful!
🔍 Voice search result summary: {query: "latest AI news", answer_length: 156, results_count: 5, first_result_title: "..."}
🔍 Voice natural response: "According to recent sources, artificial intelligence developments include..."
📤 Voice: Sending tool response...
📤 Voice: Web search response 1: {success: true, content_length: 245, content_preview: "According to recent sources..."}
📤 Voice: Tool responses sent to Live API
```

**The AI should then speak the information naturally WITHOUT saying any technical terms!**

## 🚨 **Common Issues**

### **Issue 1: No "Voice: Web search integration detected"**
**Problem**: Voice service doesn't see web search integration  
**Solution**: Check that the agent has web search integration added and enabled

### **Issue 2: search_web not in tools list**
**Problem**: Function declaration not being added  
**Solution**: Check console logs for integration detection and contact details

### **Issue 3: No function calls detected**
**Problem**: AI doesn't understand when to use web search  
**Solution**: Try more explicit phrases like "Search the web for [topic]"

### **Issue 4: Function calls detected but no web search**
**Problem**: AI is calling other functions but not search_web  
**Solution**: Be more explicit about wanting current/real-time information

### **Issue 5: Web search returns wrong/irrelevant information**
**Problem**: Search works but results don't match the query  
**Debug Steps**:
1. Check `🔍 Voice search parameters` - is the query correct?
2. Check `🔍 Voice raw function args` - what did the AI extract?
3. Check `🔍 Voice search result summary` - are results relevant?
4. Check `📤 Voice: Web search response` - what data is sent to AI?
5. Run the debug script: Copy `debug-voice-search.js` content to console

**Common Causes**:
- AI misunderstood the voice input and created wrong query
- Search results are valid but AI interprets them incorrectly
- Query too vague or needs refinement

### **Issue 6: AI reads out "tool underscore output curly bracket" etc.**
**Problem**: AI reading technical data structures instead of speaking naturally  
**Solution**: ✅ **FIXED!** The response format has been updated to send natural conversational text
**What Changed**:
- Web search now sends clean, conversational text instead of structured data
- Added strict voice mode instructions to never read technical terms
- AI receives ready-to-speak content, not raw data structures

**Check**: Look for `🔍 Voice natural response:` in logs - this shows the clean text being sent to AI

## 🧪 **Test Commands**

**Most Direct Test**: *"Search the web for latest artificial intelligence news"*  
**Alternative**: *"Look up current events about technology"*  
**Explicit**: *"Use web search to find information about recent AI developments"*

## 📋 **What to Share**

If it's still not working, share these logs:
1. Integration detection logs (`🔍 Voice: Web search integration detected`)
2. Tools configuration logs (`🔧 Tools configured: search_web...`)
3. Function call logs (`🔧 Voice: Received tool call...`)
4. Search parameter logs (`🔍 Voice search parameters:`)
5. Search result logs (`🔍 Voice search result summary:`)
6. Natural response logs (`🔍 Voice natural response:`)
7. Response logs (`📤 Voice: Web search response 1:`)
8. Any error messages

**For "wrong information" issues, also share:**
- What you asked for vs. what information you received
- The exact phrase you said during the voice call
- The `🔍 Voice raw function args` log (shows what the AI extracted)

**For "reading technical stuff" issues:**
- Should be fixed now! Look for `🔍 Voice natural response:` in logs
- If AI still reads technical terms, share the exact words it's saying

This will help identify exactly where the issue is! 🔍🎤 