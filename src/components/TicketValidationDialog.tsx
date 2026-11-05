import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useTimesheet } from '../context/TimesheetContext';
import { groupNewTickets, isIssueKey } from '../utils/ticketValidation';
import { TicketValidationModal } from './TicketValidationModal';

interface TicketValidationDialogProps {
  open: boolean;
  onClose: () => void;
  onValidationComplete: () => void;
}

export const TicketValidationDialog: React.FC<TicketValidationDialogProps> = ({
  open,
  onClose,
  onValidationComplete,
}) => {
  const { entries, validationGroups, setValidationGroups, updateValidationGroup, updateEntry } = useTimesheet();
  const { jiraApi, authState } = useAuth();
  const [validating, setValidating] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const [allCreated, setAllCreated] = useState(false);

  // Extract issue keys to validate
  const existingTicketEntries = entries.filter((entry) => {
    const trimmed = entry.issue.trim();
    return isIssueKey(trimmed);
  });
  const issueKeys = existingTicketEntries.map((e) => e.issue.toUpperCase());

  // Extract project keys from existing tickets
  const projectsFromExistingTickets = new Set(issueKeys.map((key) => key.split('-')[0].toUpperCase()));

  // Extract project keys to validate (from grouped new tickets)
  const newTicketGroups = groupNewTickets(entries);
  const allNewProjectKeys = [...new Set(newTicketGroups.map((g) => g.projectKey.toUpperCase()))];

  // Only validate projects that don't have existing tickets
  const projectKeys = allNewProjectKeys.filter((projectKey) => !projectsFromExistingTickets.has(projectKey));

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

  // Start validation when dialog opens
  useEffect(() => {
    if (open && !validated) {
      setError('');
      setValidated(false);
      setAllCreated(false);
      refetchIssues();
      refetchProjects();
    }
  }, [open]);

  // Handle validation results
  useEffect(() => {
    if (!open) return;

    const checkingTickets = isLoadingIssues || isLoadingProjects;
    if (checkingTickets) return;

    if (issuesValidation !== undefined && projectsValidation !== undefined) {
      // Check for invalid tickets
      const invalidTickets: string[] = [];
      issueKeys.forEach((key) => {
        const isValid = issuesValidation[key] !== null && issuesValidation[key] !== undefined;
        if (!isValid) {
          invalidTickets.push(key);
        }
      });

      if (invalidTickets.length > 0) {
        // Mark entries as invalid
        entries.forEach((entry) => {
          if (invalidTickets.includes(entry.issue.toUpperCase())) {
            updateEntry(entry.id, { isInvalid: true });
          }
        });
        setError(`The following tickets do not exist in Jira: ${invalidTickets.join(', ')}`);
        setValidated(true);
        return;
      }

      // Check for invalid projects
      const invalidProjects: string[] = [];
      projectKeys.forEach((key) => {
        const isValid = projectsValidation[key] === true;
        if (!isValid) {
          invalidProjects.push(key);
        }
      });

      if (invalidProjects.length > 0) {
        // Mark entries with invalid projects
        newTicketGroups.forEach((group) => {
          if (invalidProjects.includes(group.projectKey.toUpperCase())) {
            group.entryIds.forEach((entryId) => {
              updateEntry(entryId, { isInvalid: true });
            });
          }
        });
        setError(`The following project codes are not valid: ${invalidProjects.join(', ')}`);
        setValidated(true);
        return;
      }

      // Clear isInvalid flag for valid entries
      entries.forEach((entry) => {
        if (entry.isInvalid) {
          updateEntry(entry.id, { isInvalid: false });
        }
      });

      // All validations passed
      setValidationGroups(newTicketGroups);
      setCurrentGroupIndex(0);
      setValidated(true);

      if (newTicketGroups.length > 0) {
        setValidating(true);
      }
    }
  }, [open, isLoadingIssues, isLoadingProjects, issuesValidation, projectsValidation]);

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
      const ticketData = {
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
            updateEntry(entryId, { issue: issue.key, isNew: true, isInvalid: false });
          });
        } else if (group.finalIssueKey) {
          group.entryIds.forEach((entryId) => {
            updateEntry(entryId, { issue: group.finalIssueKey });
          });
        }
      }

      setAllCreated(true);
    } catch (err) {
      setError(`Error creating tickets: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleAccept = () => {
    onValidationComplete();
    onClose();
  };

  const hasNewTickets = validationGroups.length > 0;
  const allValidated = validationGroups.every((g) => g.ticketData || g.finalIssueKey);
  const checkingTickets = isLoadingIssues || isLoadingProjects;
  const hasErrors = !!error;

  return (
    <>
      <Dialog open={open} onClose={hasErrors ? onClose : undefined} maxWidth="md" fullWidth>
        <DialogTitle>Ticket Validation</DialogTitle>
        <DialogContent>
          {checkingTickets && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Validating tickets...</Typography>
            </Box>
          )}

          {!checkingTickets && validated && (
            <>
              {/* Error messages */}
              {hasErrors && (
                <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {!hasErrors && (
                <>
                  {/* Existing valid tickets */}
                  {existingTicketEntries.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <CheckCircleIcon color="success" />
                        <Typography variant="subtitle1" fontWeight="bold">
                          Valid Tickets ({existingTicketEntries.length})
                        </Typography>
                      </Box>
                      <List dense>
                        {existingTicketEntries.slice(0, 5).map((entry) => (
                          <ListItem key={entry.id}>
                            <ListItemText primary={entry.issue} secondary={entry.description} />
                            <Chip icon={<CheckCircleIcon />} label="Valid" color="success" size="small" />
                          </ListItem>
                        ))}
                        {existingTicketEntries.length > 5 && (
                          <ListItem>
                            <ListItemText secondary={`+ ${existingTicketEntries.length - 5} more ticket(s)`} />
                          </ListItem>
                        )}
                      </List>
                    </Box>
                  )}

                  {/* New tickets */}
                  {hasNewTickets && (
                    <>
                      {existingTicketEntries.length > 0 && <Divider sx={{ my: 2 }} />}
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <WarningIcon color="warning" />
                          <Typography variant="subtitle1" fontWeight="bold">
                            New Tickets ({validationGroups.length})
                          </Typography>
                        </Box>
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
                      </Box>

                      {allCreated && (
                        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
                          All tickets were created successfully
                        </Alert>
                      )}
                    </>
                  )}

                  {!hasNewTickets && existingTicketEntries.length > 0 && (
                    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
                      All tickets are valid
                    </Alert>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {hasErrors && <Button onClick={onClose}>Close</Button>}

          {!hasErrors && validated && !checkingTickets && (
            <>
              {hasNewTickets && !allCreated && (
                <Button
                  onClick={handleCreateTickets}
                  disabled={!allValidated || creating}
                  variant="contained"
                  color="primary"
                >
                  {creating ? <CircularProgress size={24} /> : 'Create Tickets'}
                </Button>
              )}

              {(!hasNewTickets || allCreated) && (
                <Button onClick={handleAccept} variant="contained" color="primary">
                  OK
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Validation Modal for new tickets */}
      {validating && validationGroups.length > 0 && (
        <TicketValidationModal
          open={validating && currentGroupIndex < validationGroups.length}
          group={validationGroups[currentGroupIndex]}
          existingTickets={validationGroups}
          onConfirm={handleConfirmGroup}
          onClose={() => setValidating(false)}
        />
      )}
    </>
  );
};
