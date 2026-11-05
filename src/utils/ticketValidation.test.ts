import { describe, it, expect } from 'vitest';
import {
  parseTicketReference,
  groupNewTickets,
  calculateDuration,
  validateTimeEntry,
  isIssueKey,
  ISSUE_KEY_PREFIX_PATTERN,
} from './ticketValidation';
import { TimeEntry } from '../types';

describe('parseTicketReference', () => {
  it('should identify existing tickets with code-number format', () => {
    const result = parseTicketReference('ABC-123');
    expect(result.isExisting).toBe(true);
    expect(result.projectKey).toBe('ABC');
  });

  it('should identify new tickets with only project code', () => {
    const result = parseTicketReference('ABC');
    expect(result.isExisting).toBe(false);
    expect(result.projectKey).toBe('ABC');
  });

  // Jira project keys may contain digits after the first letter (e.g. AB2C); AB2C-8 was wrongly rejected.
  it('should identify existing tickets whose project key contains digits', () => {
    const result = parseTicketReference('AB2C-8');
    expect(result.isExisting).toBe(true);
    expect(result.projectKey).toBe('AB2C');
  });

  it('should identify new tickets for a project key containing digits', () => {
    expect(parseTicketReference('AB2C')).toEqual({ isExisting: false, projectKey: 'AB2C' });
    const withTitle = parseTicketReference('AB2C-New Feature');
    expect(withTitle.isExisting).toBe(false);
    expect(withTitle.projectKey).toBe('AB2C');
    expect(withTitle.title).toBe('New Feature');
  });

  it('should identify new tickets with project code and title', () => {
    const result = parseTicketReference('ABC-New Feature');
    expect(result.isExisting).toBe(false);
    expect(result.projectKey).toBe('ABC');
    expect(result.title).toBe('New Feature');
  });
});

describe('isIssueKey', () => {
  it('accepts Jira keys whose project part has digits or underscores', () => {
    expect(isIssueKey('AB2C-8')).toBe(true);
    expect(isIssueKey(' ab2c-8 ')).toBe(true);
    expect(isIssueKey('MY_PROJ-12')).toBe(true);
  });

  it('rejects values that are not issue keys', () => {
    expect(isIssueKey('3D-8')).toBe(false);
    expect(isIssueKey('AB2C')).toBe(false);
    expect(isIssueKey('AB2C-New Feature')).toBe(false);
  });
});

describe('ISSUE_KEY_PREFIX_PATTERN', () => {
  it('splits an issue key from trailing text in a pasted cell', () => {
    const match = 'AB2C-8 fix login'.match(ISSUE_KEY_PREFIX_PATTERN);
    expect(match?.[1]).toBe('AB2C');
    expect(match?.[2]).toBe('8');
    expect(match?.[3].trim()).toBe('fix login');
  });
});

describe('groupNewTickets', () => {
  it('should group tickets with same project and title', () => {
    const entries: TimeEntry[] = [
      {
        id: '1',
        date: '2025-01-01',
        startTime: '09:00',
        endTime: '10:00',
        issue: 'ABC-Feature',
        description: 'Test',
      },
      {
        id: '2',
        date: '2025-01-01',
        startTime: '10:00',
        endTime: '11:00',
        issue: 'ABC-Feature',
        description: 'Test',
      },
    ];

    const groups = groupNewTickets(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].entryIds).toEqual(['1', '2']);
  });

  it('should not group existing tickets', () => {
    const entries: TimeEntry[] = [
      {
        id: '1',
        date: '2025-01-01',
        startTime: '09:00',
        endTime: '10:00',
        issue: 'ABC-123',
        description: 'Test',
      },
    ];

    const groups = groupNewTickets(entries);
    expect(groups).toHaveLength(0);
  });

  it('should group tickets case-insensitively', () => {
    const entries: TimeEntry[] = [
      {
        id: '1',
        date: '2025-01-01',
        startTime: '09:00',
        endTime: '10:00',
        issue: 'ABC-Feature',
        description: 'Test',
      },
      {
        id: '2',
        date: '2025-01-01',
        startTime: '10:00',
        endTime: '11:00',
        issue: 'ABC-feature',
        description: 'Test',
      },
    ];

    const groups = groupNewTickets(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
  });
});

describe('calculateDuration', () => {
  it('should calculate duration in seconds correctly', () => {
    const duration = calculateDuration('09:00', '10:00');
    expect(duration).toBe(3600);
  });

  it('should handle different time ranges', () => {
    const duration = calculateDuration('09:30', '11:45');
    expect(duration).toBe(8100);
  });

  it('should handle negative duration', () => {
    const duration = calculateDuration('10:00', '09:00');
    expect(duration).toBe(-3600);
  });
});

describe('validateTimeEntry', () => {
  it('should validate a correct entry', () => {
    const entry: TimeEntry = {
      id: '1',
      date: '2025-01-01',
      startTime: '09:00',
      endTime: '10:00',
      issue: 'ABC-123',
      description: 'Test',
    };

    const error = validateTimeEntry(entry);
    expect(error).toBeNull();
  });

  it('should reject entry without date', () => {
    const entry: TimeEntry = {
      id: '1',
      date: '',
      startTime: '09:00',
      endTime: '10:00',
      issue: 'ABC-123',
      description: 'Test',
    };

    const error = validateTimeEntry(entry);
    expect(error).toBe('Date is required');
  });

  it('should reject entry with invalid time range', () => {
    const entry: TimeEntry = {
      id: '1',
      date: '2025-01-01',
      startTime: '10:00',
      endTime: '09:00',
      issue: 'ABC-123',
      description: 'Test',
    };

    const error = validateTimeEntry(entry);
    expect(error).toBe('End time must be after start time');
  });

  it('should reject entry without valid ticket', () => {
    const entry: TimeEntry = {
      id: '1',
      date: '2025-01-01',
      startTime: '09:00',
      endTime: '10:00',
      issue: 'ABC',
      description: 'Test',
    };

    const error = validateTimeEntry(entry);
    expect(error).toBe('Ticket must have a valid key (e.g. ABC-123)');
  });
});
