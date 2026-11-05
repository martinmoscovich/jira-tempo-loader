import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { TempoWorklog } from '../types';
import {
  classifyUploadError,
  describeApiError,
  parseRetryAfter,
  uploadWorklog,
  WorklogClient,
  WorklogMaybeCreatedError,
  WorklogNotCreatedError,
} from './worklogUpload';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

const httpError = (status: number, data: unknown = {}, headers: Record<string, string> = {}) =>
  new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    data,
    headers,
    config,
  } as AxiosResponse);

const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK', config, null, undefined);

const worklog: TempoWorklog = {
  issueKey: 'AB2C-8',
  timeSpentSeconds: 3600,
  startDate: '2026-11-05',
  startTime: '09:00',
  description: 'Work',
  authorAccountId: 'me',
};

const client = (create: () => Promise<unknown>, find: () => Promise<boolean>): WorklogClient => ({
  createWorklog: vi.fn(create),
  findWorklog: vi.fn(find),
});

describe('uploadWorklog', () => {
  it('does not check Jira when the create succeeds', async () => {
    const api = client(async () => ({}), async () => false);
    await uploadWorklog(api, worklog);
    expect(api.findWorklog).not.toHaveBeenCalled();
  });

  // Creating a worklog is not idempotent: after an ambiguous failure, retrying blindly could log
  // the same hours twice, so Jira is checked first.
  it('treats an ambiguous failure as success when the worklog was actually created', async () => {
    const api = client(() => Promise.reject(httpError(504)), async () => true);
    await expect(uploadWorklog(api, worklog)).resolves.toBeUndefined();
  });

  it('marks it safe to retry when Jira confirms nothing was created', async () => {
    const api = client(() => Promise.reject(networkError()), async () => false);
    await expect(uploadWorklog(api, worklog)).rejects.toBeInstanceOf(WorklogNotCreatedError);
  });

  it('refuses to retry when Jira cannot be checked', async () => {
    const api = client(() => Promise.reject(httpError(502)), () => Promise.reject(networkError()));
    await expect(uploadWorklog(api, worklog)).rejects.toBeInstanceOf(WorklogMaybeCreatedError);
  });

  it('does not check Jira for errors where nothing was written (4xx)', async () => {
    const api = client(() => Promise.reject(httpError(429)), async () => false);
    await expect(uploadWorklog(api, worklog)).rejects.toMatchObject({ response: { status: 429 } });
    expect(api.findWorklog).not.toHaveBeenCalled();
  });
});

describe('classifyUploadError', () => {
  it('retries 429 using Retry-After when the header is readable', () => {
    expect(classifyUploadError(httpError(429, {}, { 'retry-after': '7' }))).toEqual({
      action: 'retry',
      delayMs: 7000,
    });
  });

  it('retries 429 with backoff when Retry-After is not exposed', () => {
    expect(classifyUploadError(httpError(429))).toEqual({ action: 'retry', delayMs: undefined });
  });

  it('retries only failures verified as not created', () => {
    expect(classifyUploadError(new WorklogNotCreatedError('x'))).toEqual({ action: 'retry' });
    expect(classifyUploadError(new WorklogMaybeCreatedError('check Jira'))).toEqual({
      action: 'fail',
      message: 'check Jira',
    });
  });

  it('aborts the whole run on 401', () => {
    expect(classifyUploadError(httpError(401)).action).toBe('abort');
  });

  it('fails other client errors with the Jira message', () => {
    expect(
      classifyUploadError(httpError(400, { errorMessages: [], errors: { timeLogged: 'Invalid time' } }))
    ).toEqual({ action: 'fail', message: 'Invalid time (HTTP 400)' });
  });
});

describe('describeApiError / parseRetryAfter', () => {
  it('prefers Jira error messages over the generic axios text', () => {
    expect(describeApiError(httpError(404, { errorMessages: ['Issue does not exist'] }))).toBe(
      'Issue does not exist (HTTP 404)'
    );
    expect(describeApiError(networkError())).toBe('Network error');
  });

  it('parses seconds and HTTP dates', () => {
    const now = Date.parse('2026-11-05T12:00:00Z');
    expect(parseRetryAfter('3', now)).toBe(3000);
    expect(parseRetryAfter('Thu, 05 Nov 2026 12:00:10 GMT', now)).toBe(10000);
    expect(parseRetryAfter(undefined, now)).toBeUndefined();
    expect(parseRetryAfter('soon', now)).toBeUndefined();
  });
});
