import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IssueAutocomplete } from './IssueAutocomplete';

vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual('../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      jiraApi: null,
      authState: { isAuthenticated: false },
    }),
  };
});

describe('IssueAutocomplete', () => {
  it('should render the autocomplete input', () => {
    const queryClient = new QueryClient();
    const onChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <IssueAutocomplete value="" onChange={onChange} />
      </QueryClientProvider>
    );

    const input = screen.getByLabelText('Ticket');
    expect(input).toBeInTheDocument();
  });

  it('should display the provided value', () => {
    const queryClient = new QueryClient();
    const onChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <IssueAutocomplete value="ABC-123" onChange={onChange} />
      </QueryClientProvider>
    );

    const input = screen.getByDisplayValue('ABC-123');
    expect(input).toBeInTheDocument();
  });
});
