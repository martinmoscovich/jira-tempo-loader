# Setup Instructions

## Prerequisites

- Node.js 20 or higher
- A Jira Cloud account
- OAuth 2.0 credentials from Atlassian

## OAuth Setup

The sign-in screen has a **How do I get these?** link with these steps and the exact callback URL to copy.

1. Go to https://developer.atlassian.com/console/myapps/ and choose **Create → OAuth 2.0 integration**
2. **Permissions**:
   - **Jira API** → Add → Configure → Edit scopes (Classic scopes): `read:jira-work`, `write:jira-work`, `read:jira-user`
   - **User identity API** → Add (`read:me`)
3. **Authorization** → OAuth 2.0 (3LO) → Configure: set the callback URL to the app URL exactly,
   e.g. `http://localhost:5173/` for development or `https://<user>.github.io/<repo>/` on GitHub Pages
4. **Settings**: copy the Client ID and Secret
5. Optional: **Distribution → Sharing** lets other people sign in with your app

`offline_access` (refresh tokens) is requested at sign-in and needs no setup in the console.

## Installation

```bash
npm install
```

## Configuration

When you first run the app, you'll be prompted to enter:
- Your Jira URL (e.g., https://your-company.atlassian.net)
- Your OAuth Client ID
- Your OAuth Client Secret

These will be saved in localStorage for future sessions.

**Note:** The Client Secret will be stored in your browser's localStorage and will be visible in the browser's developer tools and network requests. This is acceptable for personal use, but not recommended for production applications with multiple users.

## Running the App

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Running Tests

```bash
npm test
```

## Deploying to GitHub Pages

1. Update the `base` property in `vite.config.ts` to match your repository name
2. Push to the main branch
3. GitHub Actions will automatically build and deploy

## Worklog API

This app uses Jira's native Worklog API to create time entries. The worklogs are created directly in Jira and will be visible in both Jira and Tempo (if Tempo is installed in your Jira instance).

## Google Sheets Import Format

The app expects a TSV (tab-separated values) file with the following columns:

```
Fecha   Hora Inicio   Hora Fin   Ticket   Descripción   Título (optional)
01/01/2025   09:00   10:00   ABC-123   Task description
     10:00   11:00   ABC   Another task   New Feature
```

- First row is the header (will be skipped)
- Date is only required on the first row of each day
- Date can be in DD/MM or DD/MM/YYYY format
- Ticket can be an existing ticket (ABC-123) or a new one (ABC or ABC-Title)
- Title column is optional and will be combined with the ticket code if present

## Troubleshooting

### OAuth Errors

- Make sure your Client ID is correct
- Verify the callback URL matches your configuration
- Check that all required scopes are enabled

### API Errors

- Ensure your Jira account has permissions to create issues
- Verify Tempo is installed and configured in your Jira instance
- Check that the project keys you're using exist in Jira

### Build Errors

- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Make sure you're using Node.js 20 or higher
