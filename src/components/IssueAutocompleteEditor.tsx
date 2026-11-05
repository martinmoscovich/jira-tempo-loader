import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { CustomCellEditorProps } from 'ag-grid-react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { JiraIssue } from '../types';

export const IssueAutocompleteEditor = forwardRef(({ value, ...props }: CustomCellEditorProps) => {
  const { jiraApi } = useAuth();
  // Use the issue value from cellEditorParams, not the displayed value
  // const initialValue = value ?? props.data?.issue ?? '';
  // const [value, setValue] = useState<string | JiraIssue | null>(initialValue);
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['issues-editor', inputValue],
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

  useEffect(() => {
    // Focus the input when the editor is opened
    setTimeout(() => {
      if (inputRef.current) {
        const input = inputRef.current.querySelector('input');
        if (input) {
          input.focus();
          input.select();
        }
      }
    }, 10);
  }, []);

  const options = data?.issues || [];

  return (
    <div ref={inputRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
      <Autocomplete
        autoHighlight
        autoComplete
        fullWidth
        freeSolo
        handleHomeEndKeys={false}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        value={value}
        inputValue={inputValue}
        onInputChange={(_, newValue) => {
          setInputValue(newValue);
          // Update finalValueRef whenever input changes
          props.onValueChange?.(newValue);
        }}
        onChange={(_, newValue) => {
          if (newValue && typeof newValue !== 'string') {
            const key = (newValue as JiraIssue).key;
            setInputValue(key);
            props.onValueChange?.(key);
          }
        }}
        options={options}
        isOptionEqualToValue={(option, value) => {
          if (typeof value === 'string') {
            return option.key === value;
          }
          return option.key === (value as JiraIssue).key;
        }}
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
            variant="standard"
            placeholder="ABC-123 or free text"
            slotProps={{
              input: {
                ...params.InputProps,
                disableUnderline: true,
                endAdornment: (
                  <>
                    {isLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
    </div>
  );
});

IssueAutocompleteEditor.displayName = 'IssueAutocompleteEditor';
