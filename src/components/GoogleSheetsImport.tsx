import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import VerifiedIcon from '@mui/icons-material/Verified';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useTimesheet } from '../context/TimesheetContext';
import { loadAuthConfig } from '../utils/auth';
import { exportToClipboard, parseClipboardData } from '../utils/googleSheets';
import { calculateDuration } from '../utils/ticketValidation';
import { TempoReportImport } from './TempoReportImport';
import { TicketValidationDialog } from './TicketValidationDialog';

export const GoogleSheetsImport: React.FC = () => {
  const { entries, setEntries, updateEntry } = useTimesheet();
  const { locale } = useLocale();
  const { authState, tempoApi } = useAuth();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [ticketsValidated, setTicketsValidated] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePasteClick = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const parsedEntries = parseClipboardData(clipboardText, locale);
      setEntries(parsedEntries);
      setTicketsValidated(false);
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
      await exportToClipboard(entries, locale);
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

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Check if in mock mode
  const isMockMode = authState.accessToken === 'mock-access-token';

  const handleOpenTempoReport = () => {
    if (!authState.user || isMockMode) return;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const from = formatDate(firstDay);
    const to = formatDate(lastDay);
    const workerId = authState.user.accountId;

    const config = loadAuthConfig();
    if (config?.jiraUrl) {
      const url = `${config?.jiraUrl}plugins/servlet/ac/io.tempo.jira/tempo-app#!/reports/logged-time?columns=TOTAL_TIME_COLUMN&dateDisplayType=days&from=${from}&groupBy=project&groupBy=ithl_1&groupBy=issue&includeSubtasks=false&periodKey&periodType=CURRENT_PERIOD&subPeriodType=MONTH&to=${to}&viewType=TIMESHEET&workerId=${workerId}`;
      window.open(url, '_blank');
    }
  };

  const handleValidateTickets = () => {
    setValidationDialogOpen(true);
  };

  const handleValidationComplete = () => {
    setTicketsValidated(true);
  };

  const handleUploadToTempo = async () => {
    if (!tempoApi || !authState.user) {
      setSnackbar({
        open: true,
        message: 'No active session',
        severity: 'error',
      });
      return;
    }

    setUploading(true);

    try {
      for (const entry of entries) {
        // Set entry status to uploading
        updateEntry(entry.id, { uploadStatus: 'uploading' });

        const issueKey = entry.issue;
        const duration = calculateDuration(entry.startTime, entry.endTime);

        try {
          await tempoApi.createWorklog({
            issueKey,
            timeSpentSeconds: duration,
            startDate: entry.date,
            startTime: entry.startTime,
            description: entry.description,
            authorAccountId: authState.user.accountId,
          });

          // Set entry status to success
          updateEntry(entry.id, { uploadStatus: 'success' });
        } catch (entryError) {
          // Set entry status to error and stop the process
          updateEntry(entry.id, {
            uploadStatus: 'error',
            uploadError: entryError instanceof Error ? entryError.message : 'Unknown error',
          });
          throw entryError; // Re-throw to stop the process
        }
      }

      setSnackbar({
        open: true,
        message: 'All entries were uploaded to Tempo successfully.',
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: `Error uploading to Tempo: ${err instanceof Error ? err.message : 'Unknown error'}`,
        severity: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {!ticketsValidated ? (
          <>
            <Button variant="outlined" startIcon={<ContentPasteIcon />} onClick={handlePasteClick}>
              Paste from Clipboard
            </Button>
            <Button
              variant="contained"
              startIcon={<VerifiedIcon />}
              onClick={handleValidateTickets}
              disabled={entries.length === 0}
            >
              Validate Tickets
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            color="primary"
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
            onClick={handleUploadToTempo}
            disabled={uploading || entries.length === 0}
          >
            {uploading ? 'Uploading...' : 'Upload Hours'}
          </Button>
        )}

        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopyClick}
          disabled={entries.length === 0}
        >
          Copy to Clipboard
        </Button>
        <Button
          variant="outlined"
          startIcon={<AssessmentIcon />}
          onClick={handleOpenTempoReport}
          disabled={isMockMode}
        >
          View Report
        </Button>
        <TempoReportImport />
      </Box>

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

      <TicketValidationDialog
        open={validationDialogOpen}
        onClose={() => setValidationDialogOpen(false)}
        onValidationComplete={handleValidationComplete}
      />
    </>
  );
};
