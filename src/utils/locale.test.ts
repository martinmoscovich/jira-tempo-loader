import { describe, expect, it } from 'vitest';
import { formatAmount, formatDate, formatNumber, isAppLocale } from './locale';

describe('formatDate', () => {
  it('puts the day first in es and the month first in en-US', () => {
    expect(formatDate('2026-11-05', 'es')).toBe('05/11/2026');
    expect(formatDate('2026-11-05', 'en-US')).toBe('11/05/2026');
  });

  // Entry dates are 'yyyy-MM-dd'; parsing them as UTC would show the previous day west of UTC.
  it('keeps the stored calendar day regardless of timezone', () => {
    expect(formatDate('2026-01-01', 'es')).toBe('01/01/2026');
  });

  it('can omit the year', () => {
    expect(formatDate('2026-11-05', 'es', { withYear: false })).toBe('05/11');
    expect(formatDate('2026-11-05', 'en-US', { withYear: false })).toBe('11/05');
  });
});

describe('formatNumber / formatAmount', () => {
  it('uses comma decimals and dot grouping in es', () => {
    expect(formatNumber(7.5, 'es')).toBe('7,5');
    expect(formatAmount(12345.5, 'es')).toBe('12.345,50');
  });

  it('uses dot decimals and comma grouping in en-US', () => {
    expect(formatNumber(7.5, 'en-US')).toBe('7.5');
    expect(formatAmount(12345.5, 'en-US')).toBe('12,345.50');
  });
});

describe('isAppLocale', () => {
  it('accepts only the supported locales', () => {
    expect(isAppLocale('es')).toBe(true);
    expect(isAppLocale('en-US')).toBe(true);
    expect(isAppLocale('en-GB')).toBe(false);
    expect(isAppLocale(null)).toBe(false);
  });
});
