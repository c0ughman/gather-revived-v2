# 📊 Google Sheets Integration Guide for Gather

## 🚀 Quick Setup (User-Friendly)

### Step 1: Set Up Google Service Account (One-Time Setup)

1. **Create Google Cloud Project** (if you don't have one):
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Click "New Project" → Name it "Gather Sheets Integration"
   - Click "Create"

2. **Enable Google Sheets API**:
   - In your project, go to "APIs & Services" → "Library"
   - Search "Google Sheets API" → Click "Enable"

3. **Create Service Account**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name: `gather-sheets-service`
   - Click "Create" → Skip optional steps → "Done"

4. **Generate Service Account Key**:
   - Click on your new service account
   - Go to "Keys" tab → "Add Key" → "Create New Key"
   - Choose "JSON" → Download the file
   - Save this JSON file securely (you'll need it later)

5. **Add Environment Variable**:
   - Copy the entire contents of the JSON file
   - Add to your `.env` file:
   ```
   VITE_GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
   ```

### Step 2: Share Your Google Sheets

For each Google Sheet you want to use with Gather:
1. Open your Google Sheet
2. Click "Share" button (top right)
3. Add the service account email (found in your JSON file as `client_email`)
4. Set permission to "Editor" (for read/write) or "Viewer" (for read-only)
5. Click "Send"

### Step 3: Add Integration in Gather

1. Go to Settings → Integrations
2. Find "Google Sheets" → Click "Add"
3. Fill in:
   - **Google Sheet URL**: Paste your Google Sheets URL
   - **Integration Name**: Give it a descriptive name (e.g., "Customer Database")
   - **Description**: Describe what data is in the spreadsheet
   - **Access Level**: Choose "Read Only" or "Read & Write"
4. Click "Save"

### Step 4: Start Using!

You can now use natural language commands like:
- "Show me all data from my customer spreadsheet"
- "Add a new customer: John Doe, john@email.com, 555-1234"
- "Search for customers with 'Smith' in their name"
- "Update cell B5 to 'Completed'"

## 🔧 Integration Features

### Supported Operations

| Operation | Description | Access Level | Example Command |
|-----------|-------------|--------------|-----------------|
| **Read** | View spreadsheet data | Read-only / Read-write | "Show me the first 10 rows" |
| **Write** | Update specific cells/ranges | Read-write only | "Update cell A5 to 'New Value'" |
| **Append** | Add new rows to the sheet | Read-write only | "Add a new row: John, Doe, john@email.com" |
| **Search** | Find specific data | Read-only / Read-write | "Find all entries containing 'pending'" |
| **Info** | Get sheet metadata | Read-only / Read-write | "What columns are in my spreadsheet?" |
| **Clear** | Delete data from ranges | Read-write only | "Clear cells A1 to C10" |

### Natural Language Examples

#### Reading Data
- "Show me all customer data"
- "What's in row 5?"
- "Display the first 20 rows"
- "Show me columns A through E"

#### Adding Data
- "Add a new customer: Jane Smith, jane@email.com, 555-9876"
- "Insert a new row with: Product A, $29.99, In Stock"
- "Add this data to the spreadsheet: [customer info]"

#### Searching
- "Find all customers with 'gmail' in their email"
- "Search for 'pending' status"
- "Look for entries from 2024"
- "Find customers in California"

#### Updating
- "Update cell B5 to 'Completed'"
- "Change the status in row 10 to 'Active'"
- "Update the price in cell C3 to $49.99"

#### Getting Information
- "How many rows are in my spreadsheet?"
- "What columns do I have?"
- "Show me the sheet structure"

## 🎯 Use Cases

### 1. Customer Relationship Management (CRM)
```
Integration Name: Customer Database
Description: Customer contact information with names, emails, phone numbers, and order history
Access Level: Read & Write
Auto-sync: Never (manual updates only)

Example Commands:
- "Add new customer: John Doe, john@email.com, 555-1234"
- "Find all customers from last month"
- "Update John's status to 'Premium'"
```

### 2. Sales Pipeline Tracking
```
Integration Name: Sales Pipeline
Description: Sales opportunities with deal amounts, stages, and close dates
Access Level: Read Only (reporting only)
Auto-sync: On Chat Start

Example Commands:
- "Show me all deals in the pipeline"
- "What's our total pipeline value?"
- "Find deals closing this month"
```

### 3. Inventory Management
```
Integration Name: Product Inventory
Description: Product stock levels, SKUs, locations, and reorder points
Access Level: Read & Write
Auto-sync: Periodic (every 5 minutes)

Example Commands:
- "Check stock level for SKU-123"
- "Add new product: Widget Pro, SKU-456, 100 units"
- "Find all products with low stock"
```

### 4. Project Management
```
Integration Name: Task Tracker
Description: Project tasks with assignments, due dates, and status
Access Level: Read & Write
Auto-sync: Never

Example Commands:
- "Show me all overdue tasks"
- "Mark task in row 5 as completed"
- "Add new task: Review design, due Friday"
```

## ⚙️ Configuration Options

### Access Levels
- **Read Only**: AI can view and search data only
- **Read & Write**: AI can view, add, update, and delete data

### Auto-sync Options
- **Never**: Manual requests only
- **On Chat Start**: Sync when conversation begins
- **Periodic**: Sync every 5 minutes

### Sheet Selection
- Specify which tab/sheet to use by default
- Can override in commands: "Read from the Sales tab"

## 🔍 Troubleshooting

### Common Issues

#### 1. "Service account not configured" Error
**Solution**: Check that `VITE_GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY` is properly set in your `.env` file with the complete JSON content.

#### 2. "Permission denied" Error
**Solution**: 
- Ensure the service account email is shared on your Google Sheet
- Check that the permission level is correct (Editor for write access)
- Verify the Sheet ID in the URL is correct

#### 3. "Invalid Google Sheets URL" Error
**Solution**: 
- Use the full Google Sheets URL from your browser
- Format: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
- Make sure the sheet is not private/restricted

#### 4. "Write operations not allowed" Error
**Solution**: Change the access level from "Read Only" to "Read & Write" in the integration settings.

#### 5. Sheet Not Found Error
**Solution**: 
- Check the sheet/tab name is correct
- Default is usually "Sheet1"
- Make sure the tab exists in your spreadsheet

### Best Practices

1. **Descriptive Integration Names**: Use clear names like "Customer Database" instead of "Sheet1"

2. **Detailed Descriptions**: Help the AI understand your data by describing what's in each column

3. **Appropriate Access Levels**: Use read-only for reference data, read-write for operational data

4. **Regular Backups**: Keep backups of important spreadsheets before enabling write access

5. **Test Commands**: Start with simple read operations before trying complex updates

## 📝 Data Format Guidelines

### For Best Results:
- Use headers in the first row
- Keep data consistent within columns
- Avoid merged cells where possible
- Use clear, descriptive column names

### Example Good Structure:
```
A1: Name | B1: Email | C1: Phone | D1: Status | E1: Notes
A2: John Doe | B2: john@email.com | C2: 555-1234 | D2: Active | E2: Premium customer
```

## 🔐 Security Notes

- Service account credentials should be kept secure
- Only share sheets that you want the AI to access
- Use read-only access when possible
- Review permissions regularly
- The AI can only access sheets explicitly shared with the service account

## 🆘 Need Help?

If you encounter issues:
1. Check the console for detailed error messages
2. Verify your service account setup
3. Confirm sheet sharing permissions
4. Try simpler commands first
5. Check that your .env file is properly configured

## 🎉 Success!

Once set up, you'll have a powerful natural language interface to your Google Sheets data. The AI can help you manage, analyze, and update your spreadsheets using simple conversational commands! 