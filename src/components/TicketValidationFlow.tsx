import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimesheet } from '../context/TimesheetContext';
import { NewTicketData } from '../types';
import { groupNewTickets, isIssueKey } from '../utils/ticketValidation';
import { TicketValidationModal } from './TicketValidationModal';

export const TicketValidationFlow: React.FC = () => {
  const { entries, validationGroups, setValidationGroups, updateValidationGroup, updateEntry } =
    useTimesheet();
  const { jiraApi, authState } = useAuth();
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [validating, setValidating] = useState(false);
  const [shouldValidate, setShouldValidate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset states when validation groups are cleared
  useEffect(() => {
    if (validationGroups.length === 0) {
      setError('');
      setSuccess('');
      setValidating(false);
      setCreating(false);
      setCurrentGroupIndex(0);
    }
  }, [validationGroups]);

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
    enabled: false, // Manual trigger
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Validate projects with React Query (only those not covered by existing tickets)
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
    enabled: false, // Manual trigger
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle validation results
  useEffect(() => {
    if (!shouldValidate) return;

    const checkingTickets = isLoadingIssues || isLoadingProjects;
    if (checkingTickets) return;

    // Check if we have both validations completed
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
        // Mark invalid tickets in entries
        invalidTickets.forEach(invalidKey => {
          const invalidEntries = existingTicketEntries.filter(e => e.issue.toUpperCase() === invalidKey);
          invalidEntries.forEach(entry => {
            updateEntry(entry.id, { isInvalid: true });
          });
        });

        setError(`The following tickets do not exist in Jira: ${invalidTickets.join(', ')}`);
        setShouldValidate(false);
        return;
      }

      // Clear isInvalid flag for valid tickets
      existingTicketEntries.forEach(entry => {
        updateEntry(entry.id, { isInvalid: false });
      });

      // Check for invalid projects
      // Note: Only check projects that weren't already validated via existing tickets
      const invalidProjects: string[] = [];
      projectKeys.forEach(key => {
        const isValid = projectsValidation[key] === true;
        if (!isValid) {
          invalidProjects.push(key);
        }
      });

      if (invalidProjects.length > 0) {
        // Mark entries with invalid projects using the validation groups
        newTicketGroups.forEach(group => {
          if (invalidProjects.includes(group.projectKey.toUpperCase())) {
            group.entryIds.forEach(entryId => {
              updateEntry(entryId, { isInvalid: true });
            });
          }
        });

        setError(`The following project codes are not valid: ${invalidProjects.join(', ')}`);
        setShouldValidate(false);
        return;
      }

      // Clear isInvalid flag for valid projects
      newTicketGroups.forEach(group => {
        if (!invalidProjects.includes(group.projectKey.toUpperCase())) {
          group.entryIds.forEach(entryId => {
            updateEntry(entryId, { isInvalid: false });
          });
        }
      });

      // All projects from existing tickets are implicitly valid (we validated the tickets exist)
      // Projects in projectKeys were validated separately
      // Projects in projectsFromExistingTickets are valid because their tickets exist

      // All validations passed
      setValidationGroups(newTicketGroups);
      setCurrentGroupIndex(0);

      if (newTicketGroups.length > 0) {
        setValidating(true);
      } else {
        setSuccess('All tickets are valid and exist in Jira.');
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

    // Trigger both validations
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
      setSuccess('Validation complete. You can now create the tickets.');
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

      setSuccess('All tickets were created successfully.');
    } catch (err) {
      setError(`Error creating tickets: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const hasNewTickets = validationGroups.length > 0;
  const allValidated = validationGroups.every((g) => g.ticketData || g.finalIssueKey);
  const allCreated = validationGroups.every((g) => g.finalIssueKey);
  const checkingTickets = isLoadingIssues || isLoadingProjects;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleValidateTickets}
          disabled={entries.length === 0 || validating || checkingTickets}
        >
          {checkingTickets ? <CircularProgress size={24} /> : 'Validate Tickets'}
        </Button>

        <Button
          variant="contained"
          color="success"
          onClick={handleCreateTickets}
          disabled={!hasNewTickets || !allValidated || allCreated || creating}
        >
          {creating ? <CircularProgress size={24} /> : 'Create Tickets'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {hasNewTickets && (
        <Typography variant="body2" color="text.secondary">
          New tickets detected: {validationGroups.length}
          {allValidated && !allCreated && ' - Ready to create'}
          {allCreated && ' - All created'}
        </Typography>
      )}

      {validating && validationGroups.length > 0 && (
        <TicketValidationModal
          open={validating && currentGroupIndex < validationGroups.length}
          group={validationGroups[currentGroupIndex]}
          existingTickets={validationGroups}
          onConfirm={handleConfirmGroup}
          onClose={() => setValidating(false)}
        />
      )}
    </Box>
  );
};
