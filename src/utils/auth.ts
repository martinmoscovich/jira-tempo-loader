import { AuthConfig, AuthState } from '../types';

const AUTH_STORAGE_KEY = 'jira_tempo_auth';
const CONFIG_STORAGE_KEY = 'jira_tempo_config';

export const generateCodeVerifier = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export const initiateOAuthFlow = async (config: AuthConfig): Promise<void> => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  sessionStorage.setItem('code_verifier', codeVerifier);

  const authUrl = new URL('https://auth.atlassian.com/authorize');
  authUrl.searchParams.append('audience', 'api.atlassian.com');
  authUrl.searchParams.append('client_id', config.clientId);
  authUrl.searchParams.append('scope', 'offline_access read:me read:jira-user read:jira-work write:jira-work');
  authUrl.searchParams.append('redirect_uri', config.redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  window.location.href = authUrl.toString();
};

export const handleOAuthCallback = async (code: string, config: AuthConfig): Promise<AuthState> => {
  const codeVerifier = sessionStorage.getItem('code_verifier');
  if (!codeVerifier) {
    throw new Error('Code verifier not found');
  }

  const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token exchange failed:', errorText);
    throw new Error(`Failed to exchange code for token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();

  const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/json',
    },
  });

  if (!resourcesResponse.ok) {
    const errorText = await resourcesResponse.text();
    console.error('Failed to get accessible resources:', resourcesResponse.status, errorText);
    throw new Error(`Failed to get accessible resources: ${resourcesResponse.status} ${errorText}`);
  }

  const resources = await resourcesResponse.json();
  const cloudId = resources[0]?.id;

  if (!cloudId) {
    throw new Error('No accessible Jira sites found');
  }

  let userResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/json',
    },
  });

  let currentAccessToken = tokenData.access_token;
  let currentRefreshToken = tokenData.refresh_token;

  // If 401, try to refresh the token and retry once
  if (userResponse.status === 401 && tokenData.refresh_token) {
    try {
      console.log('Initial /myself request failed with 401, attempting token refresh...');
      const refreshedTokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: tokenData.refresh_token,
        }),
      });

      if (refreshedTokenResponse.ok) {
        const refreshedTokenData = await refreshedTokenResponse.json();
        currentAccessToken = refreshedTokenData.access_token;
        currentRefreshToken = refreshedTokenData.refresh_token || tokenData.refresh_token;

        console.log('Token refreshed successfully, retrying /myself request...');

        // Retry the /myself request with the new token
        userResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
          headers: {
            Authorization: `Bearer ${currentAccessToken}`,
            Accept: 'application/json',
          },
        });
      } else {
        console.error('Token refresh failed during OAuth callback:', await refreshedTokenResponse.text());
      }
    } catch (refreshError) {
      console.error('Error refreshing token during OAuth callback:', refreshError);
    }
  }

  const user = await userResponse.json();

  const authState: AuthState = {
    isAuthenticated: true,
    accessToken: currentAccessToken,
    refreshToken: currentRefreshToken,
    cloudId,
    user,
  };

  saveAuthState(authState);
  sessionStorage.removeItem('code_verifier');

  return authState;
};

export const refreshAccessToken = async (refreshToken: string, config: AuthConfig): Promise<AuthState> => {
  const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token refresh failed:', errorText);
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  const currentAuth = loadAuthState();

  const authState: AuthState = {
    ...currentAuth,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || currentAuth.refreshToken,
  };

  saveAuthState(authState);
  return authState;
};

export const saveAuthState = (state: AuthState): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
};

export const loadAuthState = (): AuthState => {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) {
    return {
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      cloudId: null,
      user: null,
    };
  }
  return JSON.parse(stored);
};

export const clearAuthState = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const saveAuthConfig = (config: AuthConfig): void => {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
};

export const loadAuthConfig = (): AuthConfig | null => {
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
};
