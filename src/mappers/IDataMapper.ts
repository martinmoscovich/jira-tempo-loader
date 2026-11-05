import { TimeEntryInput } from '../types';

/**
 * Interface for data mappers that convert between string formats and TimeEntryInput
 */
export interface IDataMapper {
  /**
   * Parses a string (TSV, CSV, etc.) into TimeEntryInput array
   * @param data - The string data to parse
   * @returns Array of TimeEntryInput
   */
  importFromString(data: string): TimeEntryInput[];

  /**
   * Exports TimeEntryInput array to a string format (TSV, CSV, etc.)
   * @param entries - Array of TimeEntryInput to export
   * @returns Formatted string ready to be copied or saved
   */
  exportToString(entries: TimeEntryInput[]): string;
}
