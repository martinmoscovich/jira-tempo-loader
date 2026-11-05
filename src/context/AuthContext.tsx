import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { JiraApiService } from '../services/jiraApi';
import { MockJiraApiService } from '../services/mockJiraApi';
import { MockTempoApiService } from '../services/mockTempoApi';
import { TempoApiService } from '../services/tempoApi';
import { AuthConfig, AuthState } from '../types';
import {
  clearAuthState,
  handleOAuthCallback,
  initiateOAuthFlow,
  loadAuthConfig,
  loadAuthState,
  refreshAccessToken,
  saveAuthConfig,
  saveAuthState,
} from '../utils/auth';

interface AuthContextType {
  authState: AuthState;
  authConfig: AuthConfig | null;
  jiraApi: JiraApiService | null;
  tempoApi: TempoApiService | null;
  login: (config: AuthConfig) => Promise<void>;
  logout: () => void;
  setConfig: (config: AuthConfig) => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(loadAuthState());
  const [authConfig, setAuthConfigState] = useState<AuthConfig | null>(loadAuthConfig());
  const [jiraApi, setJiraApi] = useState<JiraApiService | null>(null);
  const [tempoApi, setTempoApi] = useState<TempoApiService | null>(null);
  const isProcessingCallback = useRef(false);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const logout = () => {
    clearAuthState();
    // Clear saved credentials when logging out
    localStorage.removeItem('jira_credentials');
    setAuthState({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      cloudId: null,
      user: null,
    });

    // Remove mock=true parameter from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('mock')) {
      urlParams.delete('mock');
      const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  };

  // This handler is captured by the API instances when they are created, so it must not read
  // React state (it would be stale). It reads the current session from storage instead, and
  // returns the new token so each instance updates itself.
  const refreshSession = async (): Promise<string | null> => {
    const storedAuth = loadAuthState();
    const storedConfig = loadAuthConfig();

    if (!storedAuth.refreshToken || !storedConfig) {
      alert('Your session has expired. Please sign in again.');
      logout();
      return null;
    }

    try {
      const newAuthState = await refreshAccessToken(storedAuth.refreshToken, storedConfig);
      setAuthState(newAuthState);
      console.log('Token refreshed successfully');
      return newAuthState.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      alert('Your session has expired. Please sign in again.');
      logout();
      return null;
    }
  };

  // Jira and Tempo instances can both hit a 401 at once: share a single refresh, because
  // Atlassian rotates refresh tokens and a second refresh with the old one can fail.
  const handleUnauthorized = (): Promise<string | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshSession().finally(() => {
        refreshInFlight.current = null;
      });
    }
    return refreshInFlight.current;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // Skip if already processing, already authenticated, or in mock mode
    const isMockMode = !authConfig?.jiraUrl || authConfig.jiraUrl.trim() === '';

    if (code && authConfig && !isMockMode && !isProcessingCallback.current && !authState.isAuthenticated) {
      isProcessingCallback.current = true;

      handleOAuthCallback(code, authConfig)
        .then((newAuthState) => {
          setAuthState(newAuthState);
          window.history.replaceState({}, document.title, window.location.pathname);
          isProcessingCallback.current = false;
        })
        .catch((error) => {
          console.error('OAuth callback error:', error);
          isProcessingCallback.current = false;
        });
    }
  }, [authConfig, authState.isAuthenticated]);

  useEffect(() => {
    if (authState.isAuthenticated && authState.accessToken && authState.cloudId) {
      // Check if mock mode
      const isMockMode = authState.accessToken === 'mock-access-token' && authState.cloudId === 'mock-cloud-id';

      if (isMockMode) {
        // Use mock services
        setJiraApi(new MockJiraApiService() as any);
        setTempoApi(new MockTempoApiService() as any);
      } else {
        // Use real services
        setJiraApi(new JiraApiService(authState.accessToken, authState.cloudId, handleUnauthorized));
        setTempoApi(new TempoApiService(authState.accessToken, authState.cloudId, handleUnauthorized));
      }
    } else {
      setJiraApi(null);
      setTempoApi(null);
    }
  }, [authState.isAuthenticated, authState.cloudId]);

  const login = async (config: AuthConfig) => {
    setConfig(config);

    // Check if mock mode (empty Jira URL)
    if (!config.jiraUrl || config.jiraUrl.trim() === '') {
      // Enable mock mode
      const mockJiraApi = new MockJiraApiService();
      const mockUser = await mockJiraApi.getCurrentUser();

      const mockAuthState: AuthState = {
        isAuthenticated: true,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        cloudId: 'mock-cloud-id',
        user: mockUser,
      };

      setAuthState(mockAuthState);
      saveAuthState(mockAuthState);
    } else {
      // Normal OAuth flow
      await initiateOAuthFlow(config);
    }
  };

  const setConfig = (config: AuthConfig) => {
    if(config.jiraUrl && !config.jiraUrl.endsWith('/')) config.jiraUrl += '/';
    setAuthConfigState(config);
    saveAuthConfig(config);
  };

  const refreshToken = async () => {
    if (authState.refreshToken && authConfig) {
      try {
        const newAuthState = await refreshAccessToken(authState.refreshToken, authConfig);
        setAuthState(newAuthState);
      } catch (error) {
        console.error('Token refresh error:', error);
        logout();
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        authState,
        authConfig,
        jiraApi,
        tempoApi,
        login,
        logout,
        setConfig,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
