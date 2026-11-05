import axios from 'axios';
import { TempoWorklog } from '../types';
import { ErrorDecision } from '../utils/parallelQueues';

export interface WorklogClient {
  createWorklog(worklog: TempoWorklog): Promise<unknown>;
  /** True if a worklog with the same issue, author, start and duration already exists. */
  findWorklog(worklog: TempoWorklog): Promise<boolean>;
}

/** The create failed, and we confirmed in Jira that nothing was written: safe to retry. */
export class WorklogNotCreatedError extends Error {}

/** The create failed in a way where it may still have been written, and Jira could not be checked. */
export class WorklogMaybeCreatedError extends Error {}

/**
 * A network error, timeout or 5xx does not tell us whether Jira stored the worklog. Creating a
 * worklog is not idempotent, so retrying blindly could log the same hours twice.
 */
const isAmbiguousFailure = (error: unknown): boolean =>
  axios.isAxiosError(error) && (!error.response || error.response.status >= 500);

/**
 * Creates the worklog. If the request fails ambiguously, checks Jira before deciding:
 * already there means success; not there means a safe retry.
 */
export async function uploadWorklog(client: WorklogClient, worklog: TempoWorklog): Promise<void> {
  try {
    await client.createWorklog(worklog);
  } catch (error) {
    if (!isAmbiguousFailure(error)) throw error;

    let exists: boolean;
    try {
      exists = await client.findWorklog(worklog);
    } catch {
      throw new WorklogMaybeCreatedError(
        `${describeApiError(error)}. Jira could not be checked, so this worklog may have been created: check the issue in Jira before retrying.`
      );
    }

    if (exists) return;
    throw new WorklogNotCreatedError(describeApiError(error));
  }
}

/** Turns an API error into a message a user can act on (Jira's own message when available). */
export function describeApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return error.code === 'ECONNABORTED' ? 'Request timed out' : 'Network error';
    }
    const data = error.response.data as
      | { errorMessages?: string[]; errors?: Record<string, string> }
      | undefined;
    const messages = [
      ...(data?.errorMessages ?? []),
      ...Object.values(data?.errors ?? {}),
    ].filter(Boolean);
    const status = `HTTP ${error.response.status}`;
    return messages.length > 0 ? `${messages.join('; ')} (${status})` : status;
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Reads Retry-After (seconds or HTTP date). The browser only exposes it if the API allows it via
 * CORS, so callers must cope with undefined and fall back to exponential backoff.
 */
export function parseRetryAfter(value: unknown, now = Date.now()): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export function classifyUploadError(error: unknown): ErrorDecision {
  if (error instanceof WorklogNotCreatedError) {
    return { action: 'retry' };
  }
  if (error instanceof WorklogMaybeCreatedError) {
    return { action: 'fail', message: error.message };
  }
  if (axios.isAxiosError(error) && error.response?.status === 429) {
    return { action: 'retry', delayMs: parseRetryAfter(error.response.headers?.['retry-after']) };
  }
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    // The 401 survived the token refresh, so the session is gone: stop everything.
    return { action: 'abort', message: 'Session expired. Sign in again, then use "Retry failed".' };
  }
  return { action: 'fail', message: describeApiError(error) };
}
