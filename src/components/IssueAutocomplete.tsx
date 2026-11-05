import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress, Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { JiraIssue } from '../types';

interface IssueAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
}

export const IssueAutocomplete: React.FC<IssueAutocompleteProps> = ({
  value,
  onChange,
  error,
  helperText,
  disabled,
}) => {
  const { jiraApi } = useAuth();
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['issues', inputValue],
    queryFn: async () => {
      if (!jiraApi || !inputValue || inputValue.length < 2) {
        return { issues: [] };
      }
      return jiraApi.searchIssues(inputValue);
    },
    enabled: !!jiraApi && inputValue.length >= 2,
    staleTime: 30000,
  });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const options = data?.issues || [];

  return (
    <Autocomplete
      fullWidth
      freeSolo
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, newValue) => {
        setInputValue(newValue);
      }}
      onChange={(_, newValue) => {
        if (typeof newValue === 'string') {
          onChange(newValue);
        } else if (newValue) {
          onChange((newValue as JiraIssue).key);
        }
      }}
      options={options}
      getOptionLabel={(option) => {
        if (typeof option === 'string') return option;
        return option.key;
      }}
      loading={isLoading}
      renderOption={(props, option) => (
        <Box component="li" {...props}>
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {(option as JiraIssue).key}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {(option as JiraIssue).fields.summary}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Ticket"
          placeholder="ABC-123 or free text"
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};
