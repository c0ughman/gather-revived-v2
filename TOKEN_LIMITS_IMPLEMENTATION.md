# Token Limits Implementation Plan

## Overview
This document outlines the comprehensive token-based limits system to be implemented across the Gather application.

## Token Counting Method
- **Approximation**: 1 token ≈ 4 characters
- Simple and fast for real-time validation
- Consistent across frontend and backend

## Limits Specification

### 1. Conversation Context Limit: 4,000 tokens
- **Scope**: Chat messages in active conversation
- **Behavior**: When exceeded, oldest messages are excluded from context
- **Implementation**: Backend AI service context building
- **UI Impact**: None (invisible to user)

### 2. Paper Notes Context Limit: 4,000 tokens  
- **Scope**: Paper notes in agent context
- **Order**: Newest first, except pinned notes (always included)
- **Behavior**: Notes outside limit get grey background in UI
- **Implementation**: Frontend UI styling + backend context filtering

### 3. Agent Description Limit: 4,000 tokens
- **Scope**: Agent description field in settings and creation
- **Behavior**: 
  - Silent truncation when sending to AI
  - Validation error prevents saving if over limit
- **Implementation**: Frontend validation + backend truncation
- **UI**: Red text + red border on input when over limit

### 4. Medium Term Memory Context Limit: 4,000 tokens
- **Scope**: Memory tab items (different from paper notes)
- **Order**: By timestamp (newest first)
- **Behavior**: Items outside limit get grey text, excluded from AI context
- **Implementation**: Frontend UI styling + backend context filtering

### 5. Agent Document Limits
- **Per Document**: 20,000 tokens maximum
- **Total Documents**: 10 documents maximum per agent
- **Behavior**: Prevent upload with error message
- **Scope**: Only permanent agent documents (not conversation documents)

### 6. Conversation Document Limit: 20,000 tokens (cumulative)
- **Scope**: Documents uploaded during conversations
- **Behavior**: Prevent upload when cumulative total would exceed limit
- **Implementation**: Frontend validation + backend enforcement

## Technical Implementation

### Backend Changes
1. **Update context_limits.py** with new token-based limits
2. **Create token counting utility** for consistent calculations
3. **Update AI service** context building with token limits
4. **Add validation endpoints** for document uploads
5. **Update database services** with token-aware filtering

### Frontend Changes
1. **Create token counting utility** (matching backend)
2. **Add validation to forms** (agent description, document uploads)
3. **Update UI styling** for over-limit items (grey backgrounds/text)
4. **Add error message components** for limit violations
5. **Update document upload logic** with token validation

### Files to Modify

#### Backend
- `app/core/context_limits.py` - Add new token limits
- `app/core/token_utils.py` - New file for token counting
- `app/services/ai_service.py` - Update context building
- `app/services/database_service.py` - Add token-aware queries
- `app/api/v1/endpoints/documents.py` - Add upload validation
- `app/api/v1/endpoints/database.py` - Add description validation

#### Frontend
- `src/core/utils/tokenUtils.ts` - New file for token counting
- `src/modules/ui/components/SettingsSidebar.tsx` - Description validation
- `src/modules/fileManagement/` - Document upload validation
- `src/modules/ui/components/Dashboard.tsx` - Agent creation validation
- Memory tab component - Grey text styling
- Paper notes component - Grey background styling

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create token counting utilities (backend & frontend)
- [ ] Update context_limits.py with new limits
- [ ] Create validation helper functions

### Phase 2: Backend Context Limits
- [ ] Update AI service conversation context limiting
- [ ] Update database services for paper notes filtering  
- [ ] Update database services for memory filtering
- [ ] Add agent description truncation in AI service

### Phase 3: Frontend Validation
- [ ] Add agent description validation (settings & creation)
- [ ] Add document upload validation (agent documents)
- [ ] Add conversation document upload validation
- [ ] Create error message components

### Phase 4: UI Visual Indicators
- [ ] Add grey background for excluded paper notes
- [ ] Add grey text for excluded memory items
- [ ] Add red styling for over-limit inputs
- [ ] Test all visual states

### Phase 5: Testing & Integration
- [ ] Test all limits end-to-end
- [ ] Verify token counting consistency
- [ ] Ensure grandfathered content works
- [ ] Performance testing with large datasets

## Error Messages
- **Agent Description**: "Description exceeds 4,000 token limit"
- **Agent Documents**: "Document exceeds 20,000 token limit" / "Maximum 10 documents per agent"
- **Conversation Documents**: "Conversation documents exceed 20,000 token limit"

## Notes
- Existing content that exceeds limits is grandfathered in
- Token counting uses 4-character approximation for simplicity
- Context compacting for conversations will be implemented later
- Pinned paper notes are always included regardless of token limits