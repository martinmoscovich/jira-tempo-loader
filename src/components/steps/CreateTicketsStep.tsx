import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTimesheet } from '../../context/TimesheetContext';
import { NewTicketData } from '../../types';
import { IssueAutocomplete } from '../IssueAutocomplete';

interface CreateTicketsStepProps {
  onContinue: () => void;
  onBack: () => void;
}

interface TicketFormData {
  title: string;
  assignee: string;
  status: 'OPEN' | 'IN PROGRESS' | 'CLOSED';
  parentIssueKey?: string;
  useExistingTicket?: string;
}

export const CreateTicketsStep: React.FC<CreateTicketsStepProps> = ({
  onContinue,
  onBack,
}) => {
  const { validationGroups, updateValidationGroup, updateEntry } = useTimesheet();
  const { jiraApi, authState } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | false>(
    validationGroups[0]?.groupKey || false
  );
  const [createdCount, setCreatedCount] = useState(0);

  // Initialize form data for each group
  const [formData, setFormData] = useState<Record<string, TicketFormData>>(() => {
    const initial: Record<string, TicketFormData> = {};
    validationGroups.forEach((group) => {
      initial[group.groupKey] = {
        title: group.title,
        assignee: authState.user?.accountId || '',
        status: 'OPEN',
        parentIssueKey: '',
        useExistingTicket: '',
      };
    });
    return initial;
  });

  const handleFormChange = (
    groupKey: string,
    field: keyof TicketFormData,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [groupKey]: {
        ...prev[groupKey],
        [field]: value,
      },
    }));
  };

  const handleAccordionChange =
    (groupKey: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedGroup(isExpanded ? groupKey : false);
    };

  const validateGroup = (groupKey: string): boolean => {
    const data = formData[groupKey];
    if (data.useExistingTicket) return true;
    return data.title.trim().length > 0 && data.assignee.trim().length > 0;
  };

  const handleCreateAll = async () => {
    if (!jiraApi || !authState.user) {
      setError('No active session');
      return;
    }

    // Validate all groups
    for (const group of validationGroups) {
      if (!validateGroup(group.groupKey)) {
        setError(
          `Please fill in all required fields for ticket: ${group.projectKey} - ${group.title}`
        );
        setExpandedGroup(group.groupKey);
        return;
      }
    }

    setCreating(true);
    setError('');
    setCreatedCount(0);

    try {
      for (let i = 0; i < validationGroups.length; i++) {
        const group = validationGroups[i];
        const data = formData[group.groupKey];

        if (data.useExistingTicket) {
          // Link to existing ticket
          const existingGroup = validationGroups.find(
            (g) => g.groupKey === data.useExistingTicket
          );
          if (existingGroup?.finalIssueKey) {
            updateValidationGroup(group.groupKey, {
              finalIssueKey: existingGroup.finalIssueKey,
            });

            group.entryIds.forEach((entryId) => {
              updateEntry(entryId, { issue: existingGroup.finalIssueKey });
            });
          }
        } else {
          // Create new ticket
          const ticketData: NewTicketData = {
            projectKey: group.projectKey,
            title: data.title,
            assignee: data.assignee,
            status: data.status,
            originalReference: group.projectKey,
            parentIssueKey: data.parentIssueKey || undefined,
          };

          const issue = await jiraApi.createIssue(ticketData, authState.user.accountId);

          updateValidationGroup(group.groupKey, {
            finalIssueKey: issue.key,
            ticketData,
          });

          group.entryIds.forEach((entryId) => {
            updateEntry(entryId, { issue: issue.key, isNew: true });
          });
        }

        setCreatedCount(i + 1);
      }

      setSuccess(
        `${validationGroups.length} ticket(s) created or linked successfully`
      );
      setTimeout(() => {
        onContinue();
      }, 1500);
    } catch (err) {
      setError(
        `Error creating tickets: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setCreating(false);
    }
  };

  const allGroupsConfigured = validationGroups.every((group) =>
    validateGroup(group.groupKey)
  );
  const allGroupsCreated = validationGroups.every((group) => group.finalIssueKey);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Create New Tickets
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure the details for each new ticket to be created in Jira
        </Typography>
      </Box>

      {/* Progress */}
      {creating && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            Creating tickets... {createdCount} of {validationGroups.length}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(createdCount / validationGroups.length) * 100}
          />
        </Box>
      )}

      {/* Success Alert */}
      {success && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Ticket Forms */}
      <Box sx={{ mb: 3 }}>
        {validationGroups.map((group, index) => {
          const data = formData[group.groupKey];
          const isValid = validateGroup(group.groupKey);
          const isCreated = !!group.finalIssueKey;

          return (
            <Accordion
              key={group.groupKey}
              expanded={expandedGroup === group.groupKey}
              onChange={handleAccordionChange(group.groupKey)}
              disabled={creating || isCreated}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    width: '100%',
                  }}
                >
                  <Typography sx={{ flexShrink: 0, width: 30 }}>
                    #{index + 1}
                  </Typography>
                  <Typography sx={{ flex: 1 }} fontWeight="medium">
                    {group.projectKey} - {group.title}
                  </Typography>
                  <Chip label={`${group.count} entry(ies)`} size="small" />
                  {isCreated ? (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label={group.finalIssueKey}
                      color="success"
                      size="small"
                    />
                  ) : isValid ? (
                    <Chip label="Ready" color="primary" size="small" />
                  ) : (
                    <Chip label="Pending" size="small" />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Title */}
                  <TextField
                    label="Ticket Title"
                    value={data.title}
                    onChange={(e) =>
                      handleFormChange(group.groupKey, 'title', e.target.value)
                    }
                    fullWidth
                    required
                    disabled={!!data.useExistingTicket}
                  />

                  {/* Assignee */}
                  <TextField
                    label="Assignee"
                    value={data.assignee}
                    onChange={(e) =>
                      handleFormChange(group.groupKey, 'assignee', e.target.value)
                    }
                    fullWidth
                    required
                    disabled={!!data.useExistingTicket}
                    helperText="Jira Account ID"
                  />

                  {/* Status */}
                  <FormControl fullWidth disabled={!!data.useExistingTicket}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={data.status}
                      label="Status"
                      onChange={(e) =>
                        handleFormChange(
                          group.groupKey,
                          'status',
                          e.target.value as 'OPEN' | 'IN PROGRESS' | 'CLOSED'
                        )
                      }
                    >
                      <MenuItem value="OPEN">Open</MenuItem>
                      <MenuItem value="IN PROGRESS">In Progress</MenuItem>
                      <MenuItem value="CLOSED">Closed</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Parent Issue */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Parent Ticket (optional)
                    </Typography>
                    <IssueAutocomplete
                      value={data.parentIssueKey || ''}
                      onChange={(value) =>
                        handleFormChange(group.groupKey, 'parentIssueKey', value)
                      }
                      disabled={!!data.useExistingTicket}
                    />
                  </Box>

                  {/* Link to existing ticket option */}
                  {index > 0 && (
                    <FormControl fullWidth>
                      <InputLabel>Or link to existing ticket</InputLabel>
                      <Select
                        value={data.useExistingTicket || ''}
                        label="Or link to existing ticket"
                        onChange={(e) =>
                          handleFormChange(
                            group.groupKey,
                            'useExistingTicket',
                            e.target.value
                          )
                        }
                      >
                        <MenuItem value="">
                          <em>Create new ticket</em>
                        </MenuItem>
                        {validationGroups
                          .filter((g) => g.finalIssueKey && g.groupKey !== group.groupKey)
                          .map((g) => (
                            <MenuItem key={g.groupKey} value={g.groupKey}>
                              {g.finalIssueKey} - {g.title}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onBack} disabled={creating}>
          Back
        </Button>
        <Button
          variant="contained"
          size="large"
          startIcon={creating ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
          onClick={handleCreateAll}
          disabled={!allGroupsConfigured || creating || allGroupsCreated}
        >
          {creating
            ? 'Creating Tickets...'
            : allGroupsCreated
            ? 'Tickets Created'
            : `Create ${validationGroups.length} Ticket(s)`}
        </Button>
      </Box>
    </Box>
  );
};
