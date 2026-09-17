import type { Account, Currency } from '@/features/finance/types';
export type TransferKind = 'send' | 'exchange';
export interface Recipient {
  id: string;
  name: string;
  type: 'person' | 'business';
  country: string;
  preferredCurrency: Currency;
  supportedCurrencies: Currency[];
  bankName: string;
  accountIdentifier: string;
  lastUsedAt: string | null;
  status: 'active' | 'blocked';
}
export type NewRecipient = Pick<
  Recipient,
  'name' | 'type' | 'country' | 'preferredCurrency' | 'bankName' | 'accountIdentifier'
>;
export interface QuoteRequest {
  kind: TransferKind;
  sourceAccountId: string;
  recipientId?: string;
  destinationAccountId?: string;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  destinationAmountMinor: number;
}
export interface TransferQuote {
  id: string;
  kind: TransferKind;
  sourceAccountId: string;
  recipientId: string | null;
  destinationAccountId: string | null;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  sourceAmountMinor: number;
  destinationAmountMinor: number;
  feeMinor: number;
  totalDebitMinor: number;
  rateLabel: string;
  expiresAt: string;
  serverNow: string;
  availableBalanceMinor: number;
  shortfallMinor: number;
  estimatedArrival: string;
  rateSource: string;
}
export interface TransferRequest {
  quoteId: string;
  sourceAccountId: string;
  recipientId?: string;
  destinationAccountId?: string;
  note?: string;
}
export interface Transfer {
  id: string;
  kind: TransferKind;
  recipient: Recipient | null;
  sourceAccount: Pick<Account, 'id' | 'name' | 'currency'>;
  destinationAccount: Pick<Account, 'id' | 'name' | 'currency'> | null;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  sourceAmountMinor: number;
  destinationAmountMinor: number;
  feeMinor: number;
  totalDebitMinor: number;
  rateLabel: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  reference: string;
  note: string;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
}
