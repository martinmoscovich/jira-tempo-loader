import { TimeEntry } from '../types';
import { mapTimeEntryInputsToTimeEntries } from './timeEntryMapper';
import { GoogleSheetsMapper } from '../mappers/GoogleSheetsMapper';

// Create a singleton instance of the mapper
const googleSheetsMapper = new GoogleSheetsMapper();

/**
 * Parses Google Sheets data directly to TimeEntry
 */
export const parseGoogleSheetsData = (csvText: string): TimeEntry[] => {
  const inputs = googleSheetsMapper.importFromString(csvText);
  return mapTimeEntryInputsToTimeEntries(inputs);
};

export const handleFileImport = (file: File): Promise<TimeEntry[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const entries = parseGoogleSheetsData(text);
        resolve(entries);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Error reading the file'));
    reader.readAsText(file);
  });
};

export const parseClipboardData = (clipboardText: string): TimeEntry[] => {
  return parseGoogleSheetsData(clipboardText);
};

/**
 * Exports time entries to clipboard in TSV format compatible with Google Sheets
 * Format: Date on its own line, then time entries for that date
 */
export const exportToClipboard = async (entries: TimeEntry[]): Promise<void> => {
  if (entries.length === 0) {
    throw new Error('No entries to export');
  }

  // Convert TimeEntry to TimeEntryInput format
  const inputs = entries.map(entry => ({
    fecha: entry.date,
    horaInicio: entry.startTime,
    horaFin: entry.endTime,
    ticket: entry.issue,
    descripcion: entry.description || '',
  }));

  // Use the mapper to export to string
  const tsvContent = googleSheetsMapper.exportToString(inputs);

  // Copy to clipboard
  await navigator.clipboard.writeText(tsvContent);
};
