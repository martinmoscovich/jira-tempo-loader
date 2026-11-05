import { JiraIssue, JiraSearchResult, JiraUser, NewTicketData } from '../types';

export class MockJiraApiService {
  private mockIssues: { [key: string]: JiraIssue } = {
    'TEST-1': {
      key: 'TEST-1',
      fields: {
        summary: 'Mock Issue 1',
        status: { name: 'In Progress' },
        assignee: { accountId: 'mock-account-id', displayName: 'Mock User' },
        project: { key: 'TEST' },
      },
    },
    'TEST-2': {
      key: 'TEST-2',
      fields: {
        summary: 'Mock Issue 2',
        status: { name: 'Done' },
        assignee: { accountId: 'mock-account-id', displayName: 'Mock User' },
        project: { key: 'TEST' },
      },
    },
    'FETI-123': {
      key: 'FETI-123',
      fields: {
        summary: 'FETI Issue 123',
        status: { name: 'Done' },
        assignee: { accountId: 'mock-account-id', displayName: 'Mock User' },
        project: { key: 'FETI' },
      },
    },
    'FETI-126': {
      key: 'FETI-126',
      fields: {
        summary: 'FETI Mock Issue 126',
        status: { name: 'Done' },
        assignee: { accountId: 'mock-account-id', displayName: 'Mock User' },
        project: { key: 'FETI' },
      },
    },
  };

  private mockProjects = new Set(['TEST', 'FETI', 'DEMO', 'MOCK']);

  updateAccessToken(_accessToken: string): void {
    // Mock implementation - does nothing
  }

  async searchIssues(query: string, maxResults = 20): Promise<JiraSearchResult> {
    const filteredIssues = Object.values(this.mockIssues).filter(issue =>
      issue.key.toLowerCase().includes(query.toLowerCase()) || issue.fields.summary.toLowerCase().includes(query.toLowerCase())
    ).slice(0, maxResults);

    return {
      issues: filteredIssues,
      total: filteredIssues.length,
    };
  }

  async searchIssuesInProject(projectKey: string, query: string, maxResults = 20): Promise<JiraSearchResult> {
    const filteredIssues = Object.values(this.mockIssues).filter(issue => {
      const matchesProject = issue.fields.project?.key === projectKey;
      const matchesQuery = !query || issue.key.toLowerCase().includes(query.toLowerCase()) || issue.fields.summary.toLowerCase().includes(query.toLowerCase());
      return matchesProject && matchesQuery;
    }).slice(0, maxResults);

    return {
      issues: filteredIssues,
      total: filteredIssues.length,
    };
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const issue = this.mockIssues[issueKey];
    if (!issue) {
      throw new Error(`Issue ${issueKey} not found`);
    }
    return issue;
  }

  async getCurrentUser(): Promise<JiraUser> {
    return {
      accountId: 'mock-account-id',
      displayName: 'Mock User',
      emailAddress: 'mock@example.com',
      avatarUrls: {
        '48x48': 'https://via.placeholder.com/48',
      },
    };
  }

  async getMultipleIssues(issueKeys: string[]): Promise<{ [key: string]: JiraIssue | null }> {
    const result: { [key: string]: JiraIssue | null } = {};

    issueKeys.forEach(key => {
      result[key] = this.mockIssues[key] || null;
    });

    return result;
  }

  async getMultipleProjects(projectKeys: string[]): Promise<{ [key: string]: boolean }> {
    const result: { [key: string]: boolean } = {};

    projectKeys.forEach(key => {
      result[key] = this.mockProjects.has(key);
    });

    return result;
  }

  async createIssue(ticketData: NewTicketData, _accountId: string): Promise<JiraIssue> {
    const newKey = `${ticketData.projectKey}-${Math.floor(Math.random() * 1000)}`;

    const newIssue: JiraIssue = {
      key: newKey,
      fields: {
        summary: ticketData.title,
        status: { name: ticketData.status },
        assignee: { accountId: 'mock-account-id', displayName: ticketData.assignee },
        project: { key: ticketData.projectKey },
      },
    };

    this.mockIssues[newKey] = newIssue;

    return newIssue;
  }

  async transitionIssue(issueKey: string, targetStatus: string): Promise<void> {
    const issue = this.mockIssues[issueKey];
    if (issue) {
      issue.fields.status = { name: targetStatus };
    }
  }

  async getProject(projectKey: string): Promise<{ key: string; name: string }> {
    if (!this.mockProjects.has(projectKey)) {
      throw new Error(`Project ${projectKey} not found`);
    }
    return {
      key: projectKey,
      name: `Mock Project ${projectKey}`,
    };
  }
}
