# Mock Mode

## Overview

Mock mode allows you to test the application without needing access to a real Jira instance. This is useful for development, testing, and demonstrations.

## How to Enable Mock Mode

When the application starts and prompts for Jira configuration, simply click the **"Usar Modo Demo (sin Jira)"** button.

This will bypass the OAuth flow entirely and log you in with mock credentials automatically.

## Mock Mode Features

### Mock User
- Account ID: `mock-account-id`
- Display Name: `Mock User`
- Email: `mock@example.com`
- Avatar: Placeholder image

### Mock Issues
The mock Jira API comes with two pre-configured issues:
- **TEST-1**: "Mock Issue 1" (Status: In Progress)
- **TEST-2**: "Mock Issue 2" (Status: Done)

### Mock Projects
Three mock projects are available for validation:
- **TEST**
- **DEMO**
- **MOCK**

### Mock Tempo Worklogs
All worklog operations are simulated:
- Creating worklogs stores them in memory
- Worklogs persist during the session but reset on page refresh
- All API delays are simulated (200ms)

## What Works in Mock Mode

✅ User authentication (bypassed)
✅ Issue validation (against mock issues)
✅ Project validation (against mock projects)
✅ Creating new issues (generates random mock issue keys)
✅ Uploading worklogs to Tempo (stored in memory)
✅ All UI workflows and components

## Limitations

⚠️ Data is not persisted between page refreshes
⚠️ Limited to pre-configured mock issues and projects
⚠️ Cannot fetch real data from Jira/Tempo
⚠️ OAuth callback handling is disabled

## Testing Workflow

1. Start the app with empty Jira URL
2. Import timesheet data (Google Sheets or Tempo XLS)
3. Validate tickets (will check against mock issues)
4. Create new tickets (will generate mock issues like TEST-123, DEMO-456, etc.)
5. Upload to Tempo (will simulate worklog creation)

## Implementation Details

Mock mode is automatically detected when:
- `authConfig.jiraUrl` is empty or whitespace-only
- Authentication state uses special tokens:
  - `accessToken`: `'mock-access-token'`
  - `cloudId`: `'mock-cloud-id'`

When these conditions are met, the app uses:
- `MockJiraApiService` instead of `JiraApiService`
- `MockTempoApiService` instead of `TempoApiService`
