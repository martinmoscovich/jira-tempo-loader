import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTimesheet } from '../../context/TimesheetContext';
import { groupNewTickets, isIssueKey } from '../../utils/ticketValidation';

interface ValidateTicketsStepProps {
  onContinue: () => void;
  onBack: () => void;
}

export const ValidateTicketsStep: React.FC<ValidateTicketsStepProps> = ({
  onContinue,
  onBack,
}) => {
  const { entries, setValidationGroups } = useTimesheet();
  const { jiraApi } = useAuth();
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState('');

  // Extract existing tickets and new tickets
  const existingTicketEntries = entries.filter((entry) => {
    const trimmed = entry.issue.trim();
    return isIssueKey(trimmed);
  });
  const issueKeys = existingTicketEntries.map((e) => e.issue.toUpperCase());

  const newTicketGroups = groupNewTickets(entries);
  const projectsFromExistingTickets = new Set(
    issueKeys.map((key) => key.split('-')[0].toUpperCase())
  );
  const allNewProjectKeys = [
    ...new Set(newTicketGroups.map((g) => g.projectKey.toUpperCase())),
  ];
  const projectKeys = allNewProjectKeys.filter(
    (projectKey) => !projectsFromExistingTickets.has(projectKey)
  );

  // Validate existing tickets
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

  // Validate projects
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

  const isLoading = isLoadingIssues || isLoadingProjects;

  // Handle validation results
  useEffect(() => {
    if (!validating || isLoading) return;

    if (issuesValidation !== undefined && projectsValidation !== undefined) {
      // Check for invalid tickets
      const invalidTickets: string[] = [];
      issueKeys.forEach((key) => {
        const isValid =
          issuesValidation[key] !== null && issuesValidation[key] !== undefined;
        if (!isValid) {
          invalidTickets.push(key);
        }
      });

      if (invalidTickets.length > 0) {
        setError(
          `The following tickets do not exist in Jira: ${invalidTickets.join(', ')}`
        );
        setValidating(false);
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
        setError(
          `The following project codes are not valid: ${invalidProjects.join(', ')}`
        );
        setValidating(false);
        return;
      }

      // All validations passed
      setValidationGroups(newTicketGroups);
      setValidated(true);
      setValidating(false);
    }
  }, [validating, isLoading, issuesValidation, projectsValidation]);

  const handleValidate = async () => {
    if (!jiraApi) {
      setError('No active session');
      return;
    }

    setError('');
    setValidating(true);
    const results = await Promise.all([refetchIssues(), refetchProjects()]);

    // The results effect only reacts to data, so a failed request would leave the step stuck.
    const failed = results.find((result) => result.error);
    if (failed) {
      const message = failed.error instanceof Error ? failed.error.message : String(failed.error);
      setError(`Could not reach Jira to validate tickets: ${message}`);
      setValidating(false);
    }
  };

  const handleContinue = () => {
    if (newTicketGroups.length > 0) {
      onContinue(); // Go to create tickets step
    } else {
      // Skip create tickets step, go directly to validate entries
      onContinue();
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Validate Tickets
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Check that all tickets exist in Jira and that the projects are valid
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Box
          sx={{
            flex: 1,
            p: 2,
            bgcolor: 'success.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'success.200',
          }}
        >
          <Typography variant="h4" fontWeight="bold" color="success.main">
            {existingTicketEntries.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Existing Tickets
          </Typography>
        </Box>

        <Box
          sx={{
            flex: 1,
            p: 2,
            bgcolor: 'warning.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'warning.200',
          }}
        >
          <Typography variant="h4" fontWeight="bold" color="warning.main">
            {newTicketGroups.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            New Tickets
          </Typography>
        </Box>

        <Box
          sx={{
            flex: 1,
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
      </Box>

      {/* Validation Button */}
      {!validated && (
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleValidate}
            disabled={isLoading}
            fullWidth
          >
            {isLoading ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" />
                Validating...
              </>
            ) : (
              'Validate All Tickets'
            )}
          </Button>
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Validation Results */}
      {validated && (
        <>
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
            <Typography variant="body1" fontWeight="bold">
              Validation Successful
            </Typography>
            <Typography variant="body2">
              All existing tickets are valid and the projects are available.
            </Typography>
          </Alert>

          {/* Existing Tickets */}
          {existingTicketEntries.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Validated Existing Tickets ({existingTicketEntries.length})
              </Typography>
              <List dense>
                {existingTicketEntries.slice(0, 5).map((entry) => {
                  const jiraIssue = issuesValidation?.[entry.issue.toUpperCase()];
                  const summary = jiraIssue?.fields.summary;
                  return (
                    <ListItem key={entry.id}>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={summary ? `${entry.issue} - ${summary}` : entry.issue}
                        secondary={entry.description}
                      />
                    </ListItem>
                  );
                })}
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

          {/* Divider */}
          {existingTicketEntries.length > 0 && newTicketGroups.length > 0 && (
            <Divider sx={{ my: 3 }} />
          )}

          {/* New Tickets */}
          {newTicketGroups.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                New Tickets to Create ({newTicketGroups.length})
              </Typography>
              <List dense>
                {newTicketGroups.map((group) => (
                  <ListItem key={group.groupKey}>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${group.projectKey} - ${group.title}`}
                      secondary={`${group.count} entry(ies)`}
                    />
                    <Chip label="Pending" size="small" color="warning" />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </>
      )}

      {/* Navigation */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={handleContinue}
          disabled={!validated}
        >
          {newTicketGroups.length > 0
            ? 'Continue to Create Tickets'
            : 'Continue to Validate Entries'}
        </Button>
      </Box>
    </Box>
  );
};
