import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ToastProvider } from '@/design-system/toast';
import { createAppStore } from '@/app/store';
import { TransactionsPage } from '@/pages/transactions-page';
import { TransactionDetailPage } from '@/pages/transaction-detail-page';
import {
  accountsFixture,
  overviewFixture,
  transactionFixture,
} from '../../../test/finance-fixtures';
import { financeApi } from './finance-api';

let current = { ...transactionFixture };
let failList = false;
let failEdit = false;
let fetchMock: jest.SpyInstance;
beforeEach(() => {
  current = { ...transactionFixture };
  failList = false;
  failEdit = false;
  fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      const url = new URL(request.url);
      if (url.pathname === '/accounts') return Response.json(accountsFixture);
      if (url.pathname === '/merchants') return Response.json([current.merchant]);
      if (url.pathname === '/overview')
        return Response.json({
          ...overviewFixture,
          spending: {
            ...overviewFixture.spending,
            categories: [{ category: current.category, amountMinor: 2240 }],
          },
        });
      if (request.method === 'PATCH') {
        if (failEdit) return Response.json({ message: 'Offline' }, { status: 503 });
        const body = (await request.json()) as { category: typeof current.category };
        current = { ...current, category: body.category };
        return Response.json(current);
      }
      if (url.pathname === '/transactions') {
        if (failList) return Response.json({ message: 'Offline' }, { status: 503 });
        const match =
          (!url.searchParams.get('account') ||
            url.searchParams.get('account') === current.accountId) &&
          (!url.searchParams.get('category') ||
            url.searchParams.get('category') === current.category) &&
          (!url.searchParams.get('search') ||
            current.merchant.name
              .toLowerCase()
              .includes(url.searchParams.get('search')?.toLowerCase() ?? ''));
        return Response.json({
          items: match ? [current] : [],
          total: match ? 1 : 0,
          page: 1,
          limit: 20,
          totalPages: match ? 1 : 0,
        });
      }
      return Response.json(current);
    });
});
afterEach(() => fetchMock.mockRestore());
function mount(route = '/transactions') {
  const store = createAppStore();
  const view = render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/transactions/:id" element={<TransactionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  );
  return { store, user: userEvent.setup(), ...view };
}
test('URL filters combine, clear, and preserve context through details', async () => {
  const { user, store, unmount } = mount('/transactions?account=usd&category=dining');
  await screen.findByText('Roadster');
  await user.selectOptions(screen.getByLabelText('Account'), 'eur');
  expect(await screen.findByText('No transactions match')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
  await screen.findByText('Roadster');
  await user.type(screen.getByRole('searchbox', { name: 'Search transactions' }), 'Roadster');
  await user.click(await screen.findByRole('link', { name: /Roadster Dining/ }));
  await screen.findByRole('heading', { name: 'Roadster' });
  expect(screen.getByRole('link', { name: 'Back to activity' })).toHaveAttribute(
    'href',
    '/transactions?search=Roadster',
  );
  unmount();
  store.dispatch(financeApi.util.resetApiState());
});
test('category failures retain confirmed data; retry updates detail, filtered list and Home cache', async () => {
  const { user, store, unmount } = mount('/transactions/tx_0437');
  const overviewSubscription = store.dispatch(financeApi.endpoints.getOverview.initiate('usd'));
  const listSubscription = store.dispatch(
    financeApi.endpoints.getTransactions.initiate({ category: 'dining' }),
  );
  await screen.findByRole('heading', { name: 'Roadster' });
  await overviewSubscription;
  await listSubscription;
  failEdit = true;
  await user.selectOptions(screen.getByLabelText('Transaction category'), 'other');
  await user.click(screen.getByRole('button', { name: 'Save category' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('last confirmed category is Dining');
  expect(screen.getByLabelText('Transaction category')).toHaveValue('other');
  expect(store.getState().financeApi.queries['getTransaction("tx_0437")']?.data).toMatchObject({
    category: 'dining',
  });
  failEdit = false;
  await user.click(screen.getByRole('button', { name: 'Retry update' }));
  await screen.findByText('Category updated');
  await waitFor(() =>
    expect(
      financeApi.endpoints.getTransactions.select({ category: 'dining' })(store.getState()).data
        ?.total,
    ).toBe(0),
  );
  await waitFor(() =>
    expect(
      financeApi.endpoints.getOverview.select('usd')(store.getState()).data?.spending.categories[0]
        ?.category,
    ).toBe('other'),
  );
  expect(screen.getByRole('button', { name: 'Save category' })).toBeDisabled();
  overviewSubscription.unsubscribe();
  listSubscription.unsubscribe();
  unmount();
  store.dispatch(financeApi.util.resetApiState());
});
test('list errors keep the search and recover with retry', async () => {
  failList = true;
  const { user, store, unmount } = mount('/transactions?search=Roadster');
  expect(await screen.findByRole('alert')).toHaveTextContent('Transactions couldn’t load');
  expect(screen.getByRole('searchbox', { name: 'Search transactions' })).toHaveValue('Roadster');
  failList = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Roadster')).toBeInTheDocument();
  unmount();
  store.dispatch(financeApi.util.resetApiState());
});
