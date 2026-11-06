import { describe, it, expect } from 'vitest';
import { GoogleSheetsMapper } from '../mappers/GoogleSheetsMapper';
import { parseGoogleSheetsData } from './googleSheets';

// Sheet layout (same one the export writes): a date row, then rows of
// Start, End, Duration, Ticket, Description. The date may also share the row with the data.
describe('parseGoogleSheetsData', () => {
  it('parses a date row followed by entry rows', () => {
    const tsv = `01/01/2025\t\t\t\t
\t09:00\t10:00\t1:00\tABC-123\tTest task
\t10:00\t11:30\t1:30\tABC-124\tAnother task`;

    const entries = parseGoogleSheetsData(tsv);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      date: '2025-01-01',
      startTime: '09:00',
      endTime: '10:00',
      issue: 'ABC-123',
      description: 'Test task',
    });
    expect(entries[1]).toMatchObject({ date: '2025-01-01', issue: 'ABC-124', endTime: '11:30' });
  });

  it('skips the header row and accepts the date on the same row as the data', () => {
    const tsv = `Date\tStart\tEnd\tDuration\tTicket\tDescription
01/01/2025\t09:00\t10:00\t1:00\tABC-123\tTest task
\t10:00\t11:00\t1:00\tABC-124\tCarried date`;

    const entries = parseGoogleSheetsData(tsv);
    expect(entries.map((e) => [e.date, e.issue])).toEqual([
      ['2025-01-01', 'ABC-123'],
      ['2025-01-01', 'ABC-124'],
    ]);
  });

  it('uses the current year when the date has none', () => {
    const currentYear = new Date().getFullYear();
    const entries = parseGoogleSheetsData(`15/03\n\t09:00\t10:00\t1:00\tABC-123\tTest task`);
    expect(entries[0].date).toBe(`${currentYear}-03-15`);
  });

  it('keeps new-ticket references (project or project-title) as typed', () => {
    const entries = parseGoogleSheetsData(`01/01/2025
\t09:00\t10:00\t1:00\tABC\tWork
\t10:00\t11:00\t1:00\tABC-New Feature\tWork`);
    expect(entries.map((e) => e.issue)).toEqual(['ABC', 'ABC-New Feature']);
  });

  it('splits "KEY-123 text" into the ticket and the description', () => {
    const entries = parseGoogleSheetsData(`01/01/2025\n\t09:00\t10:00\t1:00\tab2c-8 fix login\t`);
    expect(entries[0]).toMatchObject({ issue: 'AB2C-8', description: 'fix login' });
  });

  // Incomplete rows are kept with the bad field empty so validation shows them to the user,
  // instead of silently dropping hours from the timesheet.
  it('keeps rows with an invalid time, leaving that time empty', () => {
    const entries = parseGoogleSheetsData(`01/01/2025
\t09:00\t\t\tABC-123\tMissing end
\t09:00\t25:00\t\tABC-124\tBad end`);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.endTime)).toEqual(['', '']);
  });

  it('ignores entry rows before the first date', () => {
    expect(parseGoogleSheetsData(`\t09:00\t10:00\t1:00\tABC-123\tNo date`)).toEqual([]);
  });
});

describe('parseGoogleSheetsData with en-US dates (MM/DD)', () => {
  it('reads the month first, with and without a year', () => {
    const currentYear = new Date().getFullYear();
    const entries = parseGoogleSheetsData(
      `03/15
\t09:00\t10:00\t1:00\tABC-1\tA
11/04/2026\t09:00\t17:00\t8:00\tABC-2\tB`,
      'en-US'
    );
    expect(entries.map((e) => e.date)).toEqual([`${currentYear}-03-15`, '2026-11-04']);
  });

  // With the wrong format selected, "15/03" would otherwise roll over into a date in 2027.
  it('rejects a date that is not valid in the selected order', () => {
    expect(() => parseGoogleSheetsData(`15/03\n\t09:00\t10:00\t1:00\tABC-1\tA`, 'en-US')).toThrow(
      /"15\/03" is not a valid date in MM\/DD/
    );
    expect(() => parseGoogleSheetsData(`03/15\n\t09:00\t10:00\t1:00\tABC-1\tA`, 'es')).toThrow(
      /"03\/15" is not a valid date in DD\/MM/
    );
    expect(() => parseGoogleSheetsData(`31/02/2025\t09:00\t10:00\t1:00\tABC-1\tA`)).toThrow(/not a valid date/);
  });

  it('defaults to es (DD/MM)', () => {
    expect(parseGoogleSheetsData(`15/03/2025\n\t09:00\t10:00\t1:00\tABC-1\tA`)[0].date).toBe('2025-03-15');
  });
});

describe.each(['es', 'en-US'] as const)('GoogleSheetsMapper round trip (%s)', (locale) => {
  it('imports what it exports', () => {
    const mapper = new GoogleSheetsMapper();
    // Day > 12 so a swapped day/month cannot round-trip by accident.
    const inputs = [
      { fecha: '2025-03-15', horaInicio: '09:00', horaFin: '10:30', ticket: 'ABC-1', descripcion: 'A' },
      { fecha: '2025-03-15', horaInicio: '10:30', horaFin: '12:00', ticket: 'ABC', descripcion: 'B' },
      { fecha: '2025-03-16', horaInicio: '09:00', horaFin: '17:00', ticket: 'DEF-2', descripcion: '' },
    ];
    const exported = mapper.exportToString(inputs, locale);
    expect(exported.split('\n')[0]).toMatch(locale === 'es' ? /^15\/03\t/ : /^03\/15\t/);
    // Exported dates have no year, so compare against the year the importer assumes.
    const year = new Date().getFullYear();
    const withImportYear = inputs.map((i) => ({ ...i, fecha: i.fecha.replace('2025', String(year)) }));
    expect(mapper.importFromString(exported, locale)).toEqual(withImportYear);
  });
});
