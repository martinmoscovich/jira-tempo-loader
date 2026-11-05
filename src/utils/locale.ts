import { format } from 'date-fns';

export type AppLocale = 'es' | 'en-US';

export const APP_LOCALES: { value: AppLocale; label: string }[] = [
  { value: 'es', label: 'ES' },
  { value: 'en-US', label: 'EN-US' },
];

export const DEFAULT_LOCALE: AppLocale = 'es';

export const isAppLocale = (value: unknown): value is AppLocale =>
  APP_LOCALES.some((option) => option.value === value);

/**
 * Entry dates are stored as 'yyyy-MM-dd'. `new Date('yyyy-MM-dd')` parses them as UTC midnight,
 * which shows the previous day in timezones west of UTC, so build the date in local time.
 */
const toLocalDate = (value: string | Date): Date => {
  if (value instanceof Date) return value;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
};

// Explicit patterns instead of Intl: ICU drops the leading zero for es when the year is omitted ("5/11").
const DATE_PATTERNS: Record<AppLocale, { full: string; short: string }> = {
  es: { full: 'dd/MM/yyyy', short: 'dd/MM' },
  'en-US': { full: 'MM/dd/yyyy', short: 'MM/dd' },
};

/** Formats a date as numeric day/month(/year) in the locale's order (es: 05/11/2026, en-US: 11/05/2026). */
export const formatDate = (
  value: string | Date,
  locale: AppLocale,
  { withYear = true }: { withYear?: boolean } = {}
): string => {
  const date = toLocalDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const patterns = DATE_PATTERNS[locale];
  return format(date, withYear ? patterns.full : patterns.short);
};

/** Formats a number with the locale's decimal and grouping separators. */
export const formatNumber = (
  value: number,
  locale: AppLocale,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }
): string => value.toLocaleString(locale, options);

/** Formats an amount with exactly two decimals (no currency symbol; callers add "$"). */
export const formatAmount = (value: number, locale: AppLocale): string =>
  formatNumber(value, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
