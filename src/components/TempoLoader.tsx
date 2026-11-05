import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimesheet } from '../context/TimesheetContext';
import { TempoWorklog } from '../types';
import { calculateDuration, validateTimeEntry } from '../utils/ticketValidation';

export const TempoLoader: React.FC = () => {
  const { entries, updateEntry } = useTimesheet();
  const { tempoApi, authState } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateAllEntries = (): boolean => {
    const errors: Record<string, string> = {};
    let hasErrors = false;

    entries.forEach((entry) => {
      const validationError = validateTimeEntry(entry);
      if (validationError) {
        errors[entry.id] = validationError;
        hasErrors = true;
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleLoadToTempo = () => {
    setError('');
    setSuccess(false);

    if (entries.length === 0) {
      setError('No entries to upload');
      return;
    }

    if (!validateAllEntries()) {
      setError('Some entries have validation errors. Please fix them before continuing.');
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmLoad = async () => {
    if (!tempoApi || !authState.user) {
      setError('No active session');
      return;
    }

    setLoading(true);
    setError('');
    setConfirmOpen(false);

    try {
      for (const entry of entries) {
        // Set entry status to uploading
        updateEntry(entry.id, { uploadStatus: 'uploading' });

        const finalIssue = entry.issue;
        const duration = calculateDuration(entry.startTime, entry.endTime);

        const worklog: TempoWorklog = {
          issueKey: finalIssue,
          timeSpentSeconds: duration,
          startDate: entry.date,
          startTime: entry.startTime,
          description: entry.description,
          authorAccountId: authState.user.accountId,
        };

        try {
          await tempoApi.createWorklog(worklog);
          // Set entry status to success
          updateEntry(entry.id, { uploadStatus: 'success' });
        } catch (entryError) {
          // Set entry status to error and stop the process
          updateEntry(entry.id, {
            uploadStatus: 'error',
            uploadError: entryError instanceof Error ? entryError.message : 'Unknown error'
          });
          throw entryError; // Re-throw to stop the process
        }
      }

      setSuccess(true);
    } catch (err) {
      setError(`Error uploading to Tempo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  return (
    <Box>
      <Button
        variant="contained"
        color="primary"
        onClick={handleLoadToTempo}
        disabled={loading || entries.length === 0}
        size="large"
      >
        {loading ? <CircularProgress size={24} /> : 'Upload to Tempo'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          All entries were uploaded to Tempo successfully.
        </Alert>
      )}

      {hasValidationErrors && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            Validation errors:
          </Typography>
          <List dense>
            {Object.entries(validationErrors).map(([id, errorMsg]) => {
              const entry = entries.find((e) => e.id === id);
              return (
                <ListItem key={id}>
                  <ListItemText
                    primary={`${entry?.issue || 'No ticket'} - ${entry?.date || 'No date'}`}
                    secondary={errorMsg}
                  />
                </ListItem>
              );
            })}
          </List>
        </Alert>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Upload to Tempo</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            You are about to upload {entries.length} {entries.length === 1 ? 'entry' : 'entries'} to Tempo.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This will create Tempo worklogs for each entry in the table.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmLoad} variant="contained" color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
