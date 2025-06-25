# Webhook Integration Guide

## Overview
The webhook integration allows you to trigger custom POST requests with natural language commands. This is perfect for activating marketing workflows, onboarding sequences, notifications, and any automation through services like Zapier, Make.com, or custom APIs.

## How It Works

### 1. **Natural Language Activation**
Instead of remembering complex commands, simply describe what you want to do:
- "Activate marketing workflow"
- "Start customer onboarding"
- "Send notification to sales team"
- "Trigger email campaign"
- "Launch automation"

### 2. **Smart Matching**
The AI automatically matches your request to the appropriate webhook based on:
- **Description**: The natural language description you provide when setting up
- **Keywords**: Optional trigger keywords for more precise matching
- **Context**: Understanding the intent behind your request

### 3. **Dynamic Payloads**
Webhooks support dynamic variables that get replaced automatically:
- `{{timestamp}}` - Current timestamp
- `{{user_message}}` - Your exact request
- `{{contact_name}}` - Name of the AI contact

## Setup Instructions

### Step 1: Configure the Integration
1. Go to **Settings** → **Integrations**
2. Find **"Webhook Trigger"** in the Action Integrations
3. Click **"Add Integration"**

### Step 2: Fill in the Configuration

#### Required Fields:
- **Webhook URL**: Your endpoint (e.g., Zapier webhook URL)
- **Natural Language Description**: Describe what this webhook does
  ```
  Example: "Activate marketing workflow for new leads and customer engagement campaigns"
  ```

#### Optional Fields:
- **Payload Template**: JSON payload with dynamic variables
  ```json
  {
    "action": "marketing_activation",
    "trigger": "ai_assistant", 
    "timestamp": "{{timestamp}}",
    "user_request": "{{user_message}}",
    "contact": "{{contact_name}}",
    "workflow_type": "marketing",
    "priority": "high"
  }
  ```

- **Custom Headers**: Additional HTTP headers
  ```json
  {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-token",
    "X-Source": "AI-Assistant"
  }
  ```

- **Confirmation Message**: What to show when successful
  ```
  "Marketing workflow has been activated successfully!"
  ```

- **Trigger Keywords**: Comma-separated keywords for better matching
  ```
  "marketing, campaign, email, promotion, leads"
  ```

### Step 3: Assign to a Contact
1. Go to contact settings
2. Add the webhook integration
3. Enable it

## Usage Examples

### Example 1: Marketing Automation
**Setup:**
- Description: "Activate marketing workflow for new leads"
- Keywords: "marketing, campaign, email, leads"
- Webhook URL: `https://hooks.zapier.com/hooks/catch/123456/marketing`

**Usage:**
- Say: "Activate marketing campaign"
- Result: Triggers marketing automation in Zapier

### Example 2: Customer Onboarding
**Setup:**
- Description: "Start customer onboarding sequence for new users"
- Keywords: "onboarding, welcome, new customer, setup"
- Webhook URL: `https://hooks.zapier.com/hooks/catch/123456/onboarding`

**Usage:**
- Say: "Start onboarding for new customer"
- Result: Initiates welcome emails and account setup

### Example 3: Sales Notifications
**Setup:**
- Description: "Send urgent notifications to sales team"
- Keywords: "sales, notify, alert, team, urgent"
- Webhook URL: `https://hooks.zapier.com/hooks/catch/123456/sales`

**Usage:**
- Say: "Alert the sales team"
- Result: Sends Slack/email notifications to sales team

## Advanced Features

### Multiple Webhooks per Contact
You can configure multiple webhooks for one contact, each with different purposes:
- Marketing webhook
- Onboarding webhook  
- Sales notification webhook
- Customer support webhook

The AI will automatically choose the best match based on your request.

### Payload Variables
Use these dynamic variables in your payload templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{timestamp}}` | Current ISO timestamp | `2024-01-15T10:30:00.000Z` |
| `{{user_message}}` | Your exact request | `"activate marketing workflow"` |
| `{{contact_name}}` | AI contact name | `"Workflow Wizard"` |

### Error Handling
If a webhook fails:
- The AI will inform you of the error
- Check your webhook URL and payload format
- Verify authentication headers if required
- Check webhook service logs (Zapier, etc.)

## Integration Examples

### Zapier Integration
1. Create a Zapier webhook trigger
2. Copy the webhook URL 
3. Set up your automation flow in Zapier
4. Use the webhook URL in the integration

### Make.com Integration
1. Create a new scenario with webhook trigger
2. Copy the webhook URL
3. Build your automation workflow
4. Use the webhook URL in the integration

### Custom API Integration
1. Create an endpoint that accepts POST requests
2. Handle the JSON payload in your code
3. Use your API endpoint as the webhook URL
4. Add authentication headers if needed

## Troubleshooting

### Common Issues:
1. **Webhook not triggering**: Check the URL and make sure the service is active
2. **Wrong webhook triggered**: Refine your description and keywords
3. **Payload errors**: Validate your JSON syntax
4. **Authentication failed**: Check your headers and tokens

### Testing:
- Use the "Test Integration" feature in settings
- Check webhook service logs
- Verify payload format with tools like ngrok for local testing

## Tips for Better Results

### Writing Good Descriptions:
- Be specific about what the webhook does
- Include the business process it triggers
- Mention the outcome or result

### Choosing Keywords:
- Use action words (activate, trigger, start, launch)
- Include domain-specific terms
- Add synonyms for better matching

### Natural Commands:
- Speak naturally: "Please activate the marketing workflow"
- Use variations: "Start marketing", "Launch campaign", "Trigger emails"
- Be conversational: "Can you notify the sales team about this?"

## Test Contact: Workflow Wizard

Try the webhook functionality with the pre-configured "Workflow Wizard" contact that includes:
- Marketing automation webhook
- Customer onboarding webhook  
- Sales notification webhook

Just start a conversation and say things like:
- "Activate marketing"
- "Start onboarding"
- "Notify sales team" 