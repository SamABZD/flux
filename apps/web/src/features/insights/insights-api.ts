import { financeApi } from '@/features/finance/finance-api';
import type {
  Analytics,
  InsightFilters,
  Budgets,
  Subscriptions,
  BudgetItem,
  NewSubscription,
  SubscriptionEdit,
} from './types';
import type { Currency } from '@/features/finance/types';
export const insightsApi = financeApi.injectEndpoints({
  endpoints: (builder) => ({
    getAnalytics: builder.query<Analytics, InsightFilters>({
      query: (filters) => ({ url: '/analytics/summary', params: filters }),
      providesTags: ['Transactions'],
    }),
    getBudgets: builder.query<Budgets, { month?: string; baseCurrency: Currency }>({
      query: (params) => ({ url: '/budgets', params }),
      providesTags: ['Budgets', 'Transactions'],
    }),
    createBudget: builder.mutation<
      { id: string },
      { key: string; body: Pick<BudgetItem, 'category' | 'currency' | 'amountMinor'> }
    >({
      query: ({ key, body }) => ({
        url: '/budgets',
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body,
      }),
      invalidatesTags: ['Budgets'],
    }),
    editBudget: builder.mutation<
      { id: string },
      { id: string; revision: number; amountMinor?: number; enabled?: boolean }
    >({
      query: ({ id, ...body }) => ({
        url: `/budgets/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Budgets'],
    }),
    archiveBudget: builder.mutation<{ id: string }, { id: string; revision: number }>({
      query: ({ id, ...body }) => ({
        url: `/budgets/${encodeURIComponent(id)}`,
        method: 'DELETE',
        body,
      }),
      invalidatesTags: ['Budgets'],
    }),
    getSubscriptions: builder.query<Subscriptions, Currency>({
      query: (baseCurrency) => ({ url: '/subscriptions', params: { baseCurrency } }),
      providesTags: ['Subscriptions', 'Transactions', 'Cards'],
    }),
    createSubscription: builder.mutation<{ id: string }, { key: string; body: NewSubscription }>({
      query: ({ key, body }) => ({
        url: '/subscriptions',
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body,
      }),
      invalidatesTags: ['Subscriptions'],
    }),
    editSubscription: builder.mutation<{ id: string }, { id: string; body: SubscriptionEdit }>({
      query: ({ id, body }) => ({
        url: `/subscriptions/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Subscriptions'],
    }),
  }),
});
export const {
  useGetAnalyticsQuery,
  useGetBudgetsQuery,
  useCreateBudgetMutation,
  useEditBudgetMutation,
  useArchiveBudgetMutation,
  useGetSubscriptionsQuery,
  useCreateSubscriptionMutation,
  useEditSubscriptionMutation,
} = insightsApi;
