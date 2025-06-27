# Notion Integration Guide

## Overview
The Notion integration provides seamless AI-powered control over your Notion workspace through natural language commands. It supports both chat and voice interactions, allowing you to create, read, update, and manage your Notion content effortlessly.

## 🚀 Function Calling Capabilities

### 📄 Page Operations

#### **Search Pages**
```
"Find pages about project alpha"
"Search for meeting notes"
"Show me all my pages"
```
- Searches through all pages in your workspace
- Supports fuzzy search using Notion's search API
- Returns page titles, URLs, and metadata

#### **Get Page Content**
```
"Show me the content of my latest journal entry"
"What's in the project planning page?"
"Read the content from page [ID]"
```
- Retrieves full page content including text, headings, lists
- Extracts formatted content as readable text
- Supports all major block types

#### **Create Page**
```
"Create a new meeting notes page in my work folder"
"Make a page called 'Daily Standup' with today's agenda"
"Create a project page with task list"
```
- Creates new pages with custom titles
- Adds initial content if provided
- Requires parent page/folder ID
- Supports rich content formatting

#### **Update Page**
```
"Update the status of my project page to completed"
"Change the priority of task page to high"
"Update page properties for [page name]"
```
- Updates page properties and metadata
- Modifies custom properties in databases
- Changes page attributes dynamically

#### **Append Content**
```
"Add these notes to my meeting page: [content]"
"Append today's progress to the project log"
"Add a new section to my journal"
```
- Adds new content to existing pages
- Supports formatted text (headings, lists, paragraphs)
- Preserves existing content and structure

### 🗄️ Database Operations

#### **Search Databases**
```
"Find my task database"
"Show me all databases about customers"
"List my project tracking databases"
```
- Searches through all databases in workspace
- Returns database structure and properties
- Shows available fields and types

#### **Query Database**
```
"Show me incomplete tasks from my project database"
"Find all customers with status 'active'"
"Get entries from last week in my time tracking database"
```
- Filters database entries by criteria
- Supports complex filters and sorting
- Returns structured data with properties

#### **Create Database Entry**
```
"Add a new task: Fix login bug, priority high, due tomorrow"
"Create customer entry: John Doe, email john@company.com"
"Add project: Website redesign, status in progress"
```
- Creates new entries in existing databases
- Auto-maps properties from natural language
- Validates required fields

## 🔧 Setup Requirements

### 1. Environment Variables
```env
VITE_NOTION_CLIENT_ID=your_notion_client_id
VITE_NOTION_CLIENT_SECRET=your_notion_client_secret
```

### 2. Notion Integration Setup
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the Client ID and Client Secret
4. Set up OAuth redirect URI: `https://yourdomain.com/oauth/callback/notion`

### 3. Integration Configuration
- **Notion (OAuth) Source**: For reading pages and databases
- **Notion Actions (OAuth)**: For creating and updating content
- Enable both for full functionality

## 💬 Example Commands

### Voice Commands
- "Hey, create a new page for today's meeting"
- "Show me my task list from the project database"
- "Add these notes to my journal page"
- "Find pages about the marketing campaign"
- "Update the project status to completed"

### Chat Commands
- Create a meeting notes page with agenda items
- Search for pages containing "budget planning"
- Add a new task to my project database: UI redesign
- Show me incomplete items from my todo database
- Append today's progress notes to the project page

## 🔍 Search Capabilities

### Page Search
- **Title matching**: Finds pages by title keywords
- **Content search**: Searches within page content  
- **Date filtering**: Recently edited or created pages
- **Property search**: Finds pages by custom properties

### Database Search
- **Database discovery**: Finds databases by name
- **Schema exploration**: Shows database structure
- **Entry filtering**: Searches database contents
- **Property matching**: Filters by field values

## 📝 Content Formatting

### Supported Block Types
- **Paragraphs**: Regular text content
- **Headings**: H1, H2, H3 with `#`, `##`, `###`
- **Lists**: Bullet points with `•` or `-`
- **Numbered lists**: Automatic numbering with `1.`
- **Rich text**: Basic text formatting

### Content Processing
- Automatically converts plain text to Notion blocks
- Preserves formatting from markdown-style input
- Handles multi-line content and structure
- Maintains text hierarchy and organization

## 🔐 Security & Permissions

### OAuth Scope
- Read access to pages and databases
- Write access for content creation
- Update permissions for modifications
- Respects Notion workspace permissions

### Data Handling
- Secure OAuth token storage
- Encrypted communication with Notion API
- User-specific workspace access
- Automatic token refresh

## 🚨 Error Handling

### Common Issues
- **Not Connected**: OAuth token missing or expired
- **Permission Denied**: Insufficient workspace access
- **Page Not Found**: Invalid page or database ID
- **Rate Limiting**: Too many API requests

### Solutions
- Reconnect Notion integration in settings
- Check workspace admin permissions
- Verify page/database sharing settings
- Wait and retry for rate limit recovery

## 🎯 Best Practices

### For Voice Commands
- Be specific about page/database names
- Include context for disambiguation
- Use natural language descriptions
- Specify parent locations for new pages

### For Chat Commands  
- Provide clear operation intent
- Include necessary IDs when available
- Use descriptive titles and content
- Structure complex data clearly

### Performance Tips
- Search results limited to 10-20 items
- Large content operations may take time
- Batch multiple operations when possible
- Use specific queries for better results

## 🔄 Integration Workflow

1. **Connect**: OAuth authentication with Notion
2. **Configure**: Set up source and action integrations  
3. **Discover**: Search and explore workspace content
4. **Interact**: Create, read, update through natural language
5. **Manage**: Ongoing content management and updates

## 📊 Monitoring & Debugging

### Console Logs
- Function call execution details
- API request/response logging
- Error messages and stack traces
- Performance timing information

### Success Indicators
- "✅ Notion operation successful"
- Returned data with operation results
- Updated content in Notion workspace
- Confirmation messages to user

The Notion integration transforms your workspace into an AI-controlled knowledge base, enabling seamless content management through natural conversation! 