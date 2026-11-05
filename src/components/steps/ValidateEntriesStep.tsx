import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { Alert, Box, Button, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useTimesheet } from '../../context/TimesheetContext';
import {
  calculateDuration,
  validateTimeEntry,
} from '../../utils/ticketValidation';
import { TimesheetTable } from '../TimesheetTable';

interface ValidateEntriesStepProps {
  onContinue: () => void;
  onBack: () => void;
}

interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

export const ValidateEntriesStep: React.FC<ValidateEntriesStepProps> = ({
  onContinue,
  onBack,
}) => {
  const { entries } = useTimesheet();

  // Create a map of entryId -> validation issues
  const validationMap = useMemo<Record<string, ValidationIssue[]>>(() => {
    const map: Record<string, ValidationIssue[]> = {};

    entries.forEach((entry) => {
      const issues: ValidationIssue[] = [];

      // Check for required fields
      const validationError = validateTimeEntry(entry);
      if (validationError) {
        issues.push({
          severity: 'error',
          message: validationError,
        });
      }

      // Check for time overlaps with other entries on the same day
      const sameDay = entries.filter(
        (e) => e.date === entry.date && e.id !== entry.id
      );
      sameDay.forEach((other) => {
        const entryStart = entry.startTime;
        const entryEnd = entry.endTime;
        const otherStart = other.startTime;
        const otherEnd = other.endTime;

        // Two time ranges overlap if one starts before the other ends AND ends after the other starts
        // But NOT if one ends exactly when the other starts (that's adjacent, not overlapping)
        const hasOverlap = entryStart < otherEnd && entryEnd > otherStart;

        if (hasOverlap) {
          // Only add once per entry pair (avoid duplicates)
          if (entry.id < other.id) {
            issues.push({
              severity: 'warning',
              message: `Overlaps with ${otherStart}-${otherEnd} (${other.issue})`,
            });
          }
        }
      });

      // Check for very long durations (>12 hours)
      if (entry.startTime && entry.endTime) {
        const duration = calculateDuration(entry.startTime, entry.endTime);
        if (duration > 12 * 3600) {
          issues.push({
            severity: 'warning',
            message: `Duration of ${Math.floor(duration / 3600)}h is too long`,
          });
        }
      }

      if (issues.length > 0) {
        map[entry.id] = issues;
      }
    });

    return map;
  }, [entries]);

  const totalErrors = Object.values(validationMap).reduce(
    (count, issues) =>
      count + issues.filter((i) => i.severity === 'error').length,
    0
  );

  const totalWarnings = Object.values(validationMap).reduce(
    (count, issues) =>
      count + issues.filter((i) => i.severity === 'warning').length,
    0
  );

  const hasErrors = totalErrors > 0;
  const hasWarnings = totalWarnings > 0;
  const isValid = !hasErrors;

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header - Fixed */}
      <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Validate Entries
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Final review before exporting to Tempo
        </Typography>
      </Box>

      {/* Summary Cards - Fixed */}
      <Box
        sx={{
          mb: 3,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 2,
          flexShrink: 0,
        }}
      >
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
            Entries
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            bgcolor: totalErrors > 0 ? 'error.50' : 'success.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: totalErrors > 0 ? 'error.200' : 'success.200',
          }}
        >
          <Typography
            variant="h4"
            fontWeight="bold"
            color={totalErrors > 0 ? 'error.main' : 'success.main'}
          >
            {totalErrors}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Errors
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            bgcolor: 'warning.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'warning.200',
          }}
        >
          <Typography variant="h4" fontWeight="bold" color="warning.main">
            {totalWarnings}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Warnings
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

      {/* Validation Status - Fixed */}
      <Box sx={{ flexShrink: 0 }}>
        {isValid && !hasWarnings && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
            <Typography variant="body1" fontWeight="bold">
              All entries are ready
            </Typography>
            <Typography variant="body2">
              No errors or warnings found. You can proceed to
              export to Tempo.
            </Typography>
          </Alert>
        )}

        {isValid && hasWarnings && (
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
            <Typography variant="body1" fontWeight="bold">
              Warnings found
            </Typography>
            <Typography variant="body2">
              Found {totalWarnings} warning(s), but you can
              continue. Check the table for details.
            </Typography>
          </Alert>
        )}

        {!isValid && (
          <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 3 }}>
            <Typography variant="body1" fontWeight="bold">
              Errors found
            </Typography>
            <Typography variant="body2">
              You must fix {totalErrors} error(s) before continuing. Check
              the table for details.
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Table with validation indicators - Scrollable */}
      <Box sx={{ flex: 1, minHeight: 0, mb: 3, overflowY: 'auto' }}>
        <TimesheetTable validationMap={validationMap} />
      </Box>

      {/* Navigation - Sticky */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          justifyContent: 'space-between',
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={onContinue}
          disabled={!isValid}
        >
          Continue to Export
        </Button>
      </Box>
    </Box>
  );
};
