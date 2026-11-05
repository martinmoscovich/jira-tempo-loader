# Jira Tempo Timesheet Manager

A modern React application to manage and load time entries into Jira Tempo.

## Features

- OAuth 2.0 authentication with Jira Cloud
- **Auto-login with saved credentials**: Automatically connects with saved credentials
- **Mock mode**: Test the app without Jira access (add `?mock=true` to URL)
- Editable timesheet table with date, time, issue, and description
- Issue autocomplete from Jira API
- Smart ticket creation workflow
- Bulk import from Google Sheets or Tempo XLS reports
- Automatic worklog creation in Jira (compatible with Tempo)

## Authentication Flow

### First Time Login
1. Enter your Jira URL, Client ID, and Client Secret
2. Check "Recordar credenciales" to save them
3. Click "Conectar con Jira"
4. Authorize the app in Atlassian

### Subsequent Logins
- The app automatically uses your saved credentials
- You only need to authorize in Atlassian (no need to re-enter credentials)

### Mock Mode
- Add `?mock=true` to the URL to enter demo mode
- Clears any existing session and logs you in with a mock user
- Perfect for testing without Jira access

### Logout
- Click "Cerrar Sesión" to logout
- Your saved credentials persist for next login
- Removes `mock=true` parameter if present

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your Jira OAuth credentials in the app settings

3. Run the development server:
```bash
npm run dev
```

## Building for Production

```bash
npm run build
```

## Testing

```bash
npm test
```

## Deployment

The app is automatically deployed to GitHub Pages on push to main branch.

## Tech Stack

- React 18
- Vite v7 with Rolldown
- TypeScript
- Material-UI
- TanStack Query
- Axios
- Framer Motion
- Vitest
