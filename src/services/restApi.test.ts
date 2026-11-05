import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { RestApi, UnauthorizedHandler } from './restApi';

class TestApi extends RestApi {
  get(path: string) {
    return this.client.get(path);
  }
}

/**
 * Fake transport: 200 only for the current valid token, 401 otherwise.
 * Records the Authorization header of every request it receives.
 */
const createServer = (validToken: string) => {
  const seenTokens: string[] = [];
  const adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const auth = String(config.headers.get('Authorization'));
    seenTokens.push(auth);
    const response = { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    if (auth === `Bearer ${validToken}`) {
      return response;
    }
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
      ...response,
      status: 401,
      statusText: 'Unauthorized',
    });
  };
  return { adapter, seenTokens };
};

const createApi = (onUnauthorized: UnauthorizedHandler, validToken = 'fresh') => {
  const server = createServer(validToken);
  const api = new TestApi('https://jira.test', 'expired', onUnauthorized);
  (api as unknown as { client: { defaults: { adapter: unknown } } }).client.defaults.adapter = server.adapter;
  return { api, server };
};

describe('RestApi token refresh', () => {
  // Regression: the retry used to resend the expired token, so the first validation after
  // the token expired always failed until the page was reloaded.
  it('retries a 401 with the refreshed token and keeps using it', async () => {
    const onUnauthorized = vi.fn().mockResolvedValue('fresh');
    const { api, server } = createApi(onUnauthorized);

    await expect(api.get('/issue')).resolves.toMatchObject({ status: 200 });
    await expect(api.get('/issue')).resolves.toMatchObject({ status: 200 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(server.seenTokens).toEqual(['Bearer expired', 'Bearer fresh', 'Bearer fresh']);
  });

  it('runs a single refresh for concurrent 401s', async () => {
    const onUnauthorized = vi.fn().mockResolvedValue('fresh');
    const { api } = createApi(onUnauthorized);

    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('rejects with the original 401 when the session cannot be refreshed', async () => {
    const onUnauthorized = vi.fn().mockResolvedValue(null);
    const { api } = createApi(onUnauthorized);

    await expect(api.get('/issue')).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('does not loop when the refreshed token is also rejected', async () => {
    const onUnauthorized = vi.fn().mockResolvedValue('still-bad');
    const { api } = createApi(onUnauthorized);

    await expect(api.get('/issue')).rejects.toMatchObject({ response: { status: 401 } });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
