import { TempoWorklog } from '../types';
import { RestApi, UnauthorizedHandler } from './restApi';

/**
 * Formats a date and time in local timezone to ISO 8601 format with timezone offset
 * @param date - Date string in format YYYY-MM-DD
 * @param time - Time string in format HH:mm
 * @returns ISO 8601 formatted datetime string with local timezone offset
 */
function formatDateTimeWithTimezone(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create date in local timezone
  const dateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);

  // Get timezone offset in minutes and convert to +/-HHmm format
  const tzOffset = -dateObj.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzHours = Math.floor(Math.abs(tzOffset) / 60).toString().padStart(2, '0');
  const tzMinutes = (Math.abs(tzOffset) % 60).toString().padStart(2, '0');

  // Format the datetime
  const yearStr = dateObj.getFullYear();
  const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dayStr = String(dateObj.getDate()).padStart(2, '0');
  const hoursStr = String(dateObj.getHours()).padStart(2, '0');
  const minutesStr = String(dateObj.getMinutes()).padStart(2, '0');

  return `${yearStr}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}:00.000${tzSign}${tzHours}${tzMinutes}`;
}

/** Jira returns offsets without a colon ("+0100"); normalize before parsing for portability. */
function parseJiraDateTime(value: string): number {
  return Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
}

export class TempoApiService extends RestApi {
  constructor(accessToken: string, cloudId: string, onUnauthorized?: UnauthorizedHandler) {
    super(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`,
      accessToken,
      onUnauthorized
    );
  }

  async createWorklog(worklog: TempoWorklog): Promise<{ tempoWorklogId: number }> {
    // Convert startDate and startTime to ISO format with local timezone
    const startDateTime = formatDateTimeWithTimezone(worklog.startDate, worklog.startTime);

    const payload = {
      timeSpentSeconds: worklog.timeSpentSeconds,
      comment: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: worklog.description || '',
              },
            ],
          },
        ],
      },
      started: startDateTime,
    };

    const response = await this.client.post(`/issue/${worklog.issueKey}/worklog`, payload);
    return { tempoWorklogId: parseInt(response.data.id) };
  }

  async findWorklog(worklog: TempoWorklog): Promise<boolean> {
    const [year, month, day] = worklog.startDate.split('-').map(Number);
    const [hours, minutes] = worklog.startTime.split(':').map(Number);
    const startedMs = new Date(year, month - 1, day, hours, minutes).getTime();

    // Narrow the search to a 2-minute window around the start, then match exactly.
    const response = await this.client.get<{
      worklogs?: Array<{ started: string; timeSpentSeconds: number; author?: { accountId?: string } }>;
    }>(`/issue/${worklog.issueKey}/worklog`, {
      params: { startedAfter: startedMs - 60_000, startedBefore: startedMs + 60_000 },
    });

    return (response.data.worklogs ?? []).some(
      (existing) =>
        existing.author?.accountId === worklog.authorAccountId &&
        existing.timeSpentSeconds === worklog.timeSpentSeconds &&
        parseJiraDateTime(existing.started) === startedMs
    );
  }

  async getWorklogs(
    _authorAccountId: string,
    _from: string,
    _to: string
  ): Promise<{ results: TempoWorklog[] }> {
    // Jira doesn't have a direct endpoint to get all user worklogs across issues
    // This is a limitation - we'll return empty for now
    // In a real implementation, you'd need to track which issues have worklogs
    return { results: [] };
  }

  async deleteWorklog(_worklogId: number): Promise<void> {
    // We need the issue key to delete a worklog in Jira
    // This requires storing the issue key with the worklog ID
    // For now, this will need to be called differently
    console.warn('deleteWorklog requires issue key in Jira API');
  }

  async updateWorklog(_worklogId: number, _worklog: Partial<TempoWorklog>): Promise<void> {
    // Similar limitation - need issue key
    console.warn('updateWorklog requires issue key in Jira API');
  }

  // New method specific to Jira API
  async deleteWorklogByIssue(issueKey: string, worklogId: string): Promise<void> {
    await this.client.delete(`/issue/${issueKey}/worklog/${worklogId}`);
  }

  async updateWorklogByIssue(
    issueKey: string,
    worklogId: string,
    worklog: Partial<TempoWorklog>
  ): Promise<void> {
    const payload: any = {};

    if (worklog.timeSpentSeconds !== undefined) {
      payload.timeSpentSeconds = worklog.timeSpentSeconds;
    }

    if (worklog.description !== undefined) {
      payload.comment = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: worklog.description,
              },
            ],
          },
        ],
      };
    }

    if (worklog.startDate && worklog.startTime) {
      payload.started = formatDateTimeWithTimezone(worklog.startDate, worklog.startTime);
    }

    await this.client.put(`/issue/${issueKey}/worklog/${worklogId}`, payload);
  }
}
