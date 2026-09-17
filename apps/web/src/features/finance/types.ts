export const currencies = ['USD', 'EUR', 'GBP', 'AED'] as const;
export type Currency = (typeof currencies)[number];
export const categories = [
  'dining',
  'transport',
  'shopping',
  'subscriptions',
  'entertainment',
  'travel',
  'groceries',
  'utilities',
  'health',
  'other',
  'income',
  'transfers',
] as const;
export type TransactionCategory = (typeof categories)[number];
export const statuses = ['completed', 'pending', 'refunded', 'failed'] as const;
export type TransactionStatus = (typeof statuses)[number];
export type TransactionDirection = 'credit' | 'debit';
export type PaymentMethod = 'card' | 'bank_transfer' | 'direct_debit';
export type TransactionKind = 'purchase' | 'income' | 'transfer' | 'refund';
export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Account {
  id: string;
  name: string;
  currency: Currency;
  balanceMinor: number;
  availableBalanceMinor: number;
  pendingMinor: number;
  identifier: string;
  status: 'active' | 'frozen';
}
export interface Merchant {
  id: string;
  name: string;
  icon: string;
}
export interface Transaction {
  id: string;
  transferId: string | null;
  cardPaymentId?: string | null;
  cardRefundId?: string | null;
  accountId: string;
  merchant: Merchant;
  amountMinor: number;
  currency: Currency;
  direction: TransactionDirection;
  kind: TransactionKind;
  category: TransactionCategory;
  timestamp: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  location: string;
  reference: string;
  notes: string;
  account: Pick<Account, 'id' | 'name' | 'currency' | 'identifier'>;
}
export interface AccountsResponse {
  user: User;
  items: Account[];
}
export interface TransactionFilters {
  account: string;
  category: TransactionCategory | '';
  status: TransactionStatus | '';
  direction: TransactionDirection | '';
  search: string;
  merchant: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}
export interface TransactionsResponse {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface Overview extends AccountsResponse {
  asOf: string;
  totalBalanceMinor: number;
  reportingCurrency: 'USD';
  fx: { label: string; asOf: string; usdRateMicros: Record<Currency, number> };
  spending: {
    accountId: string;
    currency: Currency;
    currentMinor: number;
    previousMinor: number;
    changePercent: number | null;
    month: string;
    previousMonth: string;
    throughDay: number;
    daily: { day: number; amountMinor: number }[];
    categories: { category: TransactionCategory; amountMinor: number }[];
  };
}
