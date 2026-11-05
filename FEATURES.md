# Tempo Loader - New Features

## Overview
The Tempo Loader has been completely redesigned with a professional 5-step workflow that guides you through the entire process of managing and uploading time entries to Tempo.

## 🎨 New UI/UX Architecture

### Layout
- **Sidebar Navigation (30%)**: Persistent workflow stepper showing your progress
- **Main Content Area (70%)**: Current step with all relevant actions
- **Responsive Design**: Optimized for desktop workflows

### Visual Design
- **Color-Coded Status**:
  - 🟢 Green: Valid/Success
  - 🟠 Orange: New/Warning
  - 🔴 Red: Invalid/Error
  - 🔵 Blue: In Progress
- **Real-time Progress**: Live progress bars and status indicators
- **Smooth Animations**: Framer Motion transitions between steps

---

## 📋 5-Step Workflow

### Step 1: Data Entry
**Purpose**: Import or manually enter your time entries

**Features**:
- ✅ Paste from clipboard (Excel, Google Sheets format)
- ✅ Import from Tempo Report
- ✅ Generate Invoice from a Tempo report, grouped by project and billing code. Billing settings (code prefix such as `PRJ` + digits, internal projects grouped as "Internal Time") are entered in the dialog and saved in the browser
- ✅ Manual entry with inline editing
- ✅ AG Grid with advanced features:
  - Excel-like keyboard navigation
  - Copy/paste support
  - Date picker
  - Issue autocomplete
  - Duration calculation

**Actions**:
- Paste from Clipboard
- Import from Tempo
- Add Entry
- Copy to Clipboard
- View Tempo Report

**Location**: [DataEntryStep.tsx](src/components/steps/DataEntryStep.tsx)

---

### Step 2: Validate Tickets
**Purpose**: Verify all tickets exist in Jira and projects are valid

**Features**:
- ✅ Batch validation of existing tickets
- ✅ Project key validation
- ✅ Real-time validation status
- ✅ Visual summary cards:
  - Existing Tickets count
  - New Tickets count
  - Total Entries count
- ✅ Detailed validation results
- ✅ Automatic grouping of new tickets by project

**Validation Checks**:
- Ticket exists in Jira (e.g., ABC-123)
- Project is accessible
- Proper ticket format

**Location**: [ValidateTicketsStep.tsx](src/components/steps/ValidateTicketsStep.tsx)

---

### Step 3: Create Tickets
**Purpose**: Create new Jira tickets for entries that don't have valid tickets

**Features**:
- ✅ **Inline Forms** (no more modal dialogs!)
- ✅ Accordion-based UI for each ticket
- ✅ Batch creation with progress tracking
- ✅ Rich configuration options:
  - Custom title
  - Assignee selection
  - Status (Open/In Progress/Closed)
  - Parent issue linking
- ✅ Link multiple entries to same ticket
- ✅ Visual status indicators:
  - Pending: Not configured
  - Ready: Configured
  - Created: Successfully created with ticket key

**Smart Features**:
- Auto-populate with entry description
- Link to existing tickets from previous groups
- Progress bar during creation
- Automatically update entries with new ticket keys

**Location**: [CreateTicketsStep.tsx](src/components/steps/CreateTicketsStep.tsx)

---

### Step 4: Validate Entries
**Purpose**: Final validation before upload to ensure data quality

**Features**:
- ✅ Comprehensive validation checks
- ✅ Visual summary dashboard:
  - Total Entries
  - Errors count
  - Warnings count
  - Total Time
- ✅ Error detection:
  - Missing required fields
  - Invalid time ranges
  - Missing tickets
- ✅ Warning detection:
  - Time overlaps
  - Very long durations (>12h)
  - Missing descriptions
- ✅ Detailed issue list with fixes
- ✅ Block export if errors exist
- ✅ Allow export with warnings

**Validation Rules**:
| Rule | Type | Description |
|------|------|-------------|
| Missing Ticket | Error | Entry has no ticket assigned |
| Missing Time | Error | Start/end time not set |
| Invalid Date | Error | Date is not valid |
| Time Overlap | Warning | Multiple entries overlap on same day |
| Long Duration | Warning | Entry exceeds 12 hours |
| No Description | Warning | Entry has empty description |

**Location**: [ValidateEntriesStep.tsx](src/components/steps/ValidateEntriesStep.tsx)

---

### Step 5: Export to Tempo
**Purpose**: Upload validated entries to Tempo with full control

**Features**:
- ✅ **Pause/Resume Functionality** - Stop and continue uploads
- ✅ Real-time progress tracking:
  - Current entry being uploaded
  - Progress percentage
  - Time elapsed
  - Estimated time remaining
- ✅ Visual status dashboard:
  - Total Entries
  - Successful uploads
  - Errors count
  - Total Time
- ✅ Individual entry status:
  - Idle (gray)
  - Uploading (blue)
  - Success (green)
  - Error (red)
- ✅ Error handling:
  - Continue on error (don't stop entire process)
  - Show detailed error messages
  - Ability to retry failed entries
- ✅ Auto-scroll to current entry
- ✅ Row highlighting based on status

**Controls**:
- Start Upload
- Pause (during upload)
- Resume (when paused)
- Reset (clear all and start over)

**Location**: [ExportTempoStep.tsx](src/components/steps/ExportTempoStep.tsx)

---

## 🚀 Key Improvements Over Previous Version

### 1. **Better UX Flow**
- **Before**: Everything on one page, confusing
- **After**: Clear 5-step process with visual progress

### 2. **Inline Ticket Creation**
- **Before**: Modal dialogs that block the view
- **After**: Accordion-based inline forms with full context

### 3. **Comprehensive Validation**
- **Before**: Basic validation only
- **After**: Multi-level validation (tickets, projects, entries)

### 4. **Upload Control**
- **Before**: All-or-nothing upload
- **After**: Pause/resume, continue on error, detailed progress

### 5. **Visual Feedback**
- **Before**: Limited status indicators
- **After**: Real-time progress, color-coded status, animations

### 6. **Error Handling**
- **Before**: Stop on first error
- **After**: Continue uploading, show all errors, allow retry

---

## 🎯 Component Architecture

### Main Components

```
TempoWorkflow (Orchestrator)
├── WorkflowLayout (Sidebar + Content)
│   ├── EnhancedWorkflowStepper (Progress sidebar)
│   └── Step Components (Content area)
│       ├── DataEntryStep
│       ├── ValidateTicketsStep
│       ├── CreateTicketsStep
│       ├── ValidateEntriesStep
│       └── ExportTempoStep
└── TimesheetTable (AG Grid)
```

### Shared Components (Reused)
- `TimesheetTable`: AG Grid with all editing features
- `IssueAutocomplete`: Jira issue search
- `TempoReportImport`: Import from Tempo
- `StatsModal`: Statistics and charts

### New Components
- `WorkflowLayout`: Sidebar/content layout
- `EnhancedWorkflowStepper`: 5-step progress indicator
- All step components in `src/components/steps/`

---

## 📊 State Management

### Context: TimesheetContext
```typescript
interface TimesheetContextType {
  entries: TimeEntry[];              // All time entries
  validationGroups: TicketValidationGroup[]; // Grouped new tickets
  addEntry: (entry: TimeEntry) => void;
  updateEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteEntry: (id: string) => void;
  setEntries: (entries: TimeEntry[]) => void;
  setValidationGroups: (groups: TicketValidationGroup[]) => void;
  updateValidationGroup: (groupKey: string, updates: Partial<TicketValidationGroup>) => void;
}
```

### Workflow State
- `currentStep`: Current active step
- `completedSteps`: Array of completed steps
- `uploadProgress`: Current upload progress

---

## 🎨 Design Tokens

### Colors
```typescript
Primary (Blue):    #1976d2  // Navigation, CTAs
Success (Green):   #2e7d32  // Valid, Success
Warning (Orange):  #ed6c02  // New, Warnings
Error (Red):       #d32f2f  // Invalid, Errors
Info (Light Blue): #0288d1  // In Progress
```

### Spacing
- Card padding: 16-24px
- Gap between elements: 16px
- Container max-width: xl (1536px)

### Typography
- Headers: h4-h6, bold
- Body: body1-body2
- Captions: caption

---

## ⌨️ Future Enhancements

### Keyboard Shortcuts (Planned)
- `Enter`: Continue to next step
- `Esc`: Go back
- `Ctrl+S`: Save draft
- `Ctrl+V`: Paste data (Step 1)

### Additional Features (Planned)
- 💾 Save drafts to localStorage
- 📈 Enhanced statistics with charts
- 🔍 Advanced filtering
- 📅 Calendar view for entries
- 🔄 Undo/redo functionality
- 🎯 Bulk operations (merge entries, split entries)
- 📱 Mobile-responsive layout

---

## 🧪 Testing

Run tests:
```bash
npm test
```

Run with UI:
```bash
npm run test:ui
```

Type checking:
```bash
npm run type-check
```

---

## 📝 Development

### File Structure
```
src/
├── components/
│   ├── steps/                    # Step components
│   │   ├── DataEntryStep.tsx
│   │   ├── ValidateTicketsStep.tsx
│   │   ├── CreateTicketsStep.tsx
│   │   ├── ValidateEntriesStep.tsx
│   │   └── ExportTempoStep.tsx
│   ├── WorkflowLayout.tsx        # Layout component
│   ├── EnhancedWorkflowStepper.tsx  # Stepper sidebar
│   ├── TempoWorkflow.tsx         # Main orchestrator
│   └── TimesheetTable.tsx        # AG Grid table
├── context/
│   ├── TimesheetContext.tsx      # State management
│   └── AuthContext.tsx           # Authentication
└── utils/
    ├── ticketValidation.ts       # Validation logic
    └── googleSheets.ts           # Import/export
```

### Adding a New Validation Rule

1. Edit `src/utils/ticketValidation.ts`
2. Add your validation function
3. Import in `ValidateEntriesStep.tsx`
4. Add to `validationIssues` array

Example:
```typescript
// In ticketValidation.ts
export const checkWeekendEntry = (entry: TimeEntry): boolean => {
  const date = new Date(entry.date);
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

// In ValidateEntriesStep.tsx
if (checkWeekendEntry(entry)) {
  issues.push({
    severity: 'warning',
    message: 'Entrada en fin de semana',
    // ...
  });
}
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: Stepper doesn't show progress
- **Fix**: Check that `completedSteps` is being updated in workflow

**Issue**: Upload gets stuck
- **Fix**: Use Pause then Resume to restart

**Issue**: Tickets not validating
- **Fix**: Check Jira API connection in console

**Issue**: Table not showing data
- **Fix**: Check console for import errors

---

## 📚 Resources

- [AG Grid React Docs](https://www.ag-grid.com/react-data-grid/)
- [Material-UI Components](https://mui.com/material-ui/)
- [Framer Motion Animations](https://www.framer.com/motion/)
- [React Query](https://tanstack.com/query/latest)

---

## 🎉 Summary

The new Tempo Loader provides:
- ✅ Clear 5-step workflow
- ✅ Professional UI/UX
- ✅ Inline ticket creation
- ✅ Comprehensive validation
- ✅ Pause/resume uploads
- ✅ Better error handling
- ✅ Real-time progress
- ✅ Visual feedback everywhere

**This is now the best Tempo Loader ever!** 🚀
