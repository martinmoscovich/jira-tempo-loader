import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { Box, Button, CircularProgress, Tooltip, Typography } from '@mui/material';
import { ColDef, FirstDataRenderedEvent, ICellRendererParams, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../config/agGridConfig';
import { useLocale } from '../context/LocaleContext';
import { useTimesheet } from '../context/TimesheetContext';
import { useGridExtensions } from '../ext/grid-ext-hook';
import { TimeEntry } from '../types';
import { calculateDuration, isIssueKey } from '../utils/ticketValidation';
import { IssueAutocompleteEditor } from './IssueAutocompleteEditor';
import { StatsModal } from './StatsModal';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-quartz.css';

const myTheme = themeQuartz.withParams({ spacing: 4, columnBorder: true });

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface TimesheetTableProps {
  validationMap?: Record<string, ValidationIssue[]>;
}

export const TimesheetTable: React.FC<TimesheetTableProps> = ({ validationMap }) => {
  const { entries, addEntry, updateEntry, deleteEntry } = useTimesheet();
  const { locale, formatDate } = useLocale();
  // Container Element used by the extension
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ref = useRef<AgGridReact | null>(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);

  const totalDuration = useMemo(() => {
    return entries.reduce((total, entry) => {
      if (entry.startTime && entry.endTime) {
        return total + calculateDuration(entry.startTime, entry.endTime);
      }
      return total;
    }, 0);
  }, [entries]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleAddRow = () => {
    const newEntry: TimeEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      issue: '',
      description: '',
    };
    addEntry(newEntry);
  };

  const [hasSelection, setHasSelection] = useState(false);

  const handleDeleteSelected = () => {
    let selection = selectionManager.current?.getSelection();
    if (!selection) {
      const selRow = ref.current?.api.getFocusedCell()?.rowIndex;
      if (selRow !== undefined) {
        selection = {
          maxRow: selRow,
          minRow: selRow,
          maxCol: 0,
          minCol: 0,
          isRange: false,
        };
      }
    }
    if (!selection) return;

    // Get all row IDs in the selected range
    const rowsToDelete: string[] = [];
    for (let i = selection.minRow; i <= selection.maxRow; i++) {
      const rowNode = ref.current?.api.getDisplayedRowAtIndex(i);
      if (rowNode?.data?.id) {
        rowsToDelete.push(rowNode.data.id);
      }
    }

    // Delete all selected rows
    rowsToDelete.forEach((id) => deleteEntry(id));

    // Clear selection
    selectionManager.current?.clear();
    setHasSelection(false);
  };

  const onCellValueChanged = useCallback(
    (event: any) => {
      const { data, colDef } = event;
      ref.current?.api.autoSizeAllColumns();
      if (colDef.field === 'date') {
        // Convert Date object to YYYY-MM-DD string
        const dateValue = event.newValue;
        if (dateValue instanceof Date) {
          const year = dateValue.getFullYear();
          const month = String(dateValue.getMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getDate()).padStart(2, '0');
          updateEntry(data.id, { date: `${year}-${month}-${day}` });
          return;
        }
      }
      updateEntry(data.id, { [colDef.field]: event.newValue });
    },
    [updateEntry]
  );

  const DateCellRenderer = (props: ICellRendererParams) => {
    const currentIndex = entries.findIndex((entry) => entry.id === props.data.id);
    if (currentIndex > 0) {
      const previousEntry = entries[currentIndex - 1];
      if (previousEntry.date === props.data.date) {
        return '';
      }
    }
    if (!props.value) return '';
    const [year, month, day] = props.value.split('-').map(Number);
    return formatDate(new Date(year, month - 1, day));
  };

  const TicketCellRenderer = (props: ICellRendererParams) => {
    const row = props.data;
    const displayValue = row.issue ?? '';
    const ticketToCheck = row.issue ?? '';

    // Determine color based on ticket status
    let color = 'inherit';

    if (row.isInvalid) {
      // Invalid ticket or project: red
      color = '#d32f2f';
    } else if (row.isNew) {
      // Newly created tickets: dark green
      color = '#2e7d32';
    } else if (!isIssueKey(ticketToCheck)) {
      // Not matching pattern: orange
      color = '#ed6c02';
    }

    return <span style={{ color, fontWeight: row.isInvalid ? 'bold' : 'normal' }}>{displayValue}</span>;
  };

  // Format time to HH:mm format, return empty string if invalid
  const formatTimeValue = (value: string): string => {
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
  };

  const StatusCellRenderer = (props: ICellRendererParams) => {
    const row = props.data;
    const status = row.uploadStatus || 'idle';

    // Upload statuses take priority
    if (status === 'uploading') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={20} />
        </Box>
      );
    }

    if (status === 'success') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircleIcon
            sx={{
              color: '#2e7d32',
              fontSize: 24,
              animation: 'fadeIn 0.3s ease-in',
              '@keyframes fadeIn': {
                from: { opacity: 0, transform: 'scale(0.5)' },
                to: { opacity: 1, transform: 'scale(1)' },
              },
            }}
          />
        </Box>
      );
    }

    if (status === 'error') {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d32f2f',
            fontSize: 24,
          }}
        >
          ✕
        </Box>
      );
    }

    // When not uploading, show validation status if validationMap is provided
    if (validationMap && row.id) {
      const issues = validationMap[row.id] || [];

      const hasError = issues.some((i) => i.severity === 'error');
      const hasWarning = issues.some((i) => i.severity === 'warning');
      const tooltipText = issues.map((i) => i.message).join(', ');

      if (hasError) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title={tooltipText}>
              <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
            </Tooltip>
          </Box>
        );
      }

      if (hasWarning) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title={tooltipText}>
              <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            </Tooltip>
          </Box>
        );
      }
    }

    return null;
  };

  const columns: ColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      minWidth: 100,
      width: 100,
      editable: true,
      cellEditor: 'agDateStringCellEditor',
      cellRenderer: DateCellRenderer,
    },
    {
      field: 'startTime',
      minWidth: 70,
      width: 70,
      headerName: 'Start',
      editable: true,
      valueSetter: (params) => {
        const formattedValue = formatTimeValue(params.newValue);
        params.data.startTime = formattedValue;
        return true;
      },
    },
    {
      field: 'endTime',
      minWidth: 70,
      width: 70,
      headerName: 'End',
      editable: true,
      valueSetter: (params) => {
        const formattedValue = formatTimeValue(params.newValue);
        params.data.endTime = formattedValue;
        return true;
      },
    },
    {
      field: 'duration',
      headerName: 'Duration',
      minWidth: 80,
      width: 80,
      editable: false,
      valueGetter: (params) => {
        const row = params.data;
        if (row.startTime && row.endTime) {
          const seconds = calculateDuration(row.startTime, row.endTime);
          return formatDuration(seconds);
        }
        return '';
      },
    },
    {
      field: 'issue',
      headerName: 'Ticket',
      minWidth: 150,
      editable: true,
      cellEditor: IssueAutocompleteEditor,
      cellRenderer: TicketCellRenderer,
      cellEditorParams: (params: any) => ({
        value: params.data.issue,
      }),
      valueSetter: (params) => {
        params.data.issue = params.newValue;
        params.data.isNew = false; // Reset isNew when issue changes manually
        return true;
      },
    },
    {
      field: 'description',
      headerName: 'Desc',
      minWidth: 300,
      editable: true,
    },
    {
      field: 'uploadStatus',
      headerName: 'Status',
      minWidth: 70,
      width: 70,
      editable: false,
      cellRenderer: StatusCellRenderer,
      suppressMovable: true,
    },
  ];

  // Resize the columns on first render
  const onFirstRender = (params: FirstDataRenderedEvent) => {
    params.api.sizeColumnsToFit();
  };

  // Event handlers to init and destroy the extensions
  const { mounted, extReady, onGridReady, onGridDestroy, selectionManager } = useGridExtensions(containerRef.current);

  // Listen to selection changes from RangeSelectionManager
  useEffect(() => {
    const handleSelectionChange = () =>
      setHasSelection((ref.current?.api.getFocusedCell() !== undefined || selectionManager.current?.hasSelection) ?? false);
    selectionManager.current?.addEventListener('selectionChange', handleSelectionChange);
    return () => selectionManager.current?.removeEventListener('selectionChange', handleSelectionChange);
  }, [extReady]);

  useEffect(() => {
    ref.current?.api?.refreshCells({ force: true });
  }, [entries, locale]);

  // Auto-scroll to uploading entry
  useEffect(() => {
    const uploadingEntry = entries.find((e) => e.uploadStatus === 'uploading');
    if (uploadingEntry && ref.current?.api) {
      const rowIndex = entries.findIndex((e) => e.id === uploadingEntry.id);
      if (rowIndex !== -1) {
        ref.current.api.ensureIndexVisible(rowIndex, 'middle');
      }
    }
  }, [entries]);

  // Row styling based on upload status
  const getRowStyle = useCallback((params: any) => {
    const status = params.data?.uploadStatus;
    if (status === 'uploading') {
      return { background: '#e3f2fd' }; // Light blue
    }
    if (status === 'success') {
      return { background: '#e8f5e9' }; // Light green
    }
    if (status === 'error') {
      return { background: '#fff3e0' }; // Light orange
    }
    return undefined;
  }, []);

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRow}>
            Add Entry
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleDeleteSelected} disabled={!hasSelection}>
            Delete
          </Button>
          <Button variant="outlined" startIcon={<BarChartIcon />} onClick={() => setStatsModalOpen(true)} disabled={entries.length === 0}>
            Statistics
          </Button>
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Total: {formatDuration(totalDuration)}
        </Typography>
      </Box>
      <div className="ag-theme-quartz" style={{ width: '100%' }} ref={containerRef}>
        {mounted && (
          <AgGridReact
            ref={ref}
            theme={myTheme}
            getRowId={(params) => params.data.id}
            rowData={entries}
            columnDefs={columns}
            onCellValueChanged={onCellValueChanged}
            singleClickEdit={false}
            stopEditingWhenCellsLoseFocus={true}
            domLayout="autoHeight"
            autoSizeStrategy={{ type: 'fitGridWidth' }}
            onFirstDataRendered={onFirstRender}
            onGridReady={onGridReady}
            onGridPreDestroyed={onGridDestroy}
            getRowStyle={getRowStyle}
          />
        )}
      </div>

      <StatsModal open={statsModalOpen} onClose={() => setStatsModalOpen(false)} />
    </Box>
  );
};
