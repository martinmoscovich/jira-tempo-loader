import { describe, expect, it } from 'vitest';
import { normalizeJiraUrl, pickSite } from './jiraSite';

describe('normalizeJiraUrl', () => {
  it('extracts the site root from any pasted Jira link', () => {
    expect(normalizeJiraUrl('https://acme.atlassian.net/browse/AB2C-8')).toBe('https://acme.atlassian.net/');
    expect(normalizeJiraUrl(' acme.atlassian.net ')).toBe('https://acme.atlassian.net/');
    expect(normalizeJiraUrl('acme')).toBe('https://acme.atlassian.net/');
    expect(normalizeJiraUrl('https://ACME.atlassian.net')).toBe('https://acme.atlassian.net/');
  });

  it('rejects input that is not a site', () => {
    expect(normalizeJiraUrl('')).toBeNull();
    expect(normalizeJiraUrl('not a url')).toBeNull();
  });
});

describe('pickSite', () => {
  const sites = [
    { id: 'other', url: 'https://other.atlassian.net' },
    { id: 'acme', url: 'https://acme.atlassian.net' },
  ];

  // The first accessible site is not necessarily the one the user configured.
  it('picks the site matching the Jira URL, not the first one', () => {
    expect(pickSite(sites, 'https://acme.atlassian.net/browse/X-1').id).toBe('acme');
  });

  it('fails with the available sites when the configured one was not authorized', () => {
    expect(() => pickSite(sites, 'https://missing.atlassian.net')).toThrow(/other\.atlassian\.net/);
  });

  it('fails when there are no sites', () => {
    expect(() => pickSite([], 'acme')).toThrow('No accessible Jira sites found');
  });
});
