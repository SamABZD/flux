import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { getHealth } from '@/lib/health-api';
import { App } from './app';
import { createAppStore } from './store';

jest.mock('@/lib/health-api');
jest.mock('@/design-system/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));
const health = jest.mocked(getHealth);

async function renderApp(route = '/') {
  const store = createAppStore();
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return { store, user: userEvent.setup() };
}

test('navigates through the shell and preserves Redux diagnostics', async () => {
  health.mockResolvedValue({ status: 'ok' });
  const { user, store } = await renderApp('/diagnostics');
  await user.click(screen.getByRole('button', { name: 'Check API connection' }));
  expect(await screen.findByText('API connected · status: ok')).toBeInTheDocument();
  expect(store.getState().diagnostics.completedChecks).toBe(1);
  await user.click(
    within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('link', {
      name: 'Home',
    }),
  );
  expect(await screen.findByRole('heading', { name: 'Your money, in focus.' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Search Flux' }));
  await user.paste('Diagnostics');
  await user.click(
    within(screen.getByRole('navigation', { name: 'Search results' })).getByRole('link', {
      name: 'Diagnostics',
    }),
  );
  expect(screen.getByText('Successful checks:')).toHaveTextContent('Successful checks: 1');
});

test('shows a recoverable API error and counts only successful checks', async () => {
  health.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ status: 'ok' });
  const { user, store } = await renderApp('/diagnostics');
  await user.click(screen.getByRole('button', { name: 'Check API connection' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Could not reach the API.');
  expect(store.getState().diagnostics.completedChecks).toBe(0);
  await user.click(screen.getByRole('button', { name: 'Check API connection' }));
  await waitFor(() => expect(store.getState().diagnostics.completedChecks).toBe(1));
});

test('prevents duplicate API checks while pending', async () => {
  let finish: (() => void) | undefined;
  health.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ status: 'ok' });
      }),
  );
  const { user } = await renderApp('/diagnostics');
  await user.click(screen.getByRole('button', { name: 'Check API connection' }));
  expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
  finish?.();
  expect(await screen.findByText('API connected · status: ok')).toBeInTheDocument();
});

test.each([
  ['/', 'Your money, in focus.'],
  ['/home', 'Your money, in focus.'],
  ['/accounts', 'Accounts'],
  ['/transactions', 'Transactions'],
  ['/payments', 'Payments'],
  ['/cards', 'Cards'],
  ['/analytics', 'Analytics'],
  ['/budgets', 'Budgets'],
  ['/subscriptions', 'Subscriptions'],
  ['/settings', 'Settings'],
  ['/design-system', 'Considered, down to the details.'],
])('%s renders inside the application shell', async (route, heading) => {
  await renderApp(route);
  expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
  expect(screen.getByText('No real accounts or money.', { exact: false })).toBeInTheDocument();
});

test('unknown routes provide a way back', async () => {
  await renderApp('/missing');
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Return to overview' })).toHaveAttribute('href', '/home');
});

test('login validates locally and demo enters the workspace', async () => {
  const { user } = await renderApp('/login');
  await screen.findByRole('heading', { name: 'Welcome back.' });
  expect(screen.getByRole('button', { name: /Use a passkey/ })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
    'Enter a valid email address.',
  );
  expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  await user.type(screen.getByLabelText('Email address'), 'demo@example.com');
  await user.type(screen.getByLabelText('Password'), 'sample-only');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in is not connected yet');
  expect(screen.getByLabelText('Password')).toHaveValue('');
  expect(health).not.toHaveBeenCalled();
  await user.click(screen.getByRole('link', { name: 'Try Demo' }));
  expect(await screen.findByRole('heading', { name: 'Your money, in focus.' })).toBeInTheDocument();
});

test('search is keyboard accessible, filters pages and restores focus', async () => {
  const { user } = await renderApp('/home');
  const trigger = screen.getByRole('button', { name: 'Search Flux' });
  await user.click(trigger);
  const input = screen.getByRole('searchbox', { name: 'Search pages' });
  expect(input).toHaveFocus();
  await user.paste('does not exist');
  expect(screen.getByText('No matching pages')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(
    within(screen.getByRole('navigation', { name: 'Search results' })).getAllByRole('link'),
  ).toHaveLength(11);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

test('settings confirmation cancels safely and resets only preview controls', async () => {
  const { user } = await renderApp('/settings');
  await screen.findByRole('heading', { name: 'Settings', level: 1 });
  await user.selectOptions(screen.getByLabelText('Display currency'), 'USD');
  await user.click(screen.getByRole('switch', { name: 'Helpful reminders' }));
  await user.click(screen.getByRole('button', { name: 'Reset preview' }));
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByLabelText('Display currency')).toHaveValue('USD');
  await user.click(screen.getByRole('button', { name: 'Reset preview' }));
  await user.click(screen.getByRole('button', { name: 'Reset preferences' }));
  expect(screen.getByLabelText('Display currency')).toHaveValue('EUR');
  expect(screen.getByRole('switch', { name: 'Helpful reminders' })).not.toBeChecked();
  expect(await screen.findByText('Preview reset')).toBeInTheDocument();
});
