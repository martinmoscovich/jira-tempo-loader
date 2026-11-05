import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTimesheet } from '../context/TimesheetContext';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { groupNewTickets, isIssueKey } from '../utils/ticketValidation';
import { TicketValidationModal } from './TicketValidationModal';
import { NewTicketData } from '../types';

export const WorkflowStepper: React.FC = () => {
  const { entries, validationGroups, setValidationGroups, updateValidationGroup, updateEntry } =
    useTimesheet();
  const { jiraApi, tempoApi, authState } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [validating, setValidating] = useState(false);
  const [shouldValidate, setShouldValidate] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [currentUploadEntry, setCurrentUploadEntry] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    issue: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [, setValidated] = useState(false);

  // Extract issue keys to validate
  const existingTicketEntries = entries.filter(entry => {
    const trimmed = entry.issue.trim();
    return isIssueKey(trimmed);
  });
  const issueKeys = existingTicketEntries.map(e => e.issue.toUpperCase());

  // Extract project keys from existing tickets
  const projectsFromExistingTickets = new Set(
    issueKeys.map(key => key.split('-')[0].toUpperCase())
  );

  // Extract project keys to validate (from grouped new tickets)
  const newTicketGroups = groupNewTickets(entries);
  const allNewProjectKeys = [...new Set(newTicketGroups.map(g => g.projectKey.toUpperCase()))];

  // Only validate projects that don't have existing tickets
  const projectKeys = allNewProjectKeys.filter(
    projectKey => !projectsFromExistingTickets.has(projectKey)
  );

  // Validate existing tickets with React Query
  const {
    data: issuesValidation,
    isLoading: isLoadingIssues,
    refetch: refetchIssues,
  } = useQuery({
    queryKey: ['validateIssues', issueKeys.sort().join(',')],
    queryFn: async () => {
      if (!jiraApi || issueKeys.length === 0) return {};
      return await jiraApi.getMultipleIssues(issueKeys);
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
  });

  // Validate projects with React Query
  const {
    data: projectsValidation,
    isLoading: isLoadingProjects,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['validateProjects', projectKeys.sort().join(',')],
    queryFn: async () => {
      if (!jiraApi || projectKeys.length === 0) return {};
      return await jiraApi.getMultipleProjects(projectKeys);
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
  });

  // Handle validation results
  useEffect(() => {
    if (!shouldValidate) return;

    const checkingTickets = isLoadingIssues || isLoadingProjects;
    if (checkingTickets) return;

    if (issuesValidation !== undefined && projectsValidation !== undefined) {
      // Check for invalid tickets
      const invalidTickets: string[] = [];
      issueKeys.forEach(key => {
        const isValid = issuesValidation[key] !== null && issuesValidation[key] !== undefined;
        if (!isValid) {
          invalidTickets.push(key);
        }
      });

      if (invalidTickets.length > 0) {
        setError(`The following tickets do not exist in Jira: ${invalidTickets.join(', ')}`);
        setShouldValidate(false);
        return;
      }

      // Check for invalid projects
      const invalidProjects: string[] = [];
      projectKeys.forEach(key => {
        const isValid = projectsValidation[key] === true;
        if (!isValid) {
          invalidProjects.push(key);
        }
      });

      if (invalidProjects.length > 0) {
        setError(`The following project codes are not valid: ${invalidProjects.join(', ')}`);
        setShouldValidate(false);
        return;
      }

      // All validations passed
      setValidationGroups(newTicketGroups);
      setCurrentGroupIndex(0);
      setValidated(true);

      if (newTicketGroups.length > 0) {
        setValidating(true);
      } else {
        setSuccess('All tickets are valid and exist in Jira.');
        setActiveStep(1);
      }

      setShouldValidate(false);
    }
  }, [shouldValidate, isLoadingIssues, isLoadingProjects, issuesValidation, projectsValidation]);

  const handleValidateTickets = async () => {
    if (!jiraApi) {
      setError('No active session');
      return;
    }

    setError('');
    setSuccess('');
    setShouldValidate(true);

    await Promise.all([refetchIssues(), refetchProjects()]);
  };

  const handleConfirmGroup = (
    groupKey: string,
    data: {
      title: string;
      assignee: string;
      status: 'OPEN' | 'IN PROGRESS' | 'CLOSED';
      useExistingTicket?: string;
      parentIssueKey?: string;
    }
  ) => {
    if (data.useExistingTicket) {
      const existingGroup = validationGroups.find((g) => g.groupKey === data.useExistingTicket);
      if (existingGroup) {
        updateValidationGroup(groupKey, {
          finalIssueKey: existingGroup.finalIssueKey,
        });
      }
    } else {
      const ticketData: NewTicketData = {
        projectKey: validationGroups[currentGroupIndex].projectKey,
        title: data.title,
        assignee: data.assignee,
        status: data.status,
        originalReference: validationGroups[currentGroupIndex].projectKey,
        parentIssueKey: data.parentIssueKey,
      };

      updateValidationGroup(groupKey, { ticketData });
    }

    if (currentGroupIndex < validationGroups.length - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1);
    } else {
      setValidating(false);
      setSuccess('Validation complete. Ready to create tickets.');
      setActiveStep(1);
    }
  };

  const handleCreateTickets = async () => {
    if (!jiraApi || !authState.user) {
      setError('No active session');
      return;
    }

    setCreating(true);
    setError('');

    try {
      for (const group of validationGroups) {
        if (group.ticketData && !group.finalIssueKey) {
          const issue = await jiraApi.createIssue(group.ticketData, authState.user.accountId);

          updateValidationGroup(group.groupKey, {
            finalIssueKey: issue.key,
          });

          group.entryIds.forEach((entryId) => {
            updateEntry(entryId, { issue: issue.key, isNew: true });
          });
        } else if (group.finalIssueKey) {
          group.entryIds.forEach((entryId) => {
            updateEntry(entryId, { issue: group.finalIssueKey });
          });
        }
      }

      setSuccess('All tickets were created successfully.');
      setActiveStep(2);
    } catch (err) {
      setError(`Error creating tickets: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleUploadToTempo = async () => {
    if (!tempoApi) {
      setError('No active session');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress({ current: 0, total: entries.length });

    try {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const issueKey = entry.issue;

        if (!issueKey || !entry.startTime || !entry.endTime) continue;

        // Set entry status to uploading
        updateEntry(entry.id, { uploadStatus: 'uploading' });

        setCurrentUploadEntry({
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          issue: issueKey,
        });

        const [startHour, startMinute] = entry.startTime.split(':').map(Number);
        const [endHour, endMinute] = entry.endTime.split(':').map(Number);
        const startSeconds = startHour * 3600 + startMinute * 60;
        const endSeconds = endHour * 3600 + endMinute * 60;
        const timeSpentSeconds = endSeconds - startSeconds;

        try {
          await tempoApi.createWorklog({
            issueKey,
            timeSpentSeconds,
            startDate: entry.date,
            startTime: entry.startTime,
            description: entry.description,
            authorAccountId: authState.user?.accountId || '',
          });

          // Set entry status to success
          updateEntry(entry.id, { uploadStatus: 'success' });
          setUploadProgress({ current: i + 1, total: entries.length });
        } catch (entryError) {
          // Set entry status to error and stop the process
          updateEntry(entry.id, {
            uploadStatus: 'error',
            uploadError: entryError instanceof Error ? entryError.message : 'Unknown error'
          });
          throw entryError; // Re-throw to stop the process
        }
      }

      setCurrentUploadEntry(null);
      setSuccess('All entries were uploaded to Tempo successfully.');
      setActiveStep(3);
    } catch (err) {
      setCurrentUploadEntry(null);
      setError(`Error uploading to Tempo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const hasNewTickets = validationGroups.length > 0;
  const allValidated = validationGroups.every((g) => g.ticketData || g.finalIssueKey);
  const allCreated = validationGroups.every((g) => g.finalIssueKey);
  const checkingTickets = isLoadingIssues || isLoadingProjects;

  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" gutterBottom fontWeight="bold">
        Workflow
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        {/* Step 0: Validate */}
        <Step>
          <StepLabel>Validate Tickets</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Check that all tickets exist in Jira and that the projects are valid
            </Typography>

            <Button
              variant="contained"
              onClick={handleValidateTickets}
              disabled={entries.length === 0 || checkingTickets}
              sx={{ mb: 2 }}
            >
              {checkingTickets ? <CircularProgress size={24} /> : 'Validate Tickets'}
            </Button>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </StepContent>
        </Step>

        {/* Step 1: Create Tickets */}
        <Step>
          <StepLabel>Review and Create Tickets</StepLabel>
          <StepContent>
            {/* Tickets Nuevos */}
            {hasNewTickets && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                  New Tickets ({validationGroups.length})
                </Typography>
                <List dense>
                  {validationGroups.map((group) => (
                    <ListItem key={group.groupKey}>
                      <ListItemText
                        primary={`${group.projectKey} - ${group.title}`}
                        secondary={`${group.count} entry(ies)`}
                      />
                      {group.finalIssueKey ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label={group.finalIssueKey}
                          color="success"
                          size="small"
                        />
                      ) : group.ticketData ? (
                        <Chip label="Ready" color="primary" size="small" />
                      ) : (
                        <Chip label="Pending" size="small" />
                      )}
                    </ListItem>
                  ))}
                </List>

                {!allCreated && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleCreateTickets}
                    disabled={!allValidated || creating}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    {creating ? <CircularProgress size={24} /> : 'Create Tickets'}
                  </Button>
                )}
              </Box>
            )}

            {/* Divider if both exist */}
            {hasNewTickets && existingTicketEntries.length > 0 && <Divider sx={{ my: 2 }} />}

            {/* Tickets Existentes */}
            {existingTicketEntries.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                  Existing Tickets ({existingTicketEntries.length})
                </Typography>
                <List dense>
                  {existingTicketEntries.slice(0, 5).map((entry) => (
                    <ListItem key={entry.id}>
                      <ListItemText primary={entry.issue} secondary={entry.description} />
                      <Chip icon={<CheckCircleIcon />} label="Valid" color="success" size="small" />
                    </ListItem>
                  ))}
                  {existingTicketEntries.length > 5 && (
                    <ListItem>
                      <ListItemText
                        secondary={`+ ${existingTicketEntries.length - 5} more ticket(s)`}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}

            {!hasNewTickets && existingTicketEntries.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No tickets to review
              </Typography>
            )}

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {success && activeStep === 1 && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

            {allCreated && (
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
                sx={{ mt: 2 }}
                fullWidth
              >
                Continue to Upload to Tempo
              </Button>
            )}
          </StepContent>
        </Step>

        {/* Step 2: Upload to Tempo */}
        <Step>
          <StepLabel>Upload to Tempo</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload {entries.length} time entry(ies) to Tempo
            </Typography>

            {uploading && currentUploadEntry && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {new Date(currentUploadEntry.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} {currentUploadEntry.startTime} → {currentUploadEntry.endTime}: {currentUploadEntry.issue} ({uploadProgress.current}/{uploadProgress.total})
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(uploadProgress.current / uploadProgress.total) * 100}
                />
              </Box>
            )}

            <Button
              variant="contained"
              color="primary"
              onClick={handleUploadToTempo}
              disabled={uploading || entries.length === 0}
              fullWidth
            >
              {uploading ? <CircularProgress size={24} /> : 'Upload to Tempo'}
            </Button>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {success && activeStep === 2 && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
          </StepContent>
        </Step>
      </Stepper>

      {activeStep === 3 && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
          Process completed successfully!
        </Alert>
      )}

      {/* Validation Modal */}
      {validating && validationGroups.length > 0 && (
        <TicketValidationModal
          open={validating && currentGroupIndex < validationGroups.length}
          group={validationGroups[currentGroupIndex]}
          existingTickets={validationGroups}
          onConfirm={handleConfirmGroup}
          onClose={() => setValidating(false)}
        />
      )}
    </Paper>
  );
};
