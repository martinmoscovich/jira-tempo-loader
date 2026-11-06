import AssessmentIcon from '@mui/icons-material/Assessment';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Snackbar,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTimesheet } from '../../context/TimesheetContext';
import { loadAuthConfig } from '../../utils/auth';
import { exportToClipboard, parseClipboardData } from '../../utils/googleSheets';
import { ClipboardFormatHelpDialog } from '../ClipboardFormatHelpDialog';
import { TempoReportImport } from '../TempoReportImport';
import { TimesheetTable } from '../TimesheetTable';

interface DataEntryStepProps {
  onContinue: () => void;
}

export const DataEntryStep: React.FC<DataEntryStepProps> = ({ onContinue }) => {
  const { entries, setEntries } = useTimesheet();
  const { authState } = useAuth();
  const [formatHelpOpen, setFormatHelpOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handlePasteClick = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const parsedEntries = parseClipboardData(clipboardText);
      setEntries(parsedEntries);
      setSnackbar({
        open: true,
        message: `${parsedEntries.length} entries imported successfully`,
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error processing clipboard data. Check the format.',
        severity: 'error',
      });
    }
  };

  const handleCopyClick = async () => {
    try {
      await exportToClipboard(entries);
      setSnackbar({
        open: true,
        message: 'Data copied to clipboard',
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error copying data to clipboard.',
        severity: 'error',
      });
    }
  };

  const handleOpenTempoReport = () => {
    const isMockMode = authState.accessToken === 'mock-access-token';
    if (!authState.user || isMockMode) return;

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let firstDay: Date;
    let lastDay: Date;

    if (entries.length > 0) {
      // Use the month from the loaded entries
      const entryDate = new Date(entries[0].date);
      firstDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1);
      lastDay = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0);
    } else {
      // No entries: use the full previous month
      const now = new Date();
      firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const from = formatDate(firstDay);
    const to = formatDate(lastDay);
    const workerId = authState.user.accountId;

    const config = loadAuthConfig();
    if (config?.jiraUrl) {
      const encodedWorkerId = encodeURIComponent(workerId);
      const url = `${config.jiraUrl}plugins/servlet/ac/io.tempo.jira/tempo-app#!/reports/logged-time?columns=TOTAL_TIME_COLUMN&dateDisplayType=days&excludeInternalIssues=false&from=${from}&groupBy=project&groupBy=ithl_1&groupBy=issue&includeRejectedRecords=false&includeSubtasks=false&periodKey&periodType=LAST_PERIOD&subPeriodType=MONTH&to=${to}&viewType=TIMESHEET&workerId=${encodedWorkerId}`;
      window.open(url, '_blank');
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const isMockMode = authState.accessToken === 'mock-access-token';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header - Fixed */}
      <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Data Entry
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Import your hours from the clipboard or Tempo, or add them manually
        </Typography>
      </Box>

      {/* Import Actions - Fixed */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<ContentPasteIcon />}
            onClick={handlePasteClick}
          >
            Paste from Clipboard
          </Button>
          <Tooltip title="Clipboard format">
            <IconButton
              size="small"
              onClick={() => setFormatHelpOpen(true)}
              aria-label="Show the clipboard format"
              sx={{ ml: 0.5 }}
            >
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <ClipboardFormatHelpDialog open={formatHelpOpen} onClose={() => setFormatHelpOpen(false)} />

        <TempoReportImport />

        <Box sx={{ flex: 1 }} />

        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopyClick}
          disabled={entries.length === 0}
        >
          Copy
        </Button>

        <Button
          variant="outlined"
          startIcon={<AssessmentIcon />}
          onClick={handleOpenTempoReport}
          disabled={isMockMode}
        >
          View Tempo Report
        </Button>
      </Box>

      {/* Table - Scrollable */}
      <Box sx={{ flex: 1, minHeight: 0, mb: 3, overflowY: 'auto' }}>
        <TimesheetTable />
      </Box>

      {/* Continue Button - Sticky */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        pt: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
        bgcolor: 'background.paper'
      }}>
        <Button
          variant="contained"
          size="large"
          onClick={onContinue}
          disabled={entries.length === 0}
        >
          Continue to Validate Tickets
        </Button>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
