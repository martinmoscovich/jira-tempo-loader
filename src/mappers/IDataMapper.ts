import { TimeEntryInput } from '../types';
import { AppLocale } from '../utils/locale';

/**
 * Interface for data mappers that convert between string formats and TimeEntryInput
 */
export interface IDataMapper {
  /**
   * Parses a string (TSV, CSV, etc.) into TimeEntryInput array
   * @param data - The string data to parse
   * @param locale - Date order of the data: 'es' is DD/MM, 'en-US' is MM/DD
   * @returns Array of TimeEntryInput
   */
  importFromString(data: string, locale?: AppLocale): TimeEntryInput[];

  /**
   * Exports TimeEntryInput array to a string format (TSV, CSV, etc.)
   * @param entries - Array of TimeEntryInput to export
   * @param locale - Date order to write: 'es' is DD/MM, 'en-US' is MM/DD
   * @returns Formatted string ready to be copied or saved
   */
  exportToString(entries: TimeEntryInput[], locale?: AppLocale): string;
}
