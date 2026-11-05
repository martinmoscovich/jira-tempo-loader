import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ErrorIcon from '@mui/icons-material/Error';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useTimesheet } from '../../context/TimesheetContext';
import { classifyUploadError, uploadWorklog } from '../../services/worklogUpload';
import { TimeEntry } from '../../types';
import { runParallelQueues } from '../../utils/parallelQueues';
import { calculateDuration } from '../../utils/ticketValidation';

interface ExportTempoStepProps {
  onBack: () => void;
  onComplete: () => void;
}

type UploadState = 'idle' | 'uploading' | 'paused' | 'completed' | 'error';

/** Which entries a run picks up: a fresh start, a resume after pause, or only the failed ones. */
type UploadMode = 'start' | 'resume' | 'retry-failed';

const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 6, 8];
const DEFAULT_CONCURRENCY = 4;

export const ExportTempoStep: React.FC<ExportTempoStepProps> = ({ onBack, onComplete }) => {
  const { entries, updateEntry } = useTimesheet();
  const { tempoApi, authState } = useAuth();
  const { formatDate } = useLocale();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState('');
  const pausedRef = useRef(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
  // While Jira rate-limits us, all parallel queues wait until this timestamp.
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const successCount = entries.filter((e) => e.uploadStatus === 'success').length;
  const errorCount = entries.filter((e) => e.uploadStatus === 'error').length;
  const remainingCount = entries.length - successCount - errorCount;
  const uploadingEntries = entries.filter((e) => e.uploadStatus === 'uploading');
  const waitSeconds = waitUntil !== null ? Math.ceil((waitUntil - now) / 1000) : 0;

  // Tick once per second while waiting so the countdown updates.
  useEffect(() => {
    if (waitUntil === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);

  const selectEntries = (mode: UploadMode): TimeEntry[] => {
    switch (mode) {
      case 'start':
        return entries.filter((e) => e.uploadStatus !== 'success');
      case 'resume':
        return entries.filter((e) => e.uploadStatus !== 'success' && e.uploadStatus !== 'error');
      case 'retry-failed':
        return entries.filter((e) => e.uploadStatus === 'error');
    }
  };

  const handleUpload = async (mode: UploadMode) => {
    if (!tempoApi || !authState.user) {
      setError('No active session');
      return;
    }
    const authorAccountId = authState.user.accountId;

    setUploadState('uploading');
    setError('');
    setWaitUntil(null);
    pausedRef.current = false;
    if (mode !== 'resume' || !startTime) setStartTime(new Date());

    // Entries that cannot be uploaded are reported as errors instead of staying pending forever.
    const selected = selectEntries(mode);
    const toUpload = selected.filter((entry) => {
      const uploadable = Boolean(entry.issue && entry.startTime && entry.endTime);
      if (!uploadable) {
        updateEntry(entry.id, { uploadStatus: 'error', uploadError: 'Missing ticket or times' });
      }
      return uploadable;
    });

    const result = await runParallelQueues(toUpload, {
      concurrency,
      shouldStop: () => pausedRef.current,
      process: (entry) =>
        uploadWorklog(tempoApi, {
          issueKey: entry.issue,
          timeSpentSeconds: calculateDuration(entry.startTime, entry.endTime),
          startDate: entry.date,
          startTime: entry.startTime,
          description: entry.description,
          authorAccountId,
        }),
      classifyError: classifyUploadError,
      onStart: (entry) => updateEntry(entry.id, { uploadStatus: 'uploading', uploadError: undefined }),
      onSuccess: (entry) => updateEntry(entry.id, { uploadStatus: 'success', uploadError: undefined }),
      onFailure: (entry, message) => updateEntry(entry.id, { uploadStatus: 'error', uploadError: message }),
      onRequeue: (entry) => updateEntry(entry.id, { uploadStatus: 'idle', uploadError: undefined }),
      onWait: (until) => {
        setNow(Date.now());
        setWaitUntil(until);
      },
    });

    setWaitUntil(null);

    if (result.abortMessage) {
      setError(result.abortMessage);
      setUploadState('error');
      return;
    }
    if (result.stopped) {
      setUploadState('paused');
      return;
    }

    setUploadState('completed');
    // Only move on automatically when everything went through; otherwise keep the failures visible.
    const hadFailures = result.failed > 0 || toUpload.length < selected.length;
    if (!hadFailures) {
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  };

  const handlePause = () => {
    pausedRef.current = true;
  };

  const handleResume = () => {
    handleUpload('resume');
  };

  const handleRetryFailed = () => {
    handleUpload('retry-failed');
  };

  const handleReset = () => {
    // Reset all entry statuses
    entries.forEach((entry) => {
      updateEntry(entry.id, { uploadStatus: 'idle', uploadError: undefined });
    });
    setUploadState('idle');
    setError('');
    setStartTime(null);
  };

  const progress = entries.length > 0 ? ((successCount + errorCount) / entries.length) * 100 : 0;

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const totalDuration = entries.reduce((total, entry) => {
    if (entry.startTime && entry.endTime) {
      return total + calculateDuration(entry.startTime, entry.endTime);
    }
    return total;
  }, 0);

  const getElapsedTime = (): string => {
    if (!startTime) return '0s';
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}m ${seconds}s`;
  };

  const getEstimatedTime = (): string => {
    if (!startTime || successCount === 0) return 'Calculating...';
    const now = new Date();
    const elapsed = (now.getTime() - startTime.getTime()) / 1000;
    const avgTime = elapsed / (successCount + errorCount);
    const remaining = avgTime * remainingCount;
    if (remaining < 60) return `${Math.floor(remaining)}s`;
    const minutes = Math.floor(remaining / 60);
    return `${minutes}m`;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Export to Tempo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload {entries.length} time entry(ies) to Tempo
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ mb: 3, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
        <Box
          sx={{
            p: 2,
            bgcolor: 'primary.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'primary.200',
          }}
        >
          <Typography variant="h4" fontWeight="bold" color="primary.main">
            {entries.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total Entries
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            bgcolor: 'success.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'success.200',
          }}
        >
          <Typography variant="h4" fontWeight="bold" color="success.main">
            {successCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Succeeded
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            bgcolor: 'error.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'error.200',
          }}
        >
          <Typography variant="h4" fontWeight="bold" color="error.main">
            {errorCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Errors
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            bgcolor: 'info.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'info.200',
          }}
        >
          <Typography variant="h4" fontWeight="bold" color="info.main">
            {formatDuration(totalDuration)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total Time
          </Typography>
        </Box>
      </Box>

      {/* Progress */}
      {uploadState !== 'idle' && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">
              {uploadState === 'uploading' && 'Uploading...'}
              {uploadState === 'paused' && 'Paused'}
              {uploadState === 'completed' && 'Completed!'}
              {uploadState === 'error' && 'Error'}
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {successCount + errorCount} / {entries.length}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 1, mb: 1 }}
          />
          {uploadState === 'uploading' && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                Elapsed time: {getElapsedTime()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Estimated time remaining: {getEstimatedTime()}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Current Entry */}
      {uploadState === 'uploading' && waitSeconds > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }} role="status">
          Jira asked us to slow down. Retrying in {waitSeconds}s.
        </Alert>
      )}
      {uploadState === 'uploading' && uploadingEntries.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="bold">
            In progress ({uploadingEntries.length}):
          </Typography>
          {uploadingEntries.map((entry) => (
            <Typography key={entry.id} variant="body2">
              {entry.issue} - {formatDate(entry.date)} ({entry.startTime} - {entry.endTime})
            </Typography>
          ))}
        </Alert>
      )}

      {/* Completion Alert */}
      {uploadState === 'completed' && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight="bold">
            Upload Complete
          </Typography>
          <Typography variant="body2">
            {successCount} entry(ies) uploaded successfully
            {errorCount > 0 && ` (${errorCount} error(s))`}.
          </Typography>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Failed Entries */}
      {errorCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="error.main">
            Entries with Errors ({errorCount})
          </Typography>
          <List dense>
            {entries
              .filter((e) => e.uploadStatus === 'error')
              .map((entry) => (
                <ListItem
                  key={entry.id}
                  sx={{
                    bgcolor: 'error.50',
                    borderRadius: 1,
                    mb: 1,
                    border: '1px solid',
                    borderColor: 'error.200',
                  }}
                >
                  <ListItemIcon>
                    <ErrorIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${entry.issue} - ${formatDate(entry.date)} (${entry.startTime} - ${entry.endTime})`}
                    secondary={entry.uploadError || 'Unknown error'}
                  />
                </ListItem>
              ))}
          </List>
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={onBack}
            disabled={uploadState === 'uploading'}
          >
            Back
          </Button>
          {(uploadState === 'paused' || errorCount > 0) && uploadState !== 'completed' && (
            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={handleReset}
            >
              Restart
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {uploadState === 'idle' && (
            <TextField
              select
              size="small"
              label="Parallel uploads"
              value={concurrency}
              onChange={(event) => setConcurrency(Number(event.target.value))}
              sx={{ minWidth: 150 }}
            >
              {CONCURRENCY_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          )}

          {uploadState === 'idle' && (
            <Button
              variant="contained"
              size="large"
              startIcon={<CloudUploadIcon />}
              onClick={() => handleUpload('start')}
            >
              Start Upload
            </Button>
          )}

          {(uploadState === 'completed' || uploadState === 'error') && errorCount > 0 && (
            <Button
              variant="outlined"
              size="large"
              startIcon={<RestartAltIcon />}
              onClick={handleRetryFailed}
            >
              Retry failed ({errorCount})
            </Button>
          )}

          {uploadState === 'uploading' && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PauseIcon />}
              onClick={handlePause}
              color="warning"
            >
              Pause
            </Button>
          )}

          {uploadState === 'paused' && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handleResume}
              color="primary"
            >
              Resume
            </Button>
          )}

          {uploadState === 'completed' && (
            <Button variant="contained" size="large" onClick={onComplete} color="success">
              Finish
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};
