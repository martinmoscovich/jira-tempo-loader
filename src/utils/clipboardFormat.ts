import { AppLocale, formatDate } from './locale';

/**
 * Example shown in the "Paste from Clipboard" help. Rows are the cells of a spreadsheet;
 * copying them gives tab-separated text, which is what the paste parser reads.
 * Dates follow the selected locale: DD/MM for 'es', MM/DD for 'en-US'.
 */
export const CLIPBOARD_COLUMNS = ['Date', 'Start', 'End', 'Duration', 'Ticket', 'Description'];

/** How the date column must be written for each locale. */
export const CLIPBOARD_DATE_FORMATS: Record<AppLocale, { short: string; full: string }> = {
  es: { short: 'DD/MM', full: 'DD/MM/YYYY' },
  'en-US': { short: 'MM/DD', full: 'MM/DD/YYYY' },
};

export const clipboardExampleRows = (locale: AppLocale): string[][] => [
  [formatDate('2026-11-03', locale, { withYear: false }), '', '', '', '', ''],
  ['', '09:00', '10:30', '1:30', 'ABC-123', 'Fix login bug'],
  ['', '10:30', '12:00', '1:30', 'ABC-124 Code review', ''],
  ['', '13:00', '17:00', '4:00', 'ABC-New Feature', 'Start the new feature'],
  [formatDate('2026-11-04', locale), '09:00', '17:00', '8:00', 'DEF', 'Planning'],
];

/** The example as the clipboard would hold it after copying the cells. */
export const clipboardExampleText = (locale: AppLocale): string =>
  clipboardExampleRows(locale)
    .map((row) => row.join('\t'))
    .join('\n');
