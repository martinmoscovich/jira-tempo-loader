# Architecture Documentation

## Project Structure

```
/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml           # CI pipeline (tests, lint)
│   │   └── deploy.yml       # Deploy to GitHub Pages
│   └── dependabot.yml       # Dependency updates
├── public/
│   └── vite.svg             # App icon
├── src/
│   ├── components/          # React components
│   │   ├── AuthSetup.tsx
│   │   ├── GoogleSheetsImport.tsx
│   │   ├── IssueAutocomplete.tsx
│   │   ├── TempoLoader.tsx
│   │   ├── TicketValidationFlow.tsx
│   │   ├── TicketValidationModal.tsx
│   │   └── TimesheetTable.tsx
│   ├── context/             # React context providers
│   │   ├── AuthContext.tsx
│   │   ├── LocaleContext.tsx  # Date/number format (es | en-US), saved in localStorage
│   │   └── TimesheetContext.tsx
│   ├── services/            # API services
│   │   ├── jiraApi.ts
│   │   └── tempoApi.ts
│   ├── test/                # Test setup
│   │   └── setup.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── auth.ts
│   │   ├── googleSheets.ts
│   │   └── ticketValidation.ts
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # App entry point
│   └── vite-env.d.ts        # Vite types
├── index.html               # HTML entry point
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
└── vitest.config.ts         # Test config
```

## Technology Stack

### Core
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite v7**: Build tool with Rolldown bundler

### UI Components
- **Material-UI (MUI)**: Component library
- **@mui/x-data-grid**: Editable table
- **@mui/x-date-pickers**: Date/time pickers
- **Framer Motion**: Animations

### State Management
- **React Context**: Global state
- **TanStack Query**: Server state & caching

### API Communication
- **Axios**: HTTP client
- **Jira REST API v3**: Issue management
- **Tempo API v4**: Worklog management

### Testing
- **Vitest**: Test runner
- **Testing Library**: Component testing
- **Happy DOM**: DOM environment

### Code Quality
- **oxlint**: Fast linting
- **TypeScript**: Static type checking

## Data Flow

### 1. Authentication Flow

```
User enters credentials
  ↓
AuthContext.login()
  ↓
OAuth PKCE flow initiated
  ↓
Redirect to Atlassian
  ↓
User authorizes
  ↓
Redirect back with code
  ↓
Exchange code for tokens
  ↓
Store tokens in localStorage
  ↓
Initialize API services
```

### 2. Timesheet Entry Flow

```
User adds entry (manual or import)
  ↓
TimesheetContext.addEntry()
  ↓
Entry stored in context state
  ↓
Table re-renders with new data
```

### 3. Ticket Validation Flow

```
User clicks "Validate All Tickets"
  ↓
groupNewTickets() analyzes entries
  ↓
Creates groups for new tickets
  ↓
Modal appears for each group
  ↓
User provides ticket details
  ↓
Data stored in validation groups
  ↓
All modals completed
```

### 4. Ticket Creation Flow

```
User clicks "Create N Ticket(s)"
  ↓
For each validation group:
  ↓
  JiraApi.createIssue()
    ↓
  Update group with new issue key
    ↓
  Update all related entries
  ↓
All tickets created
```

### 5. Tempo Loading Flow

```
User picks "Parallel uploads" (N, default 4) and clicks "Start Upload"
  ↓
runParallelQueues(): N workers pull entries from one shared queue
  ↓
  uploadWorklog() → TempoApi.createWorklog()
    ↓
  On error, classifyUploadError() decides:
    429                    → retry; ALL workers wait (Retry-After if readable, else backoff)
    network / 5xx          → check Jira (findWorklog): exists = success, missing = retry,
                             can't check = fail ("may have been created")
    401 (after refresh)    → abort the whole run
    other 4xx              → fail with Jira's message
  ↓
Pause: in-flight requests finish, waiting entries go back to pending
  ↓
Done: auto-advance only if nothing failed; otherwise "Retry failed (n)"
```

Creating a worklog is not idempotent, which is why only failures known to have written nothing
are retried automatically. Code: `src/utils/parallelQueues.ts`, `src/services/worklogUpload.ts`.

## Key Components

### AuthContext
- Manages authentication state
- Handles OAuth flow
- Provides API service instances
- Stores user information

### TimesheetContext
- Manages time entries
- Handles validation groups
- Provides CRUD operations
- Maintains entry state

### JiraApiService
- Wraps Jira REST API
- Handles issue search
- Creates issues
- Manages transitions

### TempoApiService
- Wraps Tempo API
- Creates worklogs
- Manages time entries

### TimesheetTable
- Editable data grid
- Inline editing
- Issue autocomplete
- Add/delete rows

### TicketValidationFlow
- Orchestrates validation
- Manages modal flow
- Handles ticket creation
- Updates entries

## State Management

### Local State (useState)
- Component-specific UI state
- Form inputs
- Modal visibility
- Loading states

### Context State
- Authentication data
- Time entries
- Validation groups
- Global app state

### Server State (TanStack Query)
- Issue search results
- Cached API responses
- Automatic refetching
- Error handling

## API Integration

### Jira OAuth 2.0 (PKCE)
- Authorization Code Flow with PKCE
- Refresh token support
- Scope: `read:jira-work write:jira-work read:jira-user offline_access`

### Jira REST API v3
- Endpoints used:
  - `GET /search` - Search issues
  - `GET /issue/{key}` - Get issue details
  - `POST /issue` - Create issue
  - `POST /issue/{key}/transitions` - Change status
  - `GET /myself` - Get current user

### Tempo API v4
- Endpoints used:
  - `POST /worklogs` - Create worklog
  - `GET /worklogs/user/{accountId}` - Get worklogs
  - `DELETE /worklogs/{id}` - Delete worklog
  - `PUT /worklogs/{id}` - Update worklog

## Security

### OAuth PKCE
- Code verifier stored in sessionStorage
- Code challenge sent to auth server
- Prevents authorization code interception

### Token Storage
- Access token in localStorage
- Refresh token in localStorage
- Cleared on logout

### API Security
- All API calls use Bearer token
- HTTPS only
- No credentials in code

## Testing Strategy

### Unit Tests
- Utility functions
- Data transformations
- Validation logic

### Component Tests
- Render tests
- User interaction
- Props handling

### Integration Tests
- Context integration
- API mocking
- Flow testing

## Build & Deploy

### Development
```bash
npm run dev
```
- Vite dev server
- Hot module replacement
- Fast refresh

### Production Build
```bash
npm run build
```
- TypeScript compilation
- Vite build with Rolldown
- Code splitting
- Minification

### GitHub Actions
- **CI**: Runs on every push/PR
  - Type checking
  - Linting
  - Tests
  - Coverage report
- **Deploy**: Runs on main branch push
  - Build app
  - Deploy to GitHub Pages

## Performance Optimizations

1. **Code Splitting**: Vendor, MUI, and query chunks
2. **React Query Caching**: Reduces API calls
3. **Lazy Loading**: Components loaded on demand
4. **Memoization**: Expensive calculations cached
5. **Virtual Scrolling**: Large data grids
6. **Debouncing**: Search input optimization

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Requires modern browser with:
  - Web Crypto API
  - localStorage
  - Fetch API

## Future Enhancements

Possible improvements:
1. Offline support with Service Workers
2. Dark mode theme
3. Bulk edit operations
4. Export to CSV
5. Calendar view
6. Time tracking timer
7. Multiple Jira sites
8. Custom issue types
9. Worklog editing/deletion
10. Report generation
