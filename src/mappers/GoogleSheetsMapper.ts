import { format } from 'date-fns';
import { TimeEntryInput } from '../types';
import { ISSUE_KEY_PREFIX_PATTERN } from '../utils/ticketValidation';
import { IDataMapper } from './IDataMapper';

/**
 * Mapper for Google Sheets TSV format
 * Format: Date on its own line, then time entries for that date
 *
 * Example:
 * 3/11
 * 09:00  17:00  8:00  FETI-123  Working on feature
 * 4/11
 * 09:00  13:00  4:00  FETI-124  Bug fix
 * 13:00  17:00  4:00  FETI-125  Code review
 */
export class GoogleSheetsMapper implements IDataMapper {
  // Format time to HH:mm format, return empty string if invalid
  private formatTimeValue(value: string): string {
    if (!value) return '';

    // Remove any whitespace
    const trimmed = value.trim();

    // Match various time formats: HH:mm, HH:mm:ss, H:mm, etc.
    const timePattern = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
    const match = trimmed.match(timePattern);

    if (!match) {
      // Invalid format
      return '';
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    // Validate ranges
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return '';
    }

    // Format as HH:mm
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  importFromString(data: string): TimeEntryInput[] {
    const lines = data.trim().split('\n');
    const entries: TimeEntryInput[] = [];
    let currentDate = '';
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

    // Helper function to determine the year for a given month
    const getYearForMonth = (month: number, providedYear?: string): number => {
      if (providedYear) return parseInt(providedYear);

      // If we're in January (month 1) and the entry is from December (month 12),
      // assume it's from last year
      if (currentMonth === 1 && month === 12) {
        return currentYear - 1;
      }

      return currentYear;
    };

    // Detect if first line is a header
    let startIndex = 0;
    if (lines.length > 0) {
      const firstLineParts = lines[0].split('\t').map(cell => cell.trim());

      // Check if first column looks like a date
      const firstColIsDate = /^\d{1,2}[\/\-]\d{1,2}/.test(firstLineParts[0] || '');

      // Check if any column has time format (HH:mm)
      const hasTimeFormat = firstLineParts.some(part => /^\d{1,2}:\d{2}/.test(part));

      // Check if any column has ticket format (ABC-123)
      const hasTicketFormat = firstLineParts.some(part => ISSUE_KEY_PREFIX_PATTERN.test(part));

      // If it has header keywords OR doesn't look like data, assume it's a header
      if (!firstColIsDate && !hasTimeFormat && !hasTicketFormat) {
        startIndex = 1;
      }
    }

    lines.slice(startIndex).forEach((line) => {
      // Trim the entire line first to handle leading whitespace/tabs
      const trimmedLine = line.trim();
      const parts = trimmedLine.split('\t').map(cell => cell.trim());

      if (parts.length === 0 || !parts[0]) return;

      // Check if this line is a date (DD/MM or DD/MM/YYYY)
      const dateMatch = parts[0].match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);

      if (dateMatch && parts.length === 1) {
        // This is a date line (new format)
        const [, day, month, year] = dateMatch;
        const fullYear = getYearForMonth(parseInt(month), year);
        const parsedDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
        currentDate = format(parsedDate, 'yyyy-MM-dd');
        return;
      }

      // Check if first column is a date in old format (date + data in same line)
      if (dateMatch && parts.length >= 5) {
        // Old format: Date, Start, End, Duration, Issue, Description
        const [, day, month, year] = dateMatch;
        const fullYear = getYearForMonth(parseInt(month), year);
        const parsedDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
        currentDate = format(parsedDate, 'yyyy-MM-dd');

        // Process the rest of the line as a time entry
        const [, startTime, endTime, , issueCell = '', description = ''] = parts;

        const formattedStartTime = this.formatTimeValue(startTime);
        const formattedEndTime = this.formatTimeValue(endTime);

        let ticket = issueCell;
        let finalDescription = description;

        const ticketMatch = issueCell.match(ISSUE_KEY_PREFIX_PATTERN);
        if (ticketMatch) {
          ticket = `${ticketMatch[1]}-${ticketMatch[2]}`.toUpperCase();
          const extraText = ticketMatch[3].trim();
          if (extraText) {
            finalDescription = extraText;
          }
        }

        entries.push({
          fecha: currentDate,
          horaInicio: formattedStartTime,
          horaFin: formattedEndTime,
          ticket: ticket || '',
          descripcion: finalDescription,
        });
        return;
      }

      // This is a time entry line (new format)
      // Format: Hora Inicio, Hora Fin, Duracion (skip), Tarea, Descripcion
      if (parts.length < 2) return;

      const [startTime, endTime, , issueCell = '', description = ''] = parts;

      if (!currentDate) return;

      const formattedStartTime = this.formatTimeValue(startTime);
      const formattedEndTime = this.formatTimeValue(endTime);

      // Parse issue cell to separate ticket key from description
      let ticket = issueCell;
      let finalDescription = description;

      const ticketMatch = issueCell.match(ISSUE_KEY_PREFIX_PATTERN);
      if (ticketMatch) {
        ticket = `${ticketMatch[1]}-${ticketMatch[2]}`.toUpperCase();
        const extraText = ticketMatch[3].trim();

        // If there's text after the ticket number, use it as description
        if (extraText) {
          finalDescription = extraText;
        }
      }

      entries.push({
        fecha: currentDate,
        horaInicio: formattedStartTime,
        horaFin: formattedEndTime,
        ticket: ticket || '',
        descripcion: finalDescription,
      });
    });

    return entries;
  }

  exportToString(entries: TimeEntryInput[]): string {
    if (entries.length === 0) {
      return '';
    }

    const lines: string[] = [];
    let lastDate = '';

    // Helper function to calculate duration in HH:mm format
    const calculateDurationString = (startTime: string, endTime: string): string => {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const durationMinutes = endMinutes - startMinutes;

      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;

      return `${hours}:${String(minutes).padStart(2, '0')}`;
    };

    // Helper function to format date from YYYY-MM-DD to DD/MM
    const formatDate = (dateStr: string): string => {
      const [, month, day] = dateStr.split('-');
      return `${day}/${month}`;
    };

    entries.forEach(entry => {
      const formattedDate = formatDate(entry.fecha);

      // Add date line if it's a new date (with trailing tabs to match Google Sheets format)
      if (formattedDate !== lastDate) {
        lines.push(formattedDate + '\t\t\t\t');
        lastDate = formattedDate;
      }

      const duration = calculateDurationString(entry.horaInicio, entry.horaFin);

      // Format: Leading tab, Hora Inicio, Hora Fin, Duracion, Tarea, Descripcion
      const line = '\t' + [
        entry.horaInicio,
        entry.horaFin,
        duration,
        entry.ticket,
        entry.descripcion || ''
      ].join('\t');

      lines.push(line);
    });

    return lines.join('\n');
  }
}
