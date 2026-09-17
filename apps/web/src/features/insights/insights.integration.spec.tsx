import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { createAppStore } from '@/app/store';
import { financeApi } from '@/features/finance/finance-api';
import { ToastProvider } from '@/design-system/toast';
import {
  analyticsFixture,
  budgetsFixture,
  subscriptionsFixture,
} from '../../../test/insight-fixtures';
import { AnalyticsPage } from './analytics-page';
import { BudgetsPage } from './budgets-page';
import { SubscriptionsPage } from './subscriptions-page';
import type { Budgets, Subscriptions, SubscriptionEdit } from './types';

let fetchMock: jest.SpyInstance,
  budgets: Budgets,
  subscriptions: Subscriptions,
  mode: 'success' | 'read-failure' | 'save-failure' | 'lost-create',
  queries: URLSearchParams[],
  subscriptionEdits: SubscriptionEdit[],
  keys: (string | null)[];
beforeEach(() => {
  budgets = JSON.parse(JSON.stringify(budgetsFixture)) as Budgets;
  subscriptions = JSON.parse(JSON.stringify(subscriptionsFixture)) as Subscriptions;
  mode = 'success';
  queries = [];
  keys = [];
  subscriptionEdits = [];
  fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (request.method === 'GET' && mode === 'read-failure')
        return Response.json({ message: 'Offline' }, { status: 503 });
      if (url.pathname === '/analytics/summary') {
        queries.push(url.searchParams);
        return Response.json({
          ...analyticsFixture,
          baseCurrency: url.searchParams.get('baseCurrency') ?? 'USD',
          ...(url.searchParams.get('period') === 'week'
            ? {
                spendingMinor: 1000,
                transactionCount: 2,
                spendingChangePercent: -50,
                range: { ...analyticsFixture.range, dateFrom: '2026-09-09' },
              }
            : {}),
        });
      }
      if (url.pathname === '/budgets' && request.method === 'GET') return Response.json(budgets);
      if (url.pathname === '/budgets' && request.method === 'POST') {
        keys.push(request.headers.get('Idempotency-Key'));
        if (mode === 'lost-create' && keys.length === 1) throw new TypeError('Lost response');
        return Response.json({ id: 'new-budget' });
      }
      if (url.pathname.startsWith('/budgets/') && request.method === 'PATCH') {
        if (mode === 'save-failure')
          return Response.json(
            { message: 'Budget changed. Reload before editing.' },
            { status: 409 },
          );
        const body = (await request.json()) as { amountMinor: number; enabled?: boolean };
        budgets.items[0]!.amountMinor = body.amountMinor;
        if (body.enabled !== undefined) {
          budgets.items[0]!.enabled = body.enabled;
          budgets.items[0]!.status = body.enabled ? 'WITHIN' : 'DISABLED';
        }
        return Response.json({ id: 'budget-dining' });
      }
      if (url.pathname.startsWith('/budgets/') && request.method === 'DELETE') {
        budgets.items = [];
        return Response.json({ id: 'budget-dining' });
      }
      if (url.pathname === '/subscriptions' && request.method === 'GET')
        return Response.json(subscriptions);
      if (url.pathname === '/subscriptions' && request.method === 'POST') {
        keys.push(request.headers.get('Idempotency-Key'));
        if (mode === 'lost-create' && keys.length === 1) throw new TypeError('Lost response');
        return Response.json({ id: 'new-sub' });
      }
      if (url.pathname.startsWith('/subscriptions/') && request.method === 'PATCH') {
        if (mode === 'save-failure')
          return Response.json({ message: 'Unable to update tracking.' }, { status: 503 });
        const body = (await request.json()) as SubscriptionEdit;
        subscriptionEdits.push(body);
        Object.assign(subscriptions.items[0]!, body);
        subscriptions.items[0]!.revision++;
        return Response.json({ id: 'sub-netflix' });
      }
      throw new Error('Unexpected route ' + url.pathname);
    });
});
afterEach(() => fetchMock?.mockRestore());
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}
function mount(path: string) {
  const store = createAppStore();
  const result = render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <Routes>
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/analytics/categories/:category" element={<AnalyticsPage />} />
            <Route path="/analytics/merchants/:merchantId" element={<AnalyticsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/subscriptions/:id" element={<SubscriptionsPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  );
  return {
    ...result,
    store,
    dispose: () => {
      result.unmount();
      store.dispatch(financeApi.util.resetApiState());
    },
  };
}
test('period and currency changes request one consistent report without a page reload', async () => {
  const view = mount('/analytics');
  const user = userEvent.setup();
  await screen.findByText('12.0% more spending');
  await user.click(screen.getByRole('button', { name: '7 days' }));
  await screen.findByText('50.0% less spending');
  expect(queries.at(-1)?.get('period')).toBe('week');
  await user.selectOptions(screen.getByLabelText('Reporting currency'), 'EUR');
  await waitFor(() => expect(queries.at(-1)?.get('baseCurrency')).toBe('EUR'));
  expect(screen.getByTestId('location')).toHaveTextContent('period=week&baseCurrency=EUR');
  expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
  view.dispose();
});
test('category drilldown and underlying transaction links retain period and currency context', async () => {
  const view = mount('/analytics?period=year&baseCurrency=EUR');
  const user = userEvent.setup();
  await screen.findByText('12.0% more spending');
  await user.click(
    within(screen.getByRole('region', { name: 'Spending by category' })).getByRole('link'),
  );
  await screen.findByRole('heading', { level: 1, name: 'Dining' });
  const activityRegion = await screen.findByRole('region', { name: 'Underlying transactions' });
  expect(queries.at(-1)?.get('category')).toBe('dining');
  expect(queries.at(-1)?.get('period')).toBe('year');
  const row = within(activityRegion).getAllByRole('link')[0]!;
  expect(row.getAttribute('href')).toContain(
    encodeURIComponent('/analytics/categories/dining?period=year&baseCurrency=EUR'),
  );
  view.dispose();
});
test('chart has keyboard-selected exact amounts and a readable table', async () => {
  const view = mount('/analytics');
  await screen.findByText('12.0% more spending');
  const selector = screen.getByRole('slider', { name: 'Select spending chart date' });
  act(() => selector.focus());
  fireEvent.change(selector, { target: { value: '0' } });
  expect(selector).toHaveAttribute('aria-valuetext', expect.stringContaining('$0.00'));
  const user = userEvent.setup();
  await user.click(screen.getByText('View chart data'));
  expect(screen.getByRole('table')).toHaveTextContent('Dining');
  view.dispose();
});
test('failed report load has a working retry while keeping filters', async () => {
  mode = 'read-failure';
  const view = mount('/analytics?period=week');
  const user = userEvent.setup();
  await screen.findByRole('alert');
  mode = 'success';
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('50.0% less spending');
  expect(queries.at(-1)?.get('period')).toBe('week');
  view.dispose();
});
test('financial query invalidation refreshes the analytics read model', async () => {
  const view = mount('/analytics');
  await screen.findByText('12.0% more spending');
  const before = queries.length;
  act(() => {
    view.store.dispatch(financeApi.util.invalidateTags(['Transactions']));
  });
  await waitFor(() => expect(queries.length).toBeGreaterThan(before));
  view.dispose();
});
test('budget edit failure retains the confirmed target and explains a stale revision', async () => {
  mode = 'save-failure';
  const view = mount('/budgets');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit Dining budget' }));
  const input = screen.getByRole('textbox', { name: 'Monthly target (USD)' });
  await user.clear(input);
  await user.type(input, '50.00');
  await user.click(screen.getByRole('button', { name: 'Save budget' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload before editing');
  expect(budgets.items[0]?.amountMinor).toBe(3000);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.dispose();
});
test('uncertain budget creation freezes its fields and retries the unchanged key', async () => {
  mode = 'lost-create';
  const view = mount('/budgets');
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create budget' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Create budget' }));
  await user.type(screen.getByRole('textbox', { name: 'Monthly target (USD)' }), '50');
  await user.click(screen.getByRole('button', { name: 'Save budget' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Category')).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Retry save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  view.dispose();
});
test('deletion requires explicit confirmation and removes only the tracked target', async () => {
  const view = mount('/budgets');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Delete Dining budget' }));
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Previous months and all transactions remain',
  );
  await user.click(screen.getByRole('button', { name: 'Keep budget' }));
  expect(budgets.items).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Delete Dining budget' }));
  await user.click(screen.getByRole('button', { name: 'Delete budget' }));
  await waitFor(() => expect(budgets.items).toHaveLength(0));
  view.dispose();
});
test('subscription pause failure keeps tracking active and describes the billing boundary', async () => {
  mode = 'save-failure';
  const view = mount('/subscriptions/sub-netflix');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Pause tracking' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('does not cancel or pause merchant billing');
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Pause tracking' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to update');
  expect(subscriptions.items[0]?.status).toBe('ACTIVE');
  view.dispose();
});
test('subscription cancellation preserves history and can be resumed explicitly', async () => {
  const view = mount('/subscriptions/sub-netflix');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Mark as cancelled' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as cancelled' }),
  );
  await waitFor(() => expect(subscriptions.items[0]?.status).toBe('CANCELLED'));
  await screen.findByRole('button', { name: 'Resume tracking' });
  expect(subscriptions.items[0]?.paymentCount).toBe(1);
  view.dispose();
});
test('candidate review exposes the matching evidence and handles an uncertain save safely', async () => {
  mode = 'lost-create';
  const view = mount('/subscriptions');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Review Spotify EUR subscription' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Matched 3 payments');
  expect(screen.getByLabelText('Payment account')).toHaveValue('eur');
  await user.click(screen.getByRole('button', { name: 'Start tracking' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Repeats')).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Retry save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(keys[0]).toBe(keys[1]);
  view.dispose();
});

test('editing a subscription label preserves the original month-end billing anchor', async () => {
  subscriptions.items[0]!.anchorDate = '2026-01-31';
  subscriptions.items[0]!.nextPaymentDate = '2026-02-28';
  const view = mount('/subscriptions/sub-netflix');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit tracking' }));
  await user.clear(screen.getByLabelText('Label'));
  await user.type(screen.getByLabelText('Label'), 'Netflix family');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(subscriptionEdits).toHaveLength(1));
  expect(subscriptionEdits[0]).not.toHaveProperty('nextPaymentDate');
  view.dispose();
});
test('budgets show a forecast and allow disabling without deleting the target', async () => {
  const view = mount('/budgets');
  const user = userEvent.setup();
  await screen.findByText(/Projected month end/);
  await user.click(screen.getByRole('button', { name: 'Edit Dining budget' }));
  await user.selectOptions(screen.getByLabelText('Budget status'), 'disabled');
  await user.click(screen.getByRole('button', { name: 'Save budget' }));
  await waitFor(() => expect(budgets.items[0]?.enabled).toBe(false));
  expect(budgets.items).toHaveLength(1);
  view.dispose();
});
test('known frozen payment card has a clear warning and a direct controls link', async () => {
  subscriptions.items[0]!.paymentCard = {
    id: 'card-one',
    label: 'Virtual',
    last4: '4821',
    status: 'FROZEN',
    type: 'VIRTUAL',
  };
  subscriptions.items[0]!.cardWarning = 'This card is frozen. An upcoming payment may be declined.';
  const view = mount('/subscriptions/sub-netflix');
  await screen.findByText(/This card is frozen/);
  expect(screen.getByRole('link', { name: 'Review card controls' })).toHaveAttribute(
    'href',
    '/cards/card-one',
  );
  expect(screen.getByText('Net paid this year')).toBeVisible();
  view.dispose();
});
test('invalid category route reports a missing category instead of showing all spending', async () => {
  const view = mount('/analytics/categories/not-real');
  expect(await screen.findByRole('alert')).toHaveTextContent('Category not found');
  expect(queries).toHaveLength(0);
  view.dispose();
});
