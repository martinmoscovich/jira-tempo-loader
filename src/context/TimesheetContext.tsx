import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TimeEntry, TicketValidationGroup } from '../types';

interface TimesheetContextType {
  entries: TimeEntry[];
  validationGroups: TicketValidationGroup[];
  addEntry: (entry: TimeEntry) => void;
  updateEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteEntry: (id: string) => void;
  setEntries: (entries: TimeEntry[]) => void;
  setValidationGroups: (groups: TicketValidationGroup[]) => void;
  updateValidationGroup: (groupKey: string, updates: Partial<TicketValidationGroup>) => void;
}

const TimesheetContext = createContext<TimesheetContextType | undefined>(undefined);

export const TimesheetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [entries, setEntriesState] = useState<TimeEntry[]>([]);
  const [validationGroups, setValidationGroupsState] = useState<TicketValidationGroup[]>([]);

  const addEntry = (entry: TimeEntry) => {
    setEntriesState((prev) => [...prev, entry]);
    // Clear validation groups when adding a new entry
    setValidationGroupsState([]);
  };

  const updateEntry = (id: string, updates: Partial<TimeEntry>) => {
    setEntriesState((prev) =>
      prev.map((entry) => {
        if (entry.id === id) {
          // If the issue field is being updated, clear the finalIssueKey and validation groups
          if (updates.issue !== undefined && updates.issue !== entry.issue) {
            setValidationGroupsState([]);
            return { ...entry, ...updates, finalIssueKey: undefined };
          }
          return { ...entry, ...updates };
        }
        return entry;
      })
    );
  };

  const deleteEntry = (id: string) => {
    setEntriesState((prev) => prev.filter((entry) => entry.id !== id));
    // Clear validation groups when deleting an entry
    setValidationGroupsState([]);
  };

  const setEntries = (entries: TimeEntry[]) => {
    setEntriesState(entries);
  };

  const setValidationGroups = (groups: TicketValidationGroup[]) => {
    setValidationGroupsState(groups);
  };

  const updateValidationGroup = (groupKey: string, updates: Partial<TicketValidationGroup>) => {
    setValidationGroupsState((prev) =>
      prev.map((group) => (group.groupKey === groupKey ? { ...group, ...updates } : group))
    );
  };

  return (
    <TimesheetContext.Provider
      value={{
        entries,
        validationGroups,
        addEntry,
        updateEntry,
        deleteEntry,
        setEntries,
        setValidationGroups,
        updateValidationGroup,
      }}
    >
      {children}
    </TimesheetContext.Provider>
  );
};

export const useTimesheet = () => {
  const context = useContext(TimesheetContext);
  if (!context) {
    throw new Error('useTimesheet must be used within TimesheetProvider');
  }
  return context;
};
