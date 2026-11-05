import axios, { AxiosInstance } from 'axios';

/**
 * Called when a request gets a 401. Must refresh the session and resolve with the new
 * access token, or resolve with null when the session cannot be recovered.
 */
export type UnauthorizedHandler = () => Promise<string | null>;

export abstract class RestApi {
  protected client: AxiosInstance;
  private accessToken: string;
  private onUnauthorized?: UnauthorizedHandler;
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(
    baseURL: string,
    accessToken: string,
    onUnauthorized?: UnauthorizedHandler
  ) {
    this.accessToken = accessToken;
    this.onUnauthorized = onUnauthorized;
    this.client = axios.create({
      baseURL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Set the token per request (not on the instance) so retries and later requests
    // always use the current token after a refresh.
    this.client.interceptors.request.use((config) => {
      config.headers.set('Authorization', `Bearer ${this.accessToken}`);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && this.onUnauthorized) {
          originalRequest._retry = true;

          // Concurrent 401s share one refresh instead of each starting their own.
          if (!this.refreshInFlight) {
            this.refreshInFlight = this.onUnauthorized().finally(() => {
              this.refreshInFlight = null;
            });
          }

          const newToken = await this.refreshInFlight;
          if (!newToken) {
            return Promise.reject(error);
          }

          this.accessToken = newToken;
          return this.client(originalRequest);
        }
        return Promise.reject(error);
      }
    );
  }

  updateAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }
}
