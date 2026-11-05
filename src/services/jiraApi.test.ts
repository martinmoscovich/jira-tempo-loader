import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { JiraApiService } from './jiraApi';

/**
 * Fake Jira: issue AB2C-8 was moved and is now RLR-2, and project AB2C was renamed to RLR.
 * Like real Jira, search returns issues under their current key and direct lookups resolve old keys.
 * Projects that do not exist make the whole JQL fail with 400.
 */
const issues: Record<string, { key: string; project: string }> = {
  'RLR-2': { key: 'RLR-2', project: 'RLR' },
  'AB2C-8': { key: 'RLR-2', project: 'RLR' },
  'DEF-1': { key: 'DEF-1', project: 'DEF' },
};
const projects: Record<string, string> = { RLR: 'RLR', AB2C: 'RLR', DEF: 'DEF', EMPTY: 'EMPTY' };

const toIssue = (key: string) => ({ key, fields: { summary: key, project: { key: issues[key].project } } });

const createApi = (failWith?: number) => {
  const requests: string[] = [];
  const adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const url = config.url ?? '';
    requests.push(`${config.method} ${url}`);
    const reply = (status: number, data: unknown): AxiosResponse => {
      const response = { data, status, statusText: '', headers: {}, config };
      if (status >= 400) throw new AxiosError('fail', 'ERR', config, null, response);
      return response;
    };
    if (failWith) return reply(failWith, {});

    if (url === '/search/jql') {
      const jql: string = JSON.parse(config.data).jql;
      const values = [...jql.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      if (jql.startsWith('project')) {
        if (values.some((p) => !projects[p])) return reply(400, {});
        const found = Object.keys(issues)
          .filter((k) => issues[k].key === k && values.map((p) => projects[p]).includes(issues[k].project))
          .map(toIssue);
        return reply(200, { issues: found });
      }
      if (values.some((k) => !projects[k.split('-')[0]])) return reply(400, {});
      const found = values.filter((k) => issues[k]).map((k) => toIssue(issues[k].key));
      return reply(200, { issues: found });
    }
    const issueMatch = url.match(/^\/issue\/(.+)$/);
    if (issueMatch) {
      const issue = issues[issueMatch[1]];
      return issue ? reply(200, toIssue(issue.key)) : reply(404, {});
    }
    const projectMatch = url.match(/^\/project\/(.+)$/);
    if (projectMatch) {
      const key = projects[projectMatch[1]];
      return key ? reply(200, { key, name: key }) : reply(404, {});
    }
    return reply(500, {});
  };
  const api = new JiraApiService('token', 'cloud');
  (api as unknown as { client: { defaults: { adapter: unknown } } }).client.defaults.adapter = adapter;
  return { api, requests };
};

describe('JiraApiService.getMultipleIssues', () => {
  // Regression: a moved issue came back from search as RLR-2, so AB2C-8 was reported as missing.
  it('finds issues requested by an old key and returns them with their current key', async () => {
    const { api } = createApi();
    const results = await api.getMultipleIssues(['AB2C-8', 'DEF-1', 'DEF-404']);
    expect(results['AB2C-8']?.key).toBe('RLR-2');
    expect(results['DEF-1']?.key).toBe('DEF-1');
    expect(results['DEF-404']).toBeNull();
  });

  it('does not let one unknown project hide the other tickets', async () => {
    const { api } = createApi();
    const results = await api.getMultipleIssues(['DEF-1', 'NOPE-1']);
    expect(results['DEF-1']?.key).toBe('DEF-1');
    expect(results['NOPE-1']).toBeNull();
  });

  it('only looks up individually the keys the search did not return', async () => {
    const { api, requests } = createApi();
    await api.getMultipleIssues(['AB2C-8', 'DEF-1']);
    expect(requests.filter((r) => r.includes('/issue/'))).toEqual(['get /issue/AB2C-8']);
  });

  it('surfaces server errors instead of reporting tickets as missing', async () => {
    const { api } = createApi(503);
    await expect(api.getMultipleIssues(['DEF-1'])).rejects.toBeInstanceOf(AxiosError);
  });
});

describe('JiraApiService.getMultipleProjects', () => {
  it('accepts old project keys and projects without issues', async () => {
    const { api } = createApi();
    expect(await api.getMultipleProjects(['AB2C', 'DEF', 'EMPTY'])).toEqual({
      AB2C: true,
      DEF: true,
      EMPTY: true,
    });
  });

  it('marks unknown projects invalid without failing the others', async () => {
    const { api } = createApi();
    expect(await api.getMultipleProjects(['DEF', 'NOPE'])).toEqual({ DEF: true, NOPE: false });
  });

  it('surfaces server errors instead of marking projects invalid', async () => {
    const { api } = createApi(503);
    await expect(api.getMultipleProjects(['DEF'])).rejects.toBeInstanceOf(AxiosError);
  });
});
