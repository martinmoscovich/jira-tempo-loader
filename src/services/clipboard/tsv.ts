/**
 * Parses a Tab-separated values (TSV) text into an array of arrays of string (an item for each cell)
 *
 * Features:
 *  - Tabs (\t) to separate column inside a row
 *  - New lines (\n) to separate rows
 *  - Double quotes (") to escape fields with special chars (tabs or new lines)
 *  - Escapes double quotes as well
 */
export function parseTSV(text: string): string[][] {
  if (text === '') return [['']];

  // Normalize new line
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  const row = [];
  const len = text.length;
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < len; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === '\t') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        // Copy the row and resets
        rows.push(row.splice(0));
        field = '';
      } else field += ch;
    }
  }

  // Last time if it doesn't end in newline
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Serialize an array of arrays of string into a Tab-separated values (TSV) text
 *
 * Features:
 *  - Escapes fields with tab, newline or double quotes
 */
export function serializeTSV(values: string[][]) {
  const hasSpecialChar = (str: string) => str.includes('\t') || str.includes('\n') || str.includes('"');
  return (
    values
      .map((row) =>
        row
          .map((str) => (hasSpecialChar(str) ? `"${str.replace(/"/g, '""')}"` : str))
          // Joins the cells into a row
          .join('\t')
      )
      // Join the rows
      .join('\n')
  );
}