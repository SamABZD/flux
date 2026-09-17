import type { Currency, Transaction, TransactionCategory } from './types';

export const currencyNames: Record<Currency, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  AED: 'UAE Dirham',
};
export const categoryNames: Record<TransactionCategory, string> = {
  dining: 'Dining',
  transport: 'Transport',
  shopping: 'Shopping',
  subscriptions: 'Subscriptions',
  entertainment: 'Entertainment',
  travel: 'Travel',
  groceries: 'Groceries',
  utilities: 'Utilities',
  health: 'Health',
  other: 'Other',
  income: 'Income',
  transfers: 'Transfers',
};
export const paymentNames = {
  card: 'Card payment',
  bank_transfer: 'Bank transfer',
  direct_debit: 'Direct debit',
};
export function formatMoney(amountMinor: number, currency: Currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: currency === 'AED' ? 'code' : 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
export function transactionAmount(
  transaction: Pick<Transaction, 'amountMinor' | 'currency' | 'direction'>,
) {
  return `${transaction.direction === 'credit' ? '+' : '−'}${formatMoney(transaction.amountMinor, transaction.currency)}`;
}
export function accessibleAmount(
  transaction: Pick<Transaction, 'amountMinor' | 'currency' | 'direction' | 'status'>,
) {
  const action =
    transaction.status === 'failed'
      ? 'Failed payment'
      : transaction.status === 'pending'
        ? 'Pending payment'
        : transaction.direction === 'credit'
          ? 'Received'
          : 'Spent';
  return `${action} ${formatMoney(transaction.amountMinor, transaction.currency)} ${transaction.currency}`;
}
export function formatDate(timestamp: string, withTime = false) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(new Date(timestamp));
}
export function formatMonth(timestamp: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(
    new Date(timestamp),
  );
}
export function transactionReturnPath(value: string | null) {
  return value &&
    /^\/(?:home|accounts(?:\/[a-z]+)?|transactions|analytics(?:\/(?:categories|merchants)\/[a-zA-Z0-9_%:-]+)?|budgets|subscriptions(?:\/[a-zA-Z0-9_-]+)?)(?:\?[^#]*)?$/.test(
      value,
    )
    ? value
    : '/transactions';
}
