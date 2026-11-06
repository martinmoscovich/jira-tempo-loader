import { describe, expect, it } from 'vitest';
import { AppLocale } from './locale';
import { clipboardExampleRows, clipboardExampleText } from './clipboardFormat';
import { parseClipboardData } from './googleSheets';

// The help dialog offers this example to copy; it must import exactly as the dialog explains,
// in the date order of the selected locale.
describe.each<[AppLocale, string, string]>([
  ['es', '03/11', '04/11/2026'],
  ['en-US', '11/03', '11/04/2026'],
])('clipboard format example (%s)', (locale, shortDate, fullDate) => {
  it('writes dates in the locale order', () => {
    const rows = clipboardExampleRows(locale);
    expect(rows[0][0]).toBe(shortDate);
    expect(rows[4][0]).toBe(fullDate);
  });

  it('parses into the entries the help describes', () => {
    const year = new Date().getFullYear();
    const entries = parseClipboardData(clipboardExampleText(locale), locale);
    expect(
      entries.map(({ date, startTime, endTime, issue, description }) => ({
        date,
        startTime,
        endTime,
        issue,
        description,
      }))
    ).toEqual([
      { date: `${year}-11-03`, startTime: '09:00', endTime: '10:30', issue: 'ABC-123', description: 'Fix login bug' },
      { date: `${year}-11-03`, startTime: '10:30', endTime: '12:00', issue: 'ABC-124', description: 'Code review' },
      { date: `${year}-11-03`, startTime: '13:00', endTime: '17:00', issue: 'ABC-New Feature', description: 'Start the new feature' },
      { date: '2026-11-04', startTime: '09:00', endTime: '17:00', issue: 'DEF', description: 'Planning' },
    ]);
  });
});
