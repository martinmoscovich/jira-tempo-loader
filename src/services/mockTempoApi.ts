import { TempoWorklog } from '../types';

export class MockTempoApiService {
  private mockWorklogs: Array<TempoWorklog & { id: number }> = [];
  private worklogIdCounter = 1;

  async createWorklog(worklog: TempoWorklog): Promise<{ tempoWorklogId: number }> {
    const id = this.worklogIdCounter++;

    this.mockWorklogs.push({
      ...worklog,
      id,
    });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    return { tempoWorklogId: id };
  }

  async findWorklog(worklog: TempoWorklog): Promise<boolean> {
    return this.mockWorklogs.some(
      (existing) =>
        existing.issueKey === worklog.issueKey &&
        existing.authorAccountId === worklog.authorAccountId &&
        existing.startDate === worklog.startDate &&
        existing.startTime === worklog.startTime &&
        existing.timeSpentSeconds === worklog.timeSpentSeconds
    );
  }

  async getWorklogs(
    _authorAccountId: string,
    _from: string,
    _to: string
  ): Promise<{ results: TempoWorklog[] }> {
    return { results: this.mockWorklogs };
  }

  async deleteWorklog(worklogId: number): Promise<void> {
    const index = this.mockWorklogs.findIndex(w => w.id === worklogId);
    if (index !== -1) {
      this.mockWorklogs.splice(index, 1);
    }
  }

  async updateWorklog(worklogId: number, worklog: Partial<TempoWorklog>): Promise<void> {
    const existing = this.mockWorklogs.find(w => w.id === worklogId);
    if (existing) {
      Object.assign(existing, worklog);
    }
  }

  async deleteWorklogByIssue(_issueKey: string, worklogId: string): Promise<void> {
    const id = parseInt(worklogId);
    await this.deleteWorklog(id);
  }

  async updateWorklogByIssue(
    _issueKey: string,
    worklogId: string,
    worklog: Partial<TempoWorklog>
  ): Promise<void> {
    const id = parseInt(worklogId);
    await this.updateWorklog(id, worklog);
  }

  updateAccessToken(_accessToken: string): void {
    // Mock implementation - does nothing
  }
}
