import { TimeEntry, TicketValidationGroup } from '../types';

// Jira project keys start with a letter followed by letters, digits or underscores
// (e.g. ABC, AB2C, MY_PROJ), so every pattern below uses [A-Z][A-Z0-9_]* for the project part.
const TICKET_PATTERN = /^([A-Z][A-Z0-9_]*)-(\d+)$/i;
const PROJECT_PATTERN = /^([A-Z][A-Z0-9_]*)$/i;
const PROJECT_WITH_TITLE_PATTERN = /^([A-Z][A-Z0-9_]*)-(.+)$/i;

/** Matches an issue key at the start of a cell, capturing any trailing text (e.g. "AB2C-8 fix login"). */
export const ISSUE_KEY_PREFIX_PATTERN = /^([A-Z][A-Z0-9_]*)-(\d+)(.*)$/i;

/** True when the value is exactly an existing-issue key such as ABC-123 or AB2C-8. */
export const isIssueKey = (value: string): boolean => TICKET_PATTERN.test(value.trim());

export const parseTicketReference = (
  reference: string
): { isExisting: boolean; projectKey: string; title?: string } => {
  const trimmed = reference.trim();

  if (TICKET_PATTERN.test(trimmed)) {
    const match = trimmed.match(TICKET_PATTERN);
    return {
      isExisting: true,
      projectKey: match![1].toUpperCase(),
    };
  }

  if (PROJECT_PATTERN.test(trimmed)) {
    return {
      isExisting: false,
      projectKey: trimmed.toUpperCase(),
    };
  }

  const projectWithTitle = trimmed.match(PROJECT_WITH_TITLE_PATTERN);
  if (projectWithTitle && !TICKET_PATTERN.test(trimmed)) {
    return {
      isExisting: false,
      projectKey: projectWithTitle[1].toUpperCase(),
      title: projectWithTitle[2],
    };
  }

  return {
    isExisting: false,
    projectKey: trimmed.toUpperCase(),
  };
};

export const groupNewTickets = (entries: TimeEntry[]): TicketValidationGroup[] => {
  const groups = new Map<string, TicketValidationGroup>();

  entries.forEach(entry => {
    // Skip entries that are already created (marked as new)
    if (entry.isNew) {
      return;
    }

    const parsed = parseTicketReference(entry.issue);

    if (!parsed.isExisting) {
      const title = parsed.title || '';
      const groupKey = `${parsed.projectKey}|||${title.toLowerCase()}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          projectKey: parsed.projectKey,
          title,
          count: 0,
          entryIds: [],
        });
      }

      const group = groups.get(groupKey)!;
      group.count++;
      group.entryIds.push(entry.id);
    }
  });

  return Array.from(groups.values());
};

export const calculateDuration = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return (endMinutes - startMinutes) * 60;
};

export const validateTimeEntry = (entry: TimeEntry): string | null => {
  if (!entry.date) {
    return 'Date is required';
  }

  if (!entry.startTime || !entry.endTime) {
    return 'Start and end times are required';
  }

  const duration = calculateDuration(entry.startTime, entry.endTime);
  if (duration <= 0) {
    return 'End time must be after start time';
  }

  if (!TICKET_PATTERN.test(entry.issue)) {
    return 'Ticket must have a valid key (e.g. ABC-123)';
  }

  return null;
};
