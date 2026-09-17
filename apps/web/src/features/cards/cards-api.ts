import { financeApi } from '@/features/finance/finance-api';
import type {
  Card,
  CardPatch,
  CardPayment,
  CardPaymentRequest,
  CardAudit,
  WalletOutcome,
} from './types';
const financialTags = [
  'Cards',
  'CardPayments',
  'CardAudit',
  'Accounts',
  'Overview',
  'Transactions',
] as const;
export const cardsApi = financeApi.injectEndpoints({
  endpoints: (builder) => ({
    getCards: builder.query<Card[], void>({ query: () => '/cards', providesTags: ['Cards'] }),
    getCard: builder.query<Card, string>({
      query: (id) => `/cards/${encodeURIComponent(id)}`,
      providesTags: ['Cards'],
    }),
    createCard: builder.mutation<Card, { type: 'VIRTUAL' | 'SINGLE_USE'; label: string }>({
      query: (body) => ({ url: '/cards', method: 'POST', body }),
      invalidatesTags: ['Cards', 'CardAudit'],
    }),
    patchCard: builder.mutation<Card, { id: string; body: CardPatch }>({
      query: ({ id, body }) => ({ url: `/cards/${encodeURIComponent(id)}`, method: 'PATCH', body }),
      invalidatesTags: ['Cards', 'CardAudit'],
    }),
    terminateCard: builder.mutation<Card, string>({
      query: (id) => ({
        url: `/cards/${encodeURIComponent(id)}/terminate`,
        method: 'POST',
        body: { confirmation: 'TERMINATE' },
      }),
      invalidatesTags: ['Cards', 'CardAudit'],
    }),
    enrollWallet: builder.mutation<WalletOutcome, string>({
      query: (id) => ({
        url: `/cards/${encodeURIComponent(id)}/wallet-enrollment`,
        method: 'POST',
      }),
      invalidatesTags: ['Cards', 'CardAudit'],
    }),
    getCardAudit: builder.query<CardAudit[], string>({
      query: (id) => `/cards/${encodeURIComponent(id)}/audit`,
      providesTags: ['CardAudit'],
    }),
    getCardPayments: builder.query<CardPayment[], string | void>({
      query: (cardId) => ({ url: '/card-payments', params: cardId ? { cardId } : {} }),
      providesTags: ['CardPayments'],
    }),
    getCardPayment: builder.query<CardPayment, string>({
      query: (id) => `/card-payments/${encodeURIComponent(id)}`,
      providesTags: ['CardPayments'],
    }),
    getCardPaymentByKey: builder.query<{ payment: CardPayment | null }, string>({
      query: (key) => `/card-payments/by-key/${encodeURIComponent(key)}`,
      keepUnusedDataFor: 0,
    }),
    authorizeCard: builder.mutation<CardPayment, { key: string; body: CardPaymentRequest }>({
      query: ({ key, body }) => ({
        url: '/card-payments/authorize',
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body,
      }),
      invalidatesTags: financialTags,
    }),
    refundCardPayment: builder.mutation<CardPayment, { id: string; key: string; reason: string }>({
      query: ({ id, key, reason }) => ({
        url: `/card-payments/${encodeURIComponent(id)}/refund`,
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: { reason },
      }),
      invalidatesTags: financialTags,
    }),
  }),
});
export const {
  useGetCardsQuery,
  useGetCardQuery,
  useCreateCardMutation,
  usePatchCardMutation,
  useTerminateCardMutation,
  useEnrollWalletMutation,
  useGetCardAuditQuery,
  useGetCardPaymentsQuery,
  useGetCardPaymentQuery,
  useLazyGetCardPaymentByKeyQuery,
  useAuthorizeCardMutation,
  useRefundCardPaymentMutation,
} = cardsApi;
