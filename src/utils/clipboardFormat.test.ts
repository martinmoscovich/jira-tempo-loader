import { describe, expect, it } from 'vitest';
import { clipboardExampleText } from './clipboardFormat';
import { parseClipboardData } from './googleSheets';

// The help dialog offers this example to copy; it must import exactly as the dialog explains.
describe('clipboard format example', () => {
  it('parses into the entries the help describes', () => {
    const year = new Date().getFullYear();
    const entries = parseClipboardData(clipboardExampleText());
    expect(entries.map(({ date, startTime, endTime, issue, description }) => ({
      date,
      startTime,
      endTime,
      issue,
      description,
    }))).toEqual([
      { date: `${year}-11-03`, startTime: '09:00', endTime: '10:30', issue: 'ABC-123', description: 'Fix login bug' },
      { date: `${year}-11-03`, startTime: '10:30', endTime: '12:00', issue: 'ABC-124', description: 'Code review' },
      { date: `${year}-11-03`, startTime: '13:00', endTime: '17:00', issue: 'ABC-New Feature', description: 'Start the new feature' },
      { date: '2026-11-04', startTime: '09:00', endTime: '17:00', issue: 'DEF', description: 'Planning' },
    ]);
  });
});
