import { financeApi } from '@/features/finance/finance-api';
import type {
  NewRecipient,
  Recipient,
  QuoteRequest,
  TransferQuote,
  Transfer,
  TransferRequest,
} from './types';

export const transfersApi = financeApi.injectEndpoints({
  endpoints: (builder) => ({
    getTransferSession: builder.query<{ userId: string; mode: 'demo' }, void>({
      query: () => ({ url: '/session/demo', method: 'POST' }),
    }),
    getRecipients: builder.query<Recipient[], void>({
      query: () => '/recipients',
      providesTags: ['Recipients'],
    }),
    createRecipient: builder.mutation<Recipient, NewRecipient>({
      query: (body) => ({ url: '/recipients', method: 'POST', body }),
      invalidatesTags: (result) => (result ? ['Recipients'] : []),
    }),
    createQuote: builder.mutation<TransferQuote, QuoteRequest>({
      query: (body) => ({ url: '/transfers/quote', method: 'POST', body }),
    }),
    getQuote: builder.query<TransferQuote, string>({
      query: (id) => `/transfers/quotes/${encodeURIComponent(id)}`,
      keepUnusedDataFor: 0,
    }),
    getTransfers: builder.query<Transfer[], void>({
      query: () => '/transfers',
      providesTags: ['Transfers'],
    }),
    getTransfer: builder.query<Transfer, string>({
      query: (id) => `/transfers/${encodeURIComponent(id)}`,
      providesTags: ['Transfers'],
    }),
    getTransferByKey: builder.query<{ transfer: Transfer | null }, string>({
      query: (key) => `/transfers/by-key/${encodeURIComponent(key)}`,
      keepUnusedDataFor: 0,
    }),
    executeTransfer: builder.mutation<Transfer, { key: string; body: TransferRequest }>({
      query: ({ key, body }) => ({
        url: '/transfers',
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body,
      }),
      invalidatesTags: (result) =>
        result ? ['Accounts', 'Overview', 'Transactions', 'Transfers', 'Recipients'] : [],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          await dispatch(transfersApi.util.upsertQueryData('getTransfer', data.id, data));
        } catch (error) {
          void error;
        }
      },
    }),
  }),
});
export const {
  useGetTransferSessionQuery,
  useGetRecipientsQuery,
  useCreateRecipientMutation,
  useCreateQuoteMutation,
  useGetQuoteQuery,
  useGetTransfersQuery,
  useGetTransferQuery,
  useLazyGetTransferByKeyQuery,
  useExecuteTransferMutation,
} = transfersApi;
export function transferError(error: unknown): {
  message: string;
  code: string;
  shortfallMinor: number | null;
  ambiguous: boolean;
} {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const ambiguous = typeof error.status !== 'number' || error.status >= 500;
    if ('data' in error && typeof error.data === 'object' && error.data !== null) {
      const data = error.data;
      return {
        message:
          'message' in data && typeof data.message === 'string'
            ? data.message
            : 'The request could not be completed.',
        code: 'code' in data && typeof data.code === 'string' ? data.code : '',
        shortfallMinor:
          'details' in data &&
          typeof data.details === 'object' &&
          data.details !== null &&
          'shortfallMinor' in data.details &&
          typeof data.details.shortfallMinor === 'number'
            ? data.details.shortfallMinor
            : null,
        ambiguous,
      };
    }
    return {
      message: 'The connection was interrupted. Please try again.',
      code: '',
      shortfallMinor: null,
      ambiguous,
    };
  }
  return {
    message: 'The request could not be confirmed. Check the saved result before trying again.',
    code: '',
    shortfallMinor: null,
    ambiguous: true,
  };
}
