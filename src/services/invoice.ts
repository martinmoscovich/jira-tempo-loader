import { addDays, lastDayOfMonth } from 'date-fns';
import { EpicEntry } from '../components/TempoReportImport';
import { formatUrlDate } from '../utils/date';

const INVOICE_APP_URL = 'https://sljavi.github.io/free-invoice';

export function generateInvoiceRows(entries: EpicEntry[]) {
  return entries.map((entry) => ({
    description: `${entry.project}${entry.code ? ` - ${entry.code}` : ''}, ${entry.hours}h @ $${entry.hourlyRate}/hour`,
    price: entry.total.toFixed(2),
  }));
}

export function generateInvoiceUrl(
  rows: Array<{ description: string; price: string }>,
  date: Date | undefined,
) {
  const params: Record<string, string> = {};
  if (date) {
    params.date = formatUrlDate(lastDayOfMonth(date));
    params.duedate = formatUrlDate(addDays(lastDayOfMonth(date), 10));
  }
  if (rows)
    params['rows'] = rows.map((r) => `${r.description}|${r.price}`).join('||');

  return `${INVOICE_APP_URL}?${new URLSearchParams(params).toString()}`;
}
