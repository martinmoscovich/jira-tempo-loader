import { describe, it, expect } from 'vitest';
import { parseGoogleSheetsData } from './googleSheets';

describe('parseGoogleSheetsData', () => {
  it('should parse CSV data with full dates', () => {
    const csv = `Fecha\tHora Inicio\tHora Fin\tTicket\tDescripción
01/01/2025\t09:00\t10:00\tABC-123\tTest task
\t10:00\t11:00\tABC-124\tAnother task`;

    const entries = parseGoogleSheetsData(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0].date).toBe('2025-01-01');
    expect(entries[0].issue).toBe('ABC-123');
    expect(entries[1].date).toBe('2025-01-01');
  });

  it('should parse dates without year using current year', () => {
    const currentYear = new Date().getFullYear();
    const csv = `Fecha\tHora Inicio\tHora Fin\tTicket\tDescripción
15/03\t09:00\t10:00\tABC-123\tTest task`;

    const entries = parseGoogleSheetsData(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe(`${currentYear}-03-15`);
  });

  it('should handle tickets with project code and title', () => {
    const csv = `Fecha\tHora Inicio\tHora Fin\tTicket\tDescripción\tTítulo
01/01/2025\t09:00\t10:00\tABC\tTest task\tNew Feature`;

    const entries = parseGoogleSheetsData(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].issue).toBe('ABC-New Feature');
  });

  it('should skip rows with incomplete data', () => {
    const csv = `Fecha\tHora Inicio\tHora Fin\tTicket\tDescripción
01/01/2025\t09:00\t\tABC-123\tTest task
01/01/2025\t09:00\t10:00\tABC-124\tValid task`;

    const entries = parseGoogleSheetsData(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].issue).toBe('ABC-124');
  });

  it('should carry forward date to subsequent rows', () => {
    const csv = `Fecha\tHora Inicio\tHora Fin\tTicket\tDescripción
01/01/2025\t09:00\t10:00\tABC-123\tTask 1
\t10:00\t11:00\tABC-124\tTask 2
\t11:00\t12:00\tABC-125\tTask 3`;

    const entries = parseGoogleSheetsData(csv);
    expect(entries).toHaveLength(3);
    expect(entries[0].date).toBe('2025-01-01');
    expect(entries[1].date).toBe('2025-01-01');
    expect(entries[2].date).toBe('2025-01-01');
  });
});
