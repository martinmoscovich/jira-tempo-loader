import axios from 'axios';
import { JiraSearchResult, JiraIssue, NewTicketData } from '../types';
import { RestApi, UnauthorizedHandler } from './restApi';

export class JiraApiService extends RestApi {
  private issueCache: Map<string, JiraIssue> = new Map();

  constructor(accessToken: string, cloudId: string, onUnauthorized?: UnauthorizedHandler) {
    super(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`,
      accessToken,
      onUnauthorized
    );
  }

  async searchIssues(query: string, maxResults = 20): Promise<JiraSearchResult> {
    const response = await this.client.post<JiraSearchResult>('/search/jql', {
      jql: `text ~ "${query}*" OR key = "${query}" ORDER BY updated DESC`,
      maxResults,
      fields: ['summary', 'status', 'assignee', 'project'],
    });

    return response.data;
  }

  async searchIssuesInProject(projectKey: string, query: string, maxResults = 20): Promise<JiraSearchResult> {
    const jql = query
      ? `project = "${projectKey}" AND (text ~ "${query}*" OR key = "${query}") ORDER BY updated DESC`
      : `project = "${projectKey}" ORDER BY updated DESC`;

    const response = await this.client.post<JiraSearchResult>('/search/jql', {
      jql,
      maxResults,
      fields: ['summary', 'status', 'assignee', 'project'],
    });

    return response.data;
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const response = await this.client.get<JiraIssue>(`/issue/${issueKey}`, {
      params: {
        fields: 'summary,status,assignee,project',
      },
    });

    return response.data;
  }

  async getMultipleIssues(issueKeys: string[]): Promise<{ [key: string]: JiraIssue | null }> {
    if (issueKeys.length === 0) return {};

    const results: { [key: string]: JiraIssue | null } = {};
    const keysToFetch: string[] = [];

    // Check cache first
    issueKeys.forEach(key => {
      const upperKey = key.toUpperCase();
      const cached = this.issueCache.get(upperKey);
      if (cached) {
        results[upperKey] = cached;
      } else {
        keysToFetch.push(upperKey);
      }
    });

    // If all issues were cached, return immediately
    if (keysToFetch.length === 0) return results;

    // JQL supports searching for multiple issue keys
    const jql = `key IN (${keysToFetch.map(k => `"${k}"`).join(',')})`;

    try {
      const response = await this.client.post<JiraSearchResult>('/search/jql', {
        jql,
        maxResults: keysToFetch.length,
        fields: ['summary', 'status', 'assignee', 'project'],
      });

      // Initialize uncached keys as null
      keysToFetch.forEach(key => {
        results[key] = null;
      });

      // Fill in found issues and update cache
      response.data.issues.forEach(issue => {
        const upperKey = issue.key.toUpperCase();
        if (upperKey in results) results[upperKey] = issue;
        this.issueCache.set(upperKey, issue);
      });

      // A moved issue (or one whose project key changed) is returned under its current key, so
      // the old key looks missing. Look those up one by one: Jira resolves old keys and the
      // returned issue carries the current key.
      const unmatched = keysToFetch.filter(key => results[key] === null);
      await Promise.all(unmatched.map(async key => {
        const issue = await this.findIssue(key);
        results[key] = issue;
        if (issue) this.issueCache.set(key, issue);
      }));

      return results;
    } catch (error) {
      // Missing keys come back as 200 without the issue and are handled above. Jira rejects the
      // whole JQL (400) when one key's project does not exist, so then check each key on its own.
      // Auth, network and server errors must surface instead of being reported as missing tickets.
      if (!axios.isAxiosError(error) || error.response?.status !== 400) {
        throw error;
      }
      await Promise.all(keysToFetch.map(async key => {
        const issue = await this.findIssue(key);
        results[key] = issue;
        if (issue) this.issueCache.set(key, issue);
      }));
      return results;
    }
  }

  /** Returns the issue (with its current key), or null when Jira says it does not exist (404). */
  private async findIssue(issueKey: string): Promise<JiraIssue | null> {
    try {
      return await this.getIssue(issueKey);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  }

  /** True when the project exists (old project keys resolve too), false on 404. */
  private async projectExists(projectKey: string): Promise<boolean> {
    try {
      await this.getProject(projectKey);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return false;
      throw error;
    }
  }

  async getMultipleProjects(projectKeys: string[]): Promise<{ [key: string]: boolean }> {
    if (projectKeys.length === 0) return {};

    const results: { [key: string]: boolean } = {};

    // Jira doesn't have a batch endpoint for projects, but we can use JQL to check if projects exist
    const jql = `project IN (${projectKeys.map(k => `"${k}"`).join(',')})`;

    try {
      // Request enough results to potentially get at least one issue per project
      // This ensures we can validate all projects in a single API call
      const response = await this.client.post<JiraSearchResult>('/search/jql', {
        jql,
        maxResults: projectKeys.length * 10, // Get multiple issues to ensure we cover all projects
        fields: ['project'],
      });

      // Extract unique projects from results
      const foundProjects = new Set<string>();
      response.data.issues.forEach(issue => {
        if (issue.fields.project?.key) {
          foundProjects.add(issue.fields.project.key.toUpperCase());
        }
      });

      // Mark projects as valid or invalid
      projectKeys.forEach(key => {
        results[key.toUpperCase()] = foundProjects.has(key.toUpperCase());
      });

      // Not in the sample: an old project key (issues come back under the new one), a project
      // without issues, or one beyond maxResults. Check those directly.
      const unmatched = projectKeys.map(key => key.toUpperCase()).filter(key => !results[key]);
      await Promise.all(unmatched.map(async key => {
        results[key] = await this.projectExists(key);
      }));

      return results;
    } catch (error) {
      // Auth, network and server errors must surface instead of marking projects invalid.
      if (!axios.isAxiosError(error) || error.response?.status !== 400) {
        throw error;
      }
      // If query fails, try individual requests as fallback
      const promises = projectKeys.map(async (key) => ({
        key: key.toUpperCase(),
        valid: await this.projectExists(key),
      }));

      const individualResults = await Promise.all(promises);
      individualResults.forEach(({ key, valid }) => {
        results[key] = valid;
      });

      return results;
    }
  }

  async createIssue(ticketData: NewTicketData, userAccountId: string): Promise<JiraIssue> {
    const statusMap = {
      'OPEN': 'To Do',
      'IN PROGRESS': 'In Progress',
      'CLOSED': 'Done',
    };

    const payload: any = {
      fields: {
        project: {
          key: ticketData.projectKey,
        },
        summary: ticketData.title,
        issuetype: {
          name: 'Task',
        },
        assignee: {
          accountId: ticketData.assignee || userAccountId,
        },
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Ticket created automatically from Tempo Timesheet Manager.`,
                },
              ],
            },
          ],
        },
      },
    };

    if (ticketData.parentIssueKey) {
      payload.fields.parent = {
        key: ticketData.parentIssueKey,
      };
    }

    const response = await this.client.post<JiraIssue>('/issue', payload);

    if (ticketData.status !== 'OPEN') {
      await this.transitionIssue(response.data.key, statusMap[ticketData.status]);
    }

    return response.data;
  }

  async transitionIssue(issueKey: string, targetStatus: string): Promise<void> {
    const transitionsResponse = await this.client.get(`/issue/${issueKey}/transitions`);
    const transitions = transitionsResponse.data.transitions;

    const transition = transitions.find((t: { to: { name: string } }) =>
      t.to.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (transition) {
      await this.client.post(`/issue/${issueKey}/transitions`, {
        transition: {
          id: transition.id,
        },
      });
    }
  }

  async getProject(projectKey: string): Promise<{ key: string; name: string }> {
    const response = await this.client.get(`/project/${projectKey}`);
    return response.data;
  }

  async getCurrentUser(): Promise<{ accountId: string; displayName: string }> {
    const response = await this.client.get('/myself');
    return response.data;
  }
}
