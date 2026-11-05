import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export const AuthSetup: React.FC = () => {
  const { login, authConfig, setConfig, logout } = useAuth();
  const [jiraUrl, setJiraUrl] = useState(authConfig?.jiraUrl || '');
  const [clientId, setClientId] = useState(authConfig?.clientId || '');
  const [clientSecret, setClientSecret] = useState(authConfig?.clientSecret || '');
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [error, setError] = useState('');
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  // Check for mock mode query parameter and load/auto-submit saved credentials
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isMockMode = urlParams.get('mock') === 'true';
    const hasOAuthCode = urlParams.has('code');

    // Don't auto-login if we're processing an OAuth callback
    if (hasOAuthCode) {
      return;
    }

    if (isMockMode) {
      // Logout any existing session before entering mock mode
      logout();

      // Auto-login in mock mode
      setIsAutoLoggingIn(true);
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const config = {
        jiraUrl: '',
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret',
        redirectUri,
      };
      setConfig(config);
      login(config).catch((err) => {
        console.error('Error starting mock mode:', err);
        setIsAutoLoggingIn(false);
      });
      return;
    }

    // Load saved credentials into form
    const savedCredentials = localStorage.getItem('jira_credentials');
    if (savedCredentials) {
      try {
        const { jiraUrl: savedUrl, clientId: savedClientId, clientSecret: savedSecret } = JSON.parse(savedCredentials);
        if (savedUrl && savedClientId && savedSecret) {
          setJiraUrl(savedUrl);
          setClientId(savedClientId);
          setClientSecret(savedSecret);
          setRememberCredentials(true);

          // Auto-submit the form with saved credentials
          const redirectUri = `${window.location.origin}${window.location.pathname}`;
          const config = {
            jiraUrl: savedUrl,
            clientId: savedClientId,
            clientSecret: savedSecret,
            redirectUri,
          };
          setConfig(config);
          login(config).catch((err) => {
            console.error('Error signing in automatically:', err);
            setError('Automatic sign-in failed. Please check your credentials.');
          });
        }
      } catch (err) {
        console.error('Error loading saved credentials:', err);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!jiraUrl || !clientId || !clientSecret) {
      setError('All fields are required');
      return;
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    const config = {
      jiraUrl,
      clientId,
      clientSecret,
      redirectUri,
    };

    // Save or clear credentials based on checkbox
    if (rememberCredentials) {
      localStorage.setItem('jira_credentials', JSON.stringify({
        jiraUrl,
        clientId,
        clientSecret,
      }));
    } else {
      localStorage.removeItem('jira_credentials');
    }

    setConfig(config);

    try {
      await login(config);
    } catch (err) {
      setError('Sign-in failed. Check your credentials.');
    }
  };

  // Show loading state during auto-login
  if (isAutoLoggingIn) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card elevation={3}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom align="center" fontWeight="bold">
                  Jira Tempo Timesheet
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                  Signing in...
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card elevation={3}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h4" gutterBottom align="center" fontWeight="bold">
                Jira Tempo Timesheet
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                Set up your Jira connection to get started
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Jira URL"
                  placeholder="https://your-company.atlassian.net"
                  value={jiraUrl}
                  onChange={(e) => setJiraUrl(e.target.value)}
                  margin="normal"
                  required
                />
                <TextField
                  fullWidth
                  label="Client ID"
                  placeholder="Your OAuth Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  margin="normal"
                  required
                />
                <TextField
                  fullWidth
                  label="Client Secret"
                  placeholder="Your OAuth Client Secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  margin="normal"
                  required
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberCredentials}
                      onChange={(e) => setRememberCredentials(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Remember credentials
                    </Typography>
                  }
                  sx={{ mt: 2 }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  sx={{ mt: 2 }}
                >
                  Connect to Jira
                </Button>
              </form>

              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  You need to create an OAuth app in Jira Cloud to get the Client ID and Client Secret.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </Container>
  );
};
