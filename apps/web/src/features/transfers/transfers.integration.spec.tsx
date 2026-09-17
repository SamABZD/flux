import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { createAppStore } from '@/app/store';
import { financeApi } from '@/features/finance/finance-api';
import { ToastProvider } from '@/design-system/toast';
import { PaymentRoutes } from './payment-routes';
import { readDraft, newDraft, saveDraft } from './draft';
import {
  accountsFixture,
  overviewFixture,
  transactionFixture,
} from '../../../test/finance-fixtures';
import { recipientFixture, quoteFixture, transferFixture } from '../../../test/transfer-fixtures';
import type { Transfer, TransferRequest } from './types';

let fetchMock: jest.SpyInstance;
let currentQuote = quoteFixture(),
  transfer: Transfer | null = null;
let submissions: { key: string | null; body: TransferRequest }[] = [];
let scenario: 'success' | 'before' | 'after' | 'failed' | 'session' = 'success';
let release: (() => void) | undefined;
let delayed = false;
beforeEach(() => {
  sessionStorage.clear();
  currentQuote = quoteFixture();
  transfer = null;
  submissions = [];
  scenario = 'success';
  delayed = false;
  release = undefined;
  fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      const url = new URL(request.url);
      if (url.pathname === '/session/demo')
        return Response.json({ userId: 'demo-alex', mode: 'demo' });
      if (url.pathname === '/accounts')
        return Response.json({
          ...accountsFixture,
          items: accountsFixture.items.map((a) => ({
            ...a,
            balanceMinor:
              a.balanceMinor - (transfer?.status === 'COMPLETED' && a.id === 'usd' ? 55220 : 0),
          })),
        });
      if (url.pathname === '/overview')
        return Response.json({
          ...overviewFixture,
          totalBalanceMinor:
            overviewFixture.totalBalanceMinor - (transfer?.status === 'COMPLETED' ? 55220 : 0),
        });
      if (url.pathname === '/transactions')
        return Response.json({
          items:
            transfer?.status === 'COMPLETED'
              ? [
                  {
                    ...transactionFixture,
                    transferId: transfer.id,
                    amountMinor: transfer.totalDebitMinor,
                    merchant: {
                      id: 'recipient:maya-haddad',
                      name: 'Maya Haddad',
                      icon: 'transfers',
                    },
                  },
                ]
              : [],
          total: transfer?.status === 'COMPLETED' ? 1 : 0,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
      if (url.pathname === '/recipients') return Response.json([recipientFixture]);
      if (url.pathname === '/transfers/quote') return Response.json(currentQuote);
      if (url.pathname.startsWith('/transfers/quotes/')) return Response.json(currentQuote);
      if (url.pathname.startsWith('/transfers/by-key/')) return Response.json({ transfer });
      if (url.pathname === '/transfers' && request.method === 'POST') {
        submissions.push({
          key: request.headers.get('Idempotency-Key'),
          body: (await request.json()) as TransferRequest,
        });
        if (delayed)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        if (scenario === 'session' && submissions.length === 1)
          return Response.json({ message: 'Session expired' }, { status: 401 });
        if (scenario === 'before' && submissions.length === 1)
          throw new TypeError('Offline before dispatch');
        transfer ??=
          scenario === 'failed'
            ? {
                ...transferFixture(),
                status: 'FAILED',
                completedAt: null,
                failureReason: 'Receiving bank unavailable. No funds were moved.',
              }
            : transferFixture();
        if (scenario === 'after' && submissions.length === 1)
          throw new TypeError('Response lost after commit');
        return Response.json(transfer);
      }
      if (url.pathname === '/transfers') return Response.json(transfer ? [transfer] : []);
      if (url.pathname.startsWith('/transfers/')) return Response.json(transfer);
      throw new Error(`Unexpected URL ${url.pathname}`);
    });
});
afterEach(() => {
  fetchMock.mockRestore();
  sessionStorage.clear();
});
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="test-location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function mount(route = '/payments/send') {
  const store = createAppStore();
  const view = render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <LocationProbe />
          <Routes>
            <Route path="/payments/*" element={<PaymentRoutes />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  );
  return {
    ...view,
    store,
    user: userEvent.setup(),
    clean() {
      view.unmount();
      store.dispatch(financeApi.util.resetApiState());
    },
  };
}
async function review(user: ReturnType<typeof userEvent.setup>) {
  await user.click((await screen.findAllByRole('button', { name: /Maya Haddad/ }))[0]!);
  const amount = screen.getByRole('textbox', { name: 'Recipient receives (EUR)' });
  await user.click(amount);
  await user.paste('€500.00');
  await user.type(screen.getByLabelText('Note (optional)'), 'Rent');
  await user.click(screen.getByRole('button', { name: 'Get quote' }));
  await screen.findByRole('button', { name: 'Confirm transfer' });
}
test('a fresh-entry shortcut is consumed once so reload preserves the reviewed quote', async () => {
  saveDraft({ ...newDraft('send'), amount: '99', step: 'amount' });
  let view = mount('/payments/send?again=1&recipient=maya-haddad');
  const money = await screen.findByRole('textbox', { name: 'Recipient receives (EUR)' });
  expect(money).toHaveValue('');
  await waitFor(() =>
    expect(screen.getByTestId('test-location')).toHaveTextContent(/^\/payments\/send$/),
  );
  await view.user.type(money, '25');
  await view.user.click(screen.getByRole('button', { name: 'Get quote' }));
  await screen.findByRole('button', { name: 'Confirm transfer' });
  const saved = readDraft();
  expect(saved?.step).toBe('review');
  view.clean();
  view = mount('/payments/send');
  expect(await screen.findByRole('button', { name: 'Confirm transfer' })).toBeEnabled();
  expect(readDraft()?.quoteId).toBe(saved?.quoteId);
  view.clean();
});
test('selects, pastes, reviews transparent totals and confirms once while processing; caches update without reload', async () => {
  const view = mount();
  const overview = view.store.dispatch(financeApi.endpoints.getOverview.initiate('usd'));
  const activity = view.store.dispatch(financeApi.endpoints.getTransactions.initiate({}));
  await overview;
  await activity;
  expect(financeApi.endpoints.getTransactions.select({})(view.store.getState()).data?.total).toBe(
    0,
  );
  await review(view.user);
  expect(screen.getByText('$550.00')).toBeInTheDocument();
  expect(screen.getByText('$2.20')).toBeInTheDocument();
  expect(screen.getByText('$552.20')).toBeInTheDocument();
  expect(screen.getByText('1 USD = 0.909090 EUR')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  delayed = true;
  const button = screen.getByRole('button', { name: 'Confirm transfer' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(
    await screen.findByRole('heading', { name: 'Your transfer is processing' }),
  ).toBeInTheDocument();
  await waitFor(() => expect(release).toBeDefined());
  expect(submissions).toHaveLength(1);
  expect(readDraft()?.submission?.key).toBe(submissions[0]?.key);
  act(() => {
    release?.();
  });
  await screen.findByRole('heading', { name: 'Money sent' });
  await waitFor(() =>
    expect(
      financeApi.endpoints.getAccounts.select()(view.store.getState()).data?.items[0]?.balanceMinor,
    ).toBe(426820),
  );
  await waitFor(() =>
    expect(
      financeApi.endpoints.getOverview.select('usd')(view.store.getState()).data?.totalBalanceMinor,
    ).toBe(overviewFixture.totalBalanceMinor - 55220),
  );
  await waitFor(() =>
    expect(
      financeApi.endpoints.getTransactions.select({})(view.store.getState()).data?.items[0]
        ?.transferId,
    ).toBe(transfer?.id),
  );
  expect(readDraft()?.step).toBe('result');
  await view.user.click(screen.getByRole('link', { name: 'Payments' }));
  await view.user.click((await screen.findAllByRole('link', { name: 'Send money' }))[0]!);
  expect(
    await screen.findByRole('heading', { name: 'Who are you sending to?' }),
  ).toBeInTheDocument();
  activity.unsubscribe();
  overview.unsubscribe();
  view.clean();
});
test('insufficient funds states the missing amount including fee and prevents confirmation', async () => {
  currentQuote = { ...currentQuote, availableBalanceMinor: 55000, shortfallMinor: 220 };
  const view = mount();
  await review(view.user);
  expect(screen.getByRole('alert')).toHaveTextContent('You need $2.20 more');
  expect(screen.getByRole('button', { name: 'Confirm transfer' })).toBeDisabled();
  await view.user.click(screen.getByRole('button', { name: 'Change amount or account' }));
  expect(screen.getByRole('textbox', { name: 'Recipient receives (EUR)' })).toHaveValue('500.00');
  view.clean();
});
test.each(['before', 'after'] as const)(
  'a network interruption %s submission keeps the original key through reload and retries once',
  async (mode) => {
    scenario = mode;
    let view = mount();
    await review(view.user);
    await view.user.click(screen.getByRole('button', { name: 'Confirm transfer' }));
    await screen.findByRole('button', { name: 'Retry safely' });
    expect(screen.getByRole('alert')).toHaveTextContent('may have completed');
    const saved = readDraft()?.submission;
    view.clean();
    view = mount();
    await screen.findByRole('button', { name: 'Retry safely' });
    expect(
      screen.queryByRole('button', { name: 'Change amount or account' }),
    ).not.toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Retry safely' }));
    await screen.findByRole('heading', { name: 'Money sent' });
    expect(submissions).toHaveLength(2);
    expect(submissions[1]).toEqual(submissions[0]);
    expect(readDraft()?.submission).toEqual(saved);
    view.clean();
  },
);
test('a lost response can be recovered by checking the result without another submission', async () => {
  scenario = 'after';
  const view = mount();
  await review(view.user);
  await view.user.click(screen.getByRole('button', { name: 'Confirm transfer' }));
  await screen.findByRole('button', { name: 'Check result' });
  await view.user.click(screen.getByRole('button', { name: 'Check result' }));
  await screen.findByRole('heading', { name: 'Money sent' });
  expect(submissions).toHaveLength(1);
  view.clean();
});
test('expired review is restored from the server; editing preserves the amount', async () => {
  currentQuote = { ...currentQuote, expiresAt: new Date(Date.now() - 1000).toISOString() };
  saveDraft({
    ...newDraft('send', recipientFixture.id),
    step: 'review',
    amount: '500',
    quoteId: currentQuote.id,
  });
  const view = mount();
  expect(await screen.findByText('This quote has expired')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm transfer' })).toBeDisabled();
  currentQuote = quoteFixture();
  await view.user.click(screen.getByRole('button', { name: 'Refresh quote' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Confirm transfer' })).toBeEnabled(),
  );
  view.clean();
});
test('bank rejection reports that no funds moved and offers a new quote', async () => {
  scenario = 'failed';
  const view = mount();
  await review(view.user);
  await view.user.click(screen.getByRole('button', { name: 'Confirm transfer' }));
  expect(
    await screen.findByText('Receiving bank unavailable. No funds were moved.'),
  ).toBeInTheDocument();
  expect(readDraft()?.step).toBe('result');
  await view.user.click(screen.getByRole('button', { name: 'Get new quote' }));
  expect(screen.getByRole('textbox', { name: 'Recipient receives (EUR)' })).toBeInTheDocument();
  view.clean();
});
test('session renewal replays the exact confirmation and key', async () => {
  scenario = 'session';
  const view = mount();
  await review(view.user);
  await view.user.click(screen.getByRole('button', { name: 'Confirm transfer' }));
  await screen.findByRole('heading', { name: 'Money sent' });
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toEqual(submissions[0]);
  view.clean();
});
