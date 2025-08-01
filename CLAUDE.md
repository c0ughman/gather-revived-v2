# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gather is a React-based AI assistant platform that allows users to create, manage, and interact with customizable AI agents. The application supports real-time chat, voice calls, document processing, third-party integrations, and a subscription-based payment system.

## Development Commands

### Core Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint on TypeScript files
- `npm run preview` - Preview production build

### Environment Setup
- Create `.env` file with required environment variables:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
  - `VITE_GOOGLE_API_KEY` - Google Generative AI API key
  - `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

## Architecture Overview

### Module Structure
The codebase follows a modular architecture organized in `src/modules/`:

- **auth** - Authentication using Supabase Auth
- **chat** - Real-time chat interface with AI agents
- **voice** - Voice calling using Google's Gemini Live API
- **ui** - Core UI components (Dashboard, Settings, Sidebars)
- **database** - Supabase integration and data services
- **fileManagement** - Document upload, processing, and context management
- **integrations** - Third-party service integrations (Notion, Google Sheets, etc.)
- **oauth** - OAuth flow handling for external services
- **payments** - Stripe integration for subscription management

### Core Architecture Patterns

1. **State Management**: Uses React hooks and context, with shared state passed between components via props
2. **Data Flow**: Supabase for persistence → Service layer → React components
3. **AI Integration**: Google Gemini for text generation and live voice calls
4. **Document Processing**: Multi-format support (PDF, DOCX, TXT, etc.) with content extraction
5. **Integration System**: Configurable third-party data fetching with periodic execution

### Key Components

- **App.tsx** (`src/core/app/App.tsx`): Main application component handling routing, state management, and view orchestration
- **ContactSidebar**: Agent management and navigation
- **SettingsSidebar**: Real-time agent configuration
- **ChatScreen**: Message interface with document attachments
- **CallScreen**: Voice call interface with Gemini Live
- **Dashboard**: Agent overview and quick actions

### Database Schema (Supabase)

Key tables managed through `supabaseService`:
- `user_agents` - AI agent configurations
- `agent_integrations` - Third-party service connections
- `agent_documents` - Uploaded files and content
- `conversation_documents` - Chat-specific document attachments

### Integration System

Supports configurable integrations with:
- Notion (OAuth-based page/database access)
- Google Sheets (API-based spreadsheet access)
- Zapier/N8N webhooks
- Custom API endpoints

Integrations can be triggered:
- Periodically (configurable intervals)
- On chat start
- Both

### Document Processing

Multi-format document support:
- PDF extraction using pdf.js
- DOCX processing with mammoth.js
- Excel files with xlsx library
- Text files with encoding detection
- Content summarization via Gemini API

## Development Guidelines

### File Organization
- Components should be placed in their respective module directories
- Shared types go in `src/core/types/`
- Utility functions in `src/core/utils/`
- Service classes in module-specific `services/` directories

### Environment Variables
All API keys and sensitive data must be stored as environment variables with the `VITE_` prefix for client-side access.

### State Synchronization
The app uses a shared state pattern for settings across different views. Changes to agent configuration are synchronized between SettingsScreen and SettingsSidebar through parent component state.

### Error Handling
- Database operations should handle connection failures gracefully
- AI API calls should provide fallback error messages
- File upload operations should validate formats and sizes

### API Integration Patterns
- Use service classes for external API interactions
- Implement proper OAuth flows for authenticated services
- Cache integration data to reduce API calls
- Handle rate limiting and API errors appropriately

## Common Development Tasks

### Adding New Integrations
1. Define integration schema in `src/modules/integrations/data/integrations.ts`
2. Implement service logic in `src/modules/integrations/`
3. Add OAuth configuration if needed in `src/modules/oauth/data/oauthConfigs.ts`
4. Update integration selection UI in `IntegrationsLibrary.tsx`

### Extending Document Support
1. Add file type handling in `documentService.ts`
2. Implement content extraction logic
3. Update document processing pipeline in `documentContextService.ts`
4. Test with various file formats and sizes

### Modifying Agent Behavior
1. Update AI prompting logic in `geminiService.ts`
2. Modify agent configuration schema in core types
3. Update settings UI to expose new configuration options
4. Ensure database schema supports new fields