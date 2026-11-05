import ReceiptIcon from '@mui/icons-material/Receipt';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useLocale } from '../context/LocaleContext';
import { generateInvoiceRows, generateInvoiceUrl } from '../services/invoice';
import {
  BillingConfig,
  classifyEpic,
  isValidDigits,
  loadBillingConfig,
  saveBillingConfig,
} from '../utils/billingConfig';

export interface EpicEntry {
  project: string;
  code: string;
  hours: number;
  hourlyRate: number;
  total: number;
}

interface MissingCodeEpic {
  key: string;
  epicText: string;
  isOrphan: boolean;
  issue?: string;
}

function getDates(headerRow: string[], firstDateIndex: number) {
  const lastDateIndex = headerRow.length - 1;
  return {
    first: headerRow[firstDateIndex]
      ? new Date(headerRow[firstDateIndex])
      : undefined,
    last: headerRow[lastDateIndex]
      ? new Date(headerRow[lastDateIndex])
      : undefined,
  };
}



export const TempoReportImport: React.FC = () => {
  const { formatNumber, formatAmount } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');
  const [entries, setEntries] = useState<EpicEntry[]>([]);
  const [missingCodeEpics, setMissingCodeEpics] = useState<MissingCodeEpic[]>(
    [],
  );
  const [error, setError] = useState('');
  const [step, setStep] = useState<'rate' | 'processing'>('rate');
  const [dateRange, setDateRange] = useState<{ first?: Date; last?: Date }>(
    {},
  );
  const [billingConfig, setBillingConfig] = useState<BillingConfig>(loadBillingConfig);
  // Kept as typed text so the digits field can be cleared while editing.
  const [codeDigitsText, setCodeDigitsText] = useState(String(billingConfig.codeDigits));

  const updateBillingConfig = (changes: Partial<BillingConfig>) => {
    const next = { ...billingConfig, ...changes };
    setBillingConfig(next);
    saveBillingConfig(next);
  };

  const rows = useMemo(() => generateInvoiceRows(entries), [entries]);
  const invouceUrl = useMemo(() => generateInvoiceUrl(rows, dateRange.first ?? dateRange.last), [rows, dateRange]);

  const handleClick = () => {
    setOpen(true);
    setStep('rate');
    setEntries([]);
    setMissingCodeEpics([]);
    setError('');
    setHourlyRate('');
  };

  const parseTempoReport = (file: File, rate: number) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as any[][];

        // Find header row
        const headerRow = jsonData.find((row) =>
          row.some(
            (cell) =>
              cell === 'Space' ||
              cell === 'Epic' ||
              cell === 'Work Item' ||
              cell === 'Key' ||
              cell === 'Logged',
          ),
        );

        if (!headerRow) {
          setError('The expected columns were not found in the file');
          return;
        }

        const headerIndex = jsonData.indexOf(headerRow);
        const projectIdx = headerRow.indexOf('Space');
        const epicIdx = headerRow.indexOf('Epic');
        const issueIdx = headerRow.indexOf('Work Item');
        const keyIdx = headerRow.indexOf('Key');
        const loggedIdx = headerRow.indexOf('Logged');

        setDateRange(
          getDates(
            headerRow,
            Math.max(projectIdx, epicIdx, issueIdx, keyIdx, loggedIdx) + 1,
          ),
        );

        if (
          projectIdx === -1 ||
          epicIdx === -1 ||
          issueIdx === -1 ||
          loggedIdx === -1
        ) {
          setError('The file is missing required columns');
          return;
        }

        const epicsWithoutCode: MissingCodeEpic[] = [];
        const entryMap = new Map<string, EpicEntry>();

        // Process rows after header
        for (let i = headerIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];

          // Check if row has Epic but no Issue
          const hasEpic = row[epicIdx] && String(row[epicIdx]).trim() !== '';
          const hasIssue = row[issueIdx] && String(row[issueIdx]).trim() !== '';

          if (hasEpic && !hasIssue) {
            const projectRaw = String(row[projectIdx] || '');
            const epicText = String(row[epicIdx] || '');
            const loggedText = String(row[loggedIdx] || '');
            const keyText = String(row[keyIdx] || '');
            const issueText = String(row[issueIdx] || '');

            const { project: displayProject, code, missingCode } = classifyEpic(
              epicText,
              projectRaw,
              billingConfig,
            );

            if (missingCode) {
              const isNoEpic = epicText.toLowerCase().trim() === 'no epic';
              epicsWithoutCode.push({
                key: keyText,
                epicText: epicText,
                isOrphan: isNoEpic,
                issue: isNoEpic ? issueText : undefined,
              });
            }

            // Parse hours from Logged column (format could be "8h" or "8:00:00" or "8")
            let hours = 0;
            if (loggedText.includes('h')) {
              hours = parseFloat(loggedText.replace('h', ''));
            } else if (loggedText.includes(':')) {
              const parts = loggedText.split(':');
              hours = parseFloat(parts[0]) + parseFloat(parts[1]) / 60;
            } else {
              hours = parseFloat(loggedText);
            }

            if (!isNaN(hours) && hours > 0) {
              // Create a unique key for project + code combination
              const entryKey = `${displayProject}|${code}`;

              // Check if entry already exists
              const existingEntry = entryMap.get(entryKey);
              if (existingEntry) {
                // Merge: sum hours and total
                existingEntry.hours += hours;
                existingEntry.total = existingEntry.hours * rate;
              } else {
                // Create new entry
                entryMap.set(entryKey, {
                  project: displayProject,
                  code,
                  hours,
                  hourlyRate: rate,
                  total: hours * rate,
                });
              }
            }
          }
        }

        // Convert map to array
        const mergedEntries = Array.from(entryMap.values());

        setEntries(mergedEntries);
        setMissingCodeEpics(epicsWithoutCode);
        setError('');
      } catch (err) {
        setError('Error processing the file. Check the format.');
        console.error(err);
      }
    };

    reader.onerror = () => {
      setError('Error reading the file');
    };

    reader.readAsBinaryString(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      setError('Enter a valid hourly rate');
      return;
    }

    setStep('processing');
    parseTempoReport(file, rate);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectFile = () => {
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      setError('Enter a valid hourly rate');
      return;
    }
    if (billingConfig.codePrefix.trim() && !isValidDigits(Number(codeDigitsText))) {
      setError('Code digits must be a whole number from 1 to 10');
      return;
    }

    setError('');
    fileInputRef.current?.click();
  };

  const handleClose = () => {
    setOpen(false);
    setHourlyRate('');
    setEntries([]);
    setMissingCodeEpics([]);
    setError('');
    setStep('rate');
  };

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalAmount = entries.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Button
        variant="outlined"
        startIcon={<ReceiptIcon />}
        onClick={handleClick}
      >
        Generate Invoice
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Import Tempo Report</DialogTitle>
        <DialogContent>
          {step === 'rate' && (
            <Box sx={{ mb: 3, mt: 2 }}>
              <TextField
                label="Hourly Rate (USD)"
                type="number"
                fullWidth
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="e.g. 25"
                autoFocus
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: 'block' }}
              >
                Enter the hourly rate to calculate the total for each epic
              </Typography>

              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                Billing settings (saved in this browser)
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Billing code prefix"
                  value={billingConfig.codePrefix}
                  onChange={(e) => updateBillingConfig({ codePrefix: e.target.value })}
                  placeholder="e.g. PRJ"
                  helperText="Code in epic titles, e.g. PRJ01234. Leave empty to skip codes."
                  sx={{ flex: 2 }}
                />
                <TextField
                  label="Code digits"
                  type="number"
                  value={codeDigitsText}
                  onChange={(e) => {
                    setCodeDigitsText(e.target.value);
                    const digits = Number(e.target.value);
                    if (isValidDigits(digits)) updateBillingConfig({ codeDigits: digits });
                  }}
                  disabled={!billingConfig.codePrefix.trim()}
                  slotProps={{ htmlInput: { min: 1, max: 10 } }}
                  sx={{ flex: 1 }}
                />
              </Box>
              <TextField
                label="Internal projects or epics"
                multiline
                minRows={2}
                fullWidth
                value={billingConfig.internalProjects.join('\n')}
                onChange={(e) => updateBillingConfig({ internalProjects: e.target.value.split('\n') })}
                helperText='One name per line. Matching projects or epics without a code are grouped as "Internal Time".'
              />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {step === 'processing' && (
            <Box>
              {missingCodeEpics.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight="bold"
                      gutterBottom
                    >
                      Epics without a billing code ({missingCodeEpics.length})
                    </Typography>
                    <Typography
                      variant="caption"
                      display="block"
                      sx={{ mb: 1 }}
                    >
                      The following epics do not have a billing code in their title:
                    </Typography>
                  </Alert>
                  <List dense>
                    {missingCodeEpics.map((epic, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={
                            epic.isOrphan
                              ? `${epic.issue} - ${epic.key}`
                              : epic.key
                          }
                          secondary={
                            epic.isOrphan
                              ? 'Orphan issue (no epic)'
                              : epic.epicText
                          }
                          primaryTypographyProps={{
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                          }}
                          secondaryTypographyProps={{
                            fontSize: '0.75rem',
                            fontStyle: epic.isOrphan ? 'italic' : 'normal',
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {entries.length > 0 && (
                <Box>
                  <Typography
                    variant="subtitle1"
                    gutterBottom
                    fontWeight="bold"
                  >
                    Epics without Issues ({entries.length})
                  </Typography>
                  <List dense>
                    {rows.map((row, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${row.description} - $${formatAmount(Number(row.price))}`}
                          slotProps={{
                            primary: { fontFamily: 'monospace' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2" fontWeight="bold">
                      Total: {formatNumber(totalHours)}h - ${formatAmount(totalAmount)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {step === 'rate' ? (
            <>
              <Button onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSelectFile} variant="contained">
                Select File
              </Button>
            </>
          ) : (
            <>
              <Button onClick={(e) => e.stopPropagation()} variant="contained">
                <a
                  style={{ textDecoration: 'none', color: 'white' }}
                  target="_blank"
                  href={invouceUrl}
                >
                  Generate Invoice
                </a>
              </Button>
              <Button onClick={handleClose} variant="contained">
                Close
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};
