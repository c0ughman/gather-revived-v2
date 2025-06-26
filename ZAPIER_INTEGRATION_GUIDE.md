# 🔗 Zapier Integration Guide for Gather

## Overview
The Zapier integration allows you to trigger Zaps (automated workflows) using natural language commands through your AI agents. Connect to 5000+ apps and services through Zapier's powerful automation platform.

## How It Works

### 1. **Natural Language Activation**
Simply tell your AI agent what you want to automate:
- "Send this to Slack"
- "Add this customer to my CRM"
- "Create a calendar event"
- "Start my marketing workflow"
- "Post this update to social media"

### 2. **Zapier Integration**
Your AI agent triggers the appropriate Zap based on:
- **Description**: What you tell the AI the Zap does
- **Keywords**: Optional trigger words for precise matching
- **Context**: Understanding the intent behind your request

### 3. **Automatic Execution**
The Zap runs automatically in Zapier, connecting to your apps and performing the actions you've configured.

## Setup Instructions

### Step 1: Create a Zap in Zapier
1. Go to [Zapier.com](https://zapier.com) and sign in
2. Click **"Create Zap"**
3. Choose **"Webhooks by Zapier"** as your trigger
4. Select **"Catch Hook"** as the trigger event
5. Copy the webhook URL provided by Zapier
6. Set up your action steps (what the Zap should do)
7. Test and publish your Zap

### Step 2: Add Zapier Integration in Gather
1. Go to **Settings** → **Integrations**
2. Find **"Zapier Webhook"** in the Action Integrations
3. Click **"Add Integration"**

### Step 3: Configure the Integration

#### Required Fields:
- **Zapier Webhook URL**: Paste the webhook URL from Step 1
- **Zap Name**: Give your Zap a descriptive name
  ```
  Example: "Slack Team Notifications"
  ```
- **What does this Zap do?**: Describe the automation in natural language
  ```
  Example: "Send notifications to the team Slack channel when important updates or announcements need to be shared"
  ```

#### Optional Fields:
- **Data to Send**: JSON payload with dynamic variables
  ```json
  {
    "message": "{{user_message}}",
    "timestamp": "{{timestamp}}",
    "source": "AI Assistant",
    "contact": "{{contact_name}}",
    "priority": "normal"
  }
  ```

- **Success Message**: What to show when the Zap triggers
  ```
  "Message sent to Slack successfully!"
  ```

- **Trigger Keywords**: Comma-separated keywords for better matching
  ```
  "slack, notify, team, announce, share"
  ```

### Step 4: Test Your Integration
1. Save the integration
2. Start a conversation with your AI agent
3. Say something like: "Send a message to the team about our new feature"
4. Check that your Zap triggered in Zapier
5. Verify the action completed in your connected app

## Popular Zap Examples

### 1. Slack Notifications
**Setup in Zapier:**
- Trigger: Webhook
- Action: Send message to Slack channel

**Configuration in Gather:**
- Zap Name: "Team Slack Notifications"
- Description: "Send important updates and announcements to the team Slack channel"
- Keywords: "slack, notify, team, announce"

**Usage:**
- "Send a message to the team about the new product launch"
- "Notify everyone about tomorrow's meeting"

### 2. CRM Lead Management
**Setup in Zapier:**
- Trigger: Webhook
- Action: Create contact in HubSpot/Salesforce

**Configuration in Gather:**
- Zap Name: "New Lead to CRM"
- Description: "Add new customer leads and contact information to our CRM system"
- Keywords: "crm, lead, customer, contact, add"

**Usage:**
- "Add this new customer to our CRM: John Doe, john@company.com"
- "Create a lead for the prospect I just spoke with"

### 3. Calendar Event Creation
**Setup in Zapier:**
- Trigger: Webhook
- Action: Create Google Calendar event

**Configuration in Gather:**
- Zap Name: "Schedule Calendar Events"
- Description: "Create calendar events and schedule meetings automatically"
- Keywords: "calendar, schedule, meeting, event, appointment"

**Usage:**
- "Schedule a meeting with the client for next Tuesday at 2 PM"
- "Create a calendar event for the product demo"

### 4. Email Marketing Automation
**Setup in Zapier:**
- Trigger: Webhook
- Action: Add subscriber to Mailchimp/ConvertKit

**Configuration in Gather:**
- Zap Name: "Email List Management"
- Description: "Add new subscribers to email marketing campaigns and lists"
- Keywords: "email, subscribe, newsletter, marketing, list"

**Usage:**
- "Add this email to our newsletter: jane@example.com"
- "Subscribe this customer to our product updates"

### 5. Social Media Posting
**Setup in Zapier:**
- Trigger: Webhook
- Action: Post to Twitter/LinkedIn/Facebook

**Configuration in Gather:**
- Zap Name: "Social Media Updates"
- Description: "Post updates and announcements to social media platforms"
- Keywords: "social, post, twitter, linkedin, share"

**Usage:**
- "Post this update to our social media: We just launched our new feature!"
- "Share this announcement on LinkedIn"

### 6. Project Management
**Setup in Zapier:**
- Trigger: Webhook
- Action: Create task in Asana/Trello/Monday.com

**Configuration in Gather:**
- Zap Name: "Task Creation"
- Description: "Create tasks and assignments in project management tools"
- Keywords: "task, project, assign, todo, create"

**Usage:**
- "Create a task to review the new design mockups"
- "Assign this bug fix to the development team"

## Advanced Configuration

### Dynamic Variables
Use these variables in your JSON payload:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{timestamp}}` | Current ISO timestamp | `2024-01-15T10:30:00.000Z` |
| `{{user_message}}` | Your exact request | `"send team update about launch"` |
| `{{contact_name}}` | AI agent name | `"Marketing Assistant"` |

### Custom Payload Example
```json
{
  "trigger_source": "ai_assistant",
  "timestamp": "{{timestamp}}",
  "user_request": "{{user_message}}",
  "agent_name": "{{contact_name}}",
  "priority": "normal",
  "category": "team_communication",
  "metadata": {
    "platform": "gather",
    "version": "1.0"
  }
}
```

### Multiple Zaps per Agent
You can add multiple Zapier integrations to one AI agent:
- Marketing automation Zap
- CRM management Zap  
- Calendar scheduling Zap
- Social media posting Zap

The AI will automatically choose the best Zap based on your request.

## Troubleshooting

### Common Issues:

1. **Zap not triggering**: 
   - Check the webhook URL is correct
   - Verify the Zap is published and turned on
   - Test the webhook directly in Zapier

2. **Wrong Zap triggered**: 
   - Refine your description to be more specific
   - Add relevant keywords
   - Make descriptions distinct between different Zaps

3. **Data not passing correctly**: 
   - Check your JSON payload syntax
   - Verify variable names match what your Zap expects
   - Test with simple data first

4. **Authentication errors**: 
   - Ensure connected apps in Zapier are properly authenticated
   - Check that app permissions are sufficient

### Testing Tips:
- Start with simple Zaps (like sending to Slack)
- Use Zapier's task history to debug issues
- Test webhook URLs directly before adding to Gather
- Keep descriptions clear and specific

## Best Practices

### Writing Good Descriptions:
- Be specific about what the Zap does
- Include the target app/service name
- Mention the type of action (send, create, update, etc.)
- Use business context the AI can understand

### Choosing Keywords:
- Include action words (send, create, add, post, schedule)
- Add app names (slack, gmail, calendar, crm)
- Include domain-specific terms
- Add synonyms for better matching

### Natural Commands:
- Speak naturally: "Please send this to the team"
- Use variations: "Post this update", "Share this news", "Announce this"
- Be conversational: "Can you add this customer to our system?"

## Security Notes

- Webhook URLs should be kept secure
- Only share Zaps that you want the AI to access
- Review Zapier task history regularly
- Use Zapier's built-in security features
- The AI can only trigger Zaps you explicitly configure

## Zapier Resources

- [Zapier Help Center](https://help.zapier.com/)
- [Webhook Documentation](https://zapier.com/help/create/code-webhooks/trigger-zaps-from-webhooks)
- [Zapier App Directory](https://zapier.com/apps)
- [Zapier Templates](https://zapier.com/explore)

## Success!

Once configured, you'll have powerful automation at your fingertips. Simply tell your AI agent what you want to accomplish, and it will trigger the appropriate Zapier workflow to get things done across all your connected apps!