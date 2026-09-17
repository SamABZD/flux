import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { withDemoSession } from './session-query';
import type {
  Account,
  AccountsResponse,
  Merchant,
  Overview,
  Transaction,
  TransactionCategory,
  TransactionFilters,
  TransactionsResponse,
} from './types';

const request = fetchBaseQuery({
  baseUrl: __API_BASE_URL__,
  timeout: 20000,
  credentials: 'include',
  prepareHeaders: (headers) => {
    headers.set('X-Flux-Client', 'web');
    return headers;
  },
});

export const financeApi = createApi({
  reducerPath: 'financeApi',
  baseQuery: withDemoSession(request),
  tagTypes: [
    'Transactions',
    'Overview',
    'Accounts',
    'Recipients',
    'Transfers',
    'Cards',
    'CardPayments',
    'CardAudit',
    'Budgets',
    'Subscriptions',
  ],
  endpoints: (builder) => ({
    getAccounts: builder.query<AccountsResponse, void>({
      query: () => '/accounts',
      providesTags: ['Accounts'],
    }),
    getAccount: builder.query<Account, string>({
      query: (id) => `/accounts/${encodeURIComponent(id)}`,
      providesTags: ['Accounts'],
    }),
    getOverview: builder.query<Overview, string>({
      query: (account) => ({ url: '/overview', params: { account } }),
      providesTags: ['Overview'],
    }),
    getTransactions: builder.query<TransactionsResponse, Partial<TransactionFilters>>({
      query: (filters) => ({
        url: '/transactions',
        params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')),
      }),
      providesTags: ['Transactions'],
    }),
    getTransaction: builder.query<Transaction, string>({
      query: (id) => `/transactions/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'Transactions', id }],
    }),
    getMerchants: builder.query<Merchant[], void>({ query: () => '/merchants' }),
    updateCategory: builder.mutation<Transaction, { id: string; category: TransactionCategory }>({
      query: ({ id, category }) => ({
        url: `/transactions/${encodeURIComponent(id)}/category`,
        method: 'PATCH',
        body: { category },
      }),
      invalidatesTags: (result) => (result ? ['Transactions', 'Overview'] : []),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(financeApi.util.updateQueryData('getTransaction', id, () => data));
        } catch (error) {
          void error;
        }
      },
    }),
  }),
});
export const {
  useGetAccountsQuery,
  useGetAccountQuery,
  useGetOverviewQuery,
  useGetTransactionsQuery,
  useGetTransactionQuery,
  useGetMerchantsQuery,
  useUpdateCategoryMutation,
} = financeApi;
