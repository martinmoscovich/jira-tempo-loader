import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { TicketValidationGroup, JiraIssue } from '../types';
import { useAuth } from '../context/AuthContext';

interface TicketValidationModalProps {
  open: boolean;
  group: TicketValidationGroup;
  existingTickets: TicketValidationGroup[];
  onConfirm: (groupKey: string, data: {
    title: string;
    assignee: string;
    status: 'OPEN' | 'IN PROGRESS' | 'CLOSED';
    useExistingTicket?: string;
    parentIssueKey?: string;
  }) => void;
  onClose: () => void;
}

export const TicketValidationModal: React.FC<TicketValidationModalProps> = ({
  open,
  group,
  existingTickets,
  onConfirm,
  onClose,
}) => {
  const { authState, jiraApi } = useAuth();
  const [title, setTitle] = useState(group.title || '');
  const [assignee, setAssignee] = useState(authState.user?.accountId || '');
  const [status, setStatus] = useState<'OPEN' | 'IN PROGRESS' | 'CLOSED'>('OPEN');
  const [useExisting, setUseExisting] = useState<string | null>(null);
  const [parentIssue, setParentIssue] = useState<JiraIssue | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [error, setError] = useState('');

  const { data: parentIssuesData, isLoading: isLoadingParents } = useQuery({
    queryKey: ['parent-issues', group.projectKey, parentSearchQuery],
    queryFn: async () => {
      if (!jiraApi || !open || !parentSearchQuery) return { issues: [] };
      return jiraApi.searchIssuesInProject(group.projectKey, parentSearchQuery);
    },
    enabled: !!jiraApi && open && parentSearchQuery.length > 0,
  });

  useEffect(() => {
    setTitle(group.title || '');
    setAssignee(authState.user?.accountId || '');
    setStatus('OPEN');
    setUseExisting(null);
    setParentIssue(null);
    setParentSearchQuery('');
    setError('');
  }, [group, authState.user, open]);

  const handleConfirm = () => {
    if (!useExisting && !title.trim()) {
      setError('Title is required');
      return;
    }

    onConfirm(group.groupKey, {
      title: title.trim(),
      assignee,
      status,
      useExistingTicket: useExisting || undefined,
      parentIssueKey: parentIssue?.key,
    });
  };

  const availableTickets = existingTickets.filter(
    (t) => t.groupKey !== group.groupKey && (t.finalIssueKey || t.ticketData)
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Validate New Ticket: {group.projectKey}{group.title ? `-${group.title}` : ''}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This ticket appears {group.count} {group.count === 1 ? 'time' : 'times'} in the timesheet.
          </Typography>

          {availableTickets.length > 0 && (
            <Autocomplete
              options={availableTickets}
              getOptionLabel={(option) =>
                `${option.finalIssueKey || option.projectKey} - ${option.title || 'Untitled'}`
              }
              value={availableTickets.find(t => t.groupKey === useExisting) || null}
              onChange={(_, newValue) => {
                setUseExisting(newValue?.groupKey || null);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Use existing ticket (optional)"
                  margin="normal"
                  fullWidth
                />
              )}
              sx={{ mb: 2 }}
            />
          )}

          {!useExisting && (
            <>
              <TextField
                label="Ticket title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError('');
                }}
                fullWidth
                required
                margin="normal"
                error={!!error}
                helperText={error}
              />

              <Autocomplete
                options={parentIssuesData?.issues || []}
                getOptionLabel={(option) => `${option.key} - ${option.fields.summary}`}
                value={parentIssue}
                onChange={(_, newValue) => {
                  setParentIssue(newValue);
                }}
                inputValue={parentSearchQuery}
                onInputChange={(_, newValue) => {
                  setParentSearchQuery(newValue);
                }}
                loading={isLoadingParents}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Parent ticket (optional)"
                    margin="normal"
                    fullWidth
                    helperText={`Search tickets in project ${group.projectKey}`}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isLoadingParents ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              <TextField
                label="Assigned to"
                value={authState.user?.displayName || 'Current user'}
                fullWidth
                margin="normal"
                disabled
                helperText="The ticket will be assigned to you"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  label="Status"
                  onChange={(e) => setStatus(e.target.value as 'OPEN' | 'IN PROGRESS' | 'CLOSED')}
                >
                  <MenuItem value="OPEN">OPEN</MenuItem>
                  <MenuItem value="IN PROGRESS">IN PROGRESS</MenuItem>
                  <MenuItem value="CLOSED">CLOSED</MenuItem>
                </Select>
              </FormControl>
            </>
          )}

          {useExisting && (
            <Typography variant="body2" color="info.main" sx={{ mt: 2 }}>
              Entries will be assigned to the selected ticket instead of creating a new one.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained">
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};
