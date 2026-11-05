import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { normalizeJiraUrl } from '../utils/jiraSite';

const DEVELOPER_CONSOLE_URL = 'https://developer.atlassian.com/console/myapps/';
const JIRA_SCOPES = ['read:jira-work', 'write:jira-work', 'read:jira-user'];

interface JiraSetupHelpDialogProps {
  open: boolean;
  onClose: () => void;
  /** What the user typed in "Jira URL" (may be empty or a full issue link). */
  jiraUrl: string;
  /** Callback URL the app sends to Atlassian; it must be registered exactly as is. */
  redirectUri: string;
}

const CopyValue: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the value is still selectable on screen.
    }
  };
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        my: 0.5,
        px: 1,
        py: 0.5,
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      <Typography component="code" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', flex: 1, wordBreak: 'break-all' }}>
        {value}
      </Typography>
      <Tooltip title={copied ? 'Copied' : `Copy ${label}`}>
        <IconButton size="small" onClick={copy} aria-label={`Copy ${label}`}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <Link href={href} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
    {children}
    <OpenInNewIcon sx={{ fontSize: '0.9rem' }} aria-hidden />
  </Link>
);

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <Box component="li" sx={{ mb: 2, listStyle: 'none' }}>
    <Typography variant="subtitle2" fontWeight="bold">
      {n}. {title}
    </Typography>
    <Box sx={{ pl: 2, mt: 0.5 }}>{children}</Box>
  </Box>
);

export const JiraSetupHelpDialog: React.FC<JiraSetupHelpDialogProps> = ({ open, onClose, jiraUrl, redirectUri }) => {
  const site = normalizeJiraUrl(jiraUrl);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="jira-setup-help-title">
      <DialogTitle id="jira-setup-help-title">How to get your Jira connection details</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The app signs in with your own Atlassian OAuth app, so you create it once (about 5 minutes) and paste
          its Client ID and Secret here.
        </Typography>

        <Box component="ol" sx={{ p: 0, m: 0 }}>
          <Step n={1} title="Jira URL">
            <Typography variant="body2">
              The address of your Jira site. You can paste any Jira link (for example an issue); the site is taken
              from it.
            </Typography>
            {site ? (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Detected site: <ExternalLink href={site}>{site}</ExternalLink>
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Example: https://your-company.atlassian.net
              </Typography>
            )}
          </Step>

          <Step n={2} title="Create the OAuth app">
            <Typography variant="body2">
              Open the <ExternalLink href={DEVELOPER_CONSOLE_URL}>Atlassian developer console</ExternalLink>, sign
              in with the same account you use{site ? ` on ${site}` : ' in Jira'}, then choose{' '}
              <b>Create → OAuth 2.0 integration</b>, give it a name (e.g. "Tempo Loader") and accept the terms.
            </Typography>
          </Step>

          <Step n={3} title="Add permissions">
            <Typography variant="body2">
              In the app, go to <b>Permissions</b>:
            </Typography>
            <Typography component="ul" variant="body2" sx={{ pl: 2, my: 0.5 }}>
              <li>
                <b>Jira API</b> → Add → Configure → Edit scopes (Classic scopes) and select{' '}
                {JIRA_SCOPES.map((scope, i) => (
                  <React.Fragment key={scope}>
                    <code>{scope}</code>
                    {i < JIRA_SCOPES.length - 1 ? ', ' : ''}
                  </React.Fragment>
                ))}
                .
              </li>
              <li>
                <b>User identity API</b> → Add (gives <code>read:me</code>).
              </li>
            </Typography>
          </Step>

          <Step n={4} title="Set the callback URL">
            <Typography variant="body2">
              Go to <b>Authorization</b> → OAuth 2.0 (3LO) → Configure, and paste this as the Callback URL:
            </Typography>
            <CopyValue value={redirectUri} label="callback URL" />
          </Step>

          <Step n={5} title="Copy the Client ID and Secret">
            <Typography variant="body2">
              Go to <b>Settings</b> and copy <b>Client ID</b> and <b>Secret</b> into this form. They are saved only in
              this browser.
            </Typography>
          </Step>

          <Step n={6} title="Connect">
            <Typography variant="body2">
              Click <b>Connect to Jira</b> and, on the Atlassian consent screen, pick{' '}
              {site ? <b>{new URL(site).host}</b> : 'your Jira site'} and accept.
            </Typography>
          </Step>
        </Box>

        <Typography variant="caption" color="text.secondary" component="p">
          Teammates can use your app if you enable <b>Distribution → Sharing</b> in the console, or each person can
          create their own.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};
