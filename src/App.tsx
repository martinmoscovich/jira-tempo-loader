import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography
} from '@mui/material';
import { motion } from 'framer-motion';
import React from 'react';
import { AuthSetup } from './components/AuthSetup';
import { TempoWorkflow } from './components/TempoWorkflow';
import { useAuth } from './context/AuthContext';
import { useLocale } from './context/LocaleContext';
import { APP_LOCALES, isAppLocale } from './utils/locale';

const App: React.FC = () => {
  const { authState, logout } = useAuth();
  const { locale, setLocale } = useLocale();

  if (!authState.isAuthenticated) {
    return <AuthSetup />;
  }

  return (
    <Box
      sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}
    >
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Jira Tempo Timesheet Manager
          </Typography>
          <ToggleButtonGroup
            value={locale}
            exclusive
            size="small"
            aria-label="Date and number format"
            onChange={(_, value) => {
              if (isAppLocale(value)) setLocale(value);
            }}
            sx={{
              mr: 2,
              '& .MuiToggleButton-root': {
                color: 'inherit',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                px: 1.5,
              },
              '& .MuiToggleButton-root.Mui-selected': {
                color: 'primary.main',
                bgcolor: 'common.white',
              },
              '& .MuiToggleButton-root.Mui-selected:hover': {
                bgcolor: 'grey.100',
              },
            }}
          >
            {APP_LOCALES.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {authState.user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={authState.user.avatarUrls?.['48x48']}
                alt={authState.user.displayName}
              />
              <Typography variant="body2">
                {authState.user.displayName}
              </Typography>
              <Button color="inherit" onClick={logout}>
                Sign Out
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold">
              Time Management
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              End-to-end flow to log your hours in Tempo
            </Typography>
          </Box>

          <TempoWorkflow />
        </motion.div>
      </Container>
    </Box>
  );
};

export default App;
