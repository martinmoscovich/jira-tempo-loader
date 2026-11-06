# User Guide - Jira Tempo Timesheet Manager

## Overview

This application helps you manage time entries and load them into Jira Tempo. It supports both manual entry and bulk import from Google Sheets.

## Workflow

### 1. Authentication

When you first open the app:
1. Enter your Jira URL (e.g., `https://your-company.atlassian.net`)
2. Enter your OAuth Client ID
3. Click "Conectar con Jira"
4. You'll be redirected to Atlassian to authorize the app
5. After authorization, you'll return to the app

### 2. Adding Time Entries

You have two options:

#### Manual Entry
1. Click "Agregar Entrada" to add a new row
2. Fill in the fields:
   - **Fecha**: Date of the work
   - **Hora Inicio**: Start time
   - **Hora Fin**: End time
   - **Ticket**: Issue key (supports autocomplete from Jira)
   - **Descripción**: Work description

#### Import from Google Sheets
1. Export your timesheet from Google Sheets as TSV
2. Click "Importar desde Google Sheets"
3. Select the TSV file
4. All entries will be loaded into the table

### 3. Validate Tickets

Before creating worklogs, you need to validate tickets:

1. Click "Validate All Tickets"
2. For each new ticket detected, a modal will appear:
   - **Título del ticket**: The title for the new issue
   - **Assignee**: Who the issue is assigned to (defaults to current user)
   - **Status**: Initial status (OPEN, IN PROGRESS, or CLOSED)
   - **Usar ticket existente**: Option to reuse another ticket instead of creating a new one

**What are "new tickets"?**
- Tickets with only project code (e.g., `ABC`)
- Tickets with project code and title (e.g., `ABC-New Feature`)
- Tickets are grouped if they have the same project code and title (case-insensitive)

**What are "existing tickets"?**
- Tickets with full key (e.g., `ABC-123`)

### 4. Create Tickets

After validating all new tickets:

1. Click "Create N Ticket(s)"
2. The app will create all new issues in Jira
3. Each entry in the table will be updated with the final issue key

### 5. Load to Tempo

Once all tickets are created:

1. Click "Start Upload"
2. Review the summary in the confirmation dialog
3. Click "Confirmar" to create worklogs in Tempo

The app will:
- Validate all entries (date, times, valid issue keys)
- Calculate duration for each entry
- Create worklogs in Tempo for each entry

## Ticket Reference Format

### Existing Tickets
Format: `PROJECT-NUMBER` (e.g., `ABC-123`)
- These tickets must exist in Jira
- No creation needed

### New Tickets

#### Option 1: Project Code Only
Format: `PROJECT` (e.g., `ABC`)
- You'll be asked for a title during validation
- All entries with the same project code (and no title) will be grouped together

#### Option 2: Project Code with Title
Format: `PROJECT-Title` (e.g., `ABC-New Feature`)
- The title after the dash becomes the issue title
- All entries with the same project and title (case-insensitive) will be grouped together

## Google Sheets Format

The **(?)** next to **Paste from Clipboard** shows this format in the app, with an example to copy.

Paste (or import) tab-separated rows: a date row, then one row per entry with
Start, End, Duration, Ticket and Description. This is also the layout "copy to clipboard" exports.

```
01/01
        09:00   10:00   1:00   ABC-123            Fixed bug
        10:00   11:00   1:00   ABC-New Feature    New feature work
        11:00   12:00   1:00   DEF-456 Review PR
02/01   09:00   17:00   8:00   ABC                Continue feature
```

**Format rules:**
- A header row is skipped
- The date can be on its own row or in the first column of an entry row; later rows reuse it
- Date format: `DD/MM` or `DD/MM/YYYY` (without a year, the current year is used)
- Time format: `HH:MM` (24-hour); the Duration column is ignored
- Ticket: an existing key, a project (`ABC`) or a project and title (`ABC-New Feature`)
- `KEY-123 some text` in the ticket column uses the text as the description
- Rows with an invalid time are kept with that time empty, so validation flags them

## Tips

1. **Autocomplete**: Start typing a ticket number to see suggestions from Jira
2. **Free text**: You can enter any text in the Ticket field, not just existing issues
3. **Validation**: The app prevents loading invalid data to Tempo
4. **Grouping**: Multiple entries with the same new ticket reference will create only one issue
5. **Reuse tickets**: During validation, you can assign entries to an already-validated ticket instead of creating a new one

## Common Scenarios

### Scenario 1: All Existing Tickets
1. Add entries with existing ticket keys (ABC-123, DEF-456)
2. Skip validation (no new tickets)
3. Click "Start Upload" directly

### Scenario 2: Mix of Existing and New Tickets
1. Add entries with both existing (ABC-123) and new (ABC-Feature) tickets
2. Click "Validate All Tickets"
3. Only new tickets will show validation modals
4. Click "Create N Ticket(s)" to create new issues
5. Click "Start Upload"

### Scenario 3: Multiple Entries for Same New Ticket
1. Add 3 entries with ticket "ABC-Feature"
2. Click "Validate All Tickets"
3. Only ONE modal appears (entries are grouped)
4. Fill in the ticket details
5. Click "Create N Ticket(s)" - only ONE issue is created
6. All 3 entries are updated with the new issue key
7. Click "Start Upload" to create 3 worklogs

## Troubleshooting

### "No hay sesión activa"
- You need to authenticate with Jira first
- Click "Cerrar Sesión" and log in again

### "Error al crear tickets"
- Check that the project key exists in Jira
- Verify you have permission to create issues in that project
- Make sure issue type "Task" is available in the project

### "Error al cargar en Tempo"
- Verify Tempo is installed in your Jira instance
- Check that you have permission to log work
- Ensure all ticket keys are valid

### Validation Errors
- **"La fecha es requerida"**: Add a date to the entry
- **"La hora de fin debe ser posterior a la hora de inicio"**: Fix the time range
- **"El ticket debe tener un código válido"**: Make sure all new tickets have been created

## Keyboard Shortcuts

- **Tab**: Navigate between cells in the table
- **Enter**: Edit a cell in the table
- **Esc**: Cancel cell editing

## Data Privacy

All authentication data is stored locally in your browser:
- Access tokens in localStorage
- OAuth credentials are never sent to external servers
- All API calls go directly to Atlassian servers

## Support

For issues or questions:
- Check the SETUP.md file for configuration help
- Review error messages carefully
- Verify your Jira and Tempo permissions
