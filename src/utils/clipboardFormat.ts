/**
 * Example shown in the "Paste from Clipboard" help. Rows are the cells of a spreadsheet;
 * copying them gives tab-separated text, which is what the paste parser reads.
 */
export const CLIPBOARD_COLUMNS = ['Date', 'Start', 'End', 'Duration', 'Ticket', 'Description'];

export const CLIPBOARD_EXAMPLE_ROWS: string[][] = [
  ['03/11', '', '', '', '', ''],
  ['', '09:00', '10:30', '1:30', 'ABC-123', 'Fix login bug'],
  ['', '10:30', '12:00', '1:30', 'ABC-124 Code review', ''],
  ['', '13:00', '17:00', '4:00', 'ABC-New Feature', 'Start the new feature'],
  ['04/11/2026', '09:00', '17:00', '8:00', 'DEF', 'Planning'],
];

/** The example as the clipboard would hold it after copying the cells. */
export const clipboardExampleText = (): string =>
  CLIPBOARD_EXAMPLE_ROWS.map((row) => row.join('\t')).join('\n');
