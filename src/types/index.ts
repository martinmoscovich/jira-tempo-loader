export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface TimeEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  issue: string;
  description: string;
  isNew?: boolean;
  isInvalid?: boolean; // For marking invalid tickets or projects
  uploadStatus?: UploadStatus;
  uploadError?: string;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
    };
    project: {
      key: string;
    };
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
}

export interface NewTicketData {
  projectKey: string;
  title: string;
  assignee: string;
  status: 'OPEN' | 'IN PROGRESS' | 'CLOSED';
  originalReference: string;
  parentIssueKey?: string;
}

export interface TicketValidationGroup {
  groupKey: string;
  projectKey: string;
  title: string;
  count: number;
  entryIds: string[];
  ticketData?: NewTicketData;
  finalIssueKey?: string;
}

export interface AuthConfig {
  jiraUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  cloudId: string | null;
  user: JiraUser | null;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: {
    '48x48': string;
  };
}

export interface TempoWorklog {
  issueKey: string;
  timeSpentSeconds: number;
  startDate: string;
  startTime: string;
  description: string;
  authorAccountId: string;
}

export interface GoogleSheetsRow {
  date?: string;
  startTime: string;
  endTime: string;
  issue: string;
  description: string;
  title?: string;
}

/**
 * Input model for importing time entries from any source (Excel, clipboard, API, etc.)
 * This is the standard format that all import sources must map to.
 */
export interface TimeEntryInput {
  fecha: string;           // Format: YYYY-MM-DD
  horaInicio: string;      // Format: HH:mm
  horaFin: string;         // Format: HH:mm
  ticket: string;          // Jira ticket key or free text
  descripcion: string;     // Work description
}
