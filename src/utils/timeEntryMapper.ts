import { TimeEntry, TimeEntryInput } from '../types';

/**
 * Converts a TimeEntryInput to a TimeEntry (internal model used by the grid)
 * @param input - The input data from any source (Excel, clipboard, etc.)
 * @returns A TimeEntry ready to be used in the grid
 */
export function mapTimeEntryInputToTimeEntry(input: TimeEntryInput): TimeEntry {
  return {
    id: crypto.randomUUID(),
    date: input.fecha,
    startTime: input.horaInicio,
    endTime: input.horaFin,
    issue: input.ticket,
    description: input.descripcion,
  };
}

/**
 * Converts an array of TimeEntryInput to an array of TimeEntry
 * @param inputs - Array of input data
 * @returns Array of TimeEntry ready to be used in the grid
 */
export function mapTimeEntryInputsToTimeEntries(inputs: TimeEntryInput[]): TimeEntry[] {
  return inputs.map(mapTimeEntryInputToTimeEntry);
}
