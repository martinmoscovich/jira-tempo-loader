import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import {
  CLIPBOARD_COLUMNS,
  CLIPBOARD_DATE_FORMATS,
  clipboardExampleRows,
  clipboardExampleText,
} from '../utils/clipboardFormat';
import { AppLocale, APP_LOCALES } from '../utils/locale';

interface ClipboardFormatHelpDialogProps {
  open: boolean;
  onClose: () => void;
  /** The date format selected at the top of the page; paste and copy use it. */
  locale: AppLocale;
}

export const ClipboardFormatHelpDialog: React.FC<ClipboardFormatHelpDialogProps> = ({ open, onClose, locale }) => {
  const [copied, setCopied] = useState(false);
  const dateFormat = CLIPBOARD_DATE_FORMATS[locale];
  const localeLabel = APP_LOCALES.find((option) => option.value === locale)?.label ?? locale;

  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(clipboardExampleText(locale));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the example is still visible in the table.
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="clipboard-format-title">
      <DialogTitle id="clipboard-format-title">Clipboard format</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Select the cells in Google Sheets or Excel, copy them (Ctrl+C) and click <b>Paste from Clipboard</b>.
          Columns must be in this order:
        </Typography>

        <TableContainer sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" aria-label="Clipboard format example">
            <TableHead>
              <TableRow>
                {CLIPBOARD_COLUMNS.map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 'bold' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {clipboardExampleRows(locale).map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex} sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.75 } }}>
          <Typography component="li" variant="body2">
            <b>Date</b>: <code>{dateFormat.short}</code> or <code>{dateFormat.full}</code> (without a year, the
            current year is used), because the date format selected at the top of the page is{' '}
            <b>{localeLabel}</b>. Switch it to {locale === 'es' ? 'EN-US' : 'ES'} for{' '}
            <code>{CLIPBOARD_DATE_FORMATS[locale === 'es' ? 'en-US' : 'es'].short}</code>. The date can be on its own
            row or on the first entry of the day; rows below reuse it until the next date.
          </Typography>
          <Typography component="li" variant="body2">
            <b>Start / End</b>: 24-hour <code>HH:MM</code>. A row with an invalid time is still imported with that
            time empty, so you can fix it in the table.
          </Typography>
          <Typography component="li" variant="body2">
            <b>Duration</b>: ignored (it is calculated), but the column must be there, even if empty.
          </Typography>
          <Typography component="li" variant="body2">
            <b>Ticket</b>: an existing key (<code>ABC-123</code>), a project to create a new ticket in (
            <code>DEF</code>), or a project and title (<code>ABC-New Feature</code>). With{' '}
            <code>ABC-124 Code review</code>, the text after the key becomes the description.
          </Typography>
          <Typography component="li" variant="body2">
            <b>Description</b>: free text.
          </Typography>
          <Typography component="li" variant="body2">
            A header row is skipped. Pasting replaces the entries already in the table.
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          The <b>Copy</b> button exports the table in this same format (dates as <code>{dateFormat.short}</code>), so
          you can paste it back into your sheet.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button startIcon={<ContentCopyIcon />} onClick={copyExample}>
          {copied ? 'Example copied' : 'Copy example'}
        </Button>
        <Button onClick={onClose} variant="contained">
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};
