import type { Account, Prisma, Currency } from '../generated/prisma/client';
export type TransactionRecord = Prisma.TransactionGetPayload<{
  include: { merchant: true; account: true };
}>;
export function toAccount(account: Account, pendingMinor = 0) {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    balanceMinor: account.balanceMinor,
    availableBalanceMinor: account.balanceMinor - pendingMinor,
    pendingMinor,
    identifier: account.identifier,
    status: account.status,
  };
}
export function toTransaction(transaction: TransactionRecord) {
  return {
    id: transaction.id,
    transferId: transaction.transferId,
    cardPaymentId: transaction.cardPaymentId,
    cardRefundId: transaction.cardRefundId,
    accountId: transaction.accountId,
    merchant: transaction.merchant,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    direction: transaction.direction,
    kind: transaction.kind,
    category: transaction.category,
    timestamp: transaction.timestamp.toISOString(),
    status: transaction.status,
    paymentMethod: transaction.paymentMethod,
    location: transaction.location,
    reference: transaction.reference,
    notes: transaction.notes,
    account: {
      id: transaction.account.id,
      name: transaction.account.name,
      currency: transaction.account.currency,
      identifier: transaction.account.identifier,
    },
  };
}

export const USD_RATE_MICROS: Record<Currency, number> = {
  USD: 1000000,
  EUR: 1100000,
  GBP: 1300000,
  AED: 272294,
};
export function equivalentUsdMinor(accounts: Pick<Account, 'currency' | 'balanceMinor'>[]) {
  return accounts.reduce((sum, account) => {
    const magnitude =
      BigInt(Math.abs(account.balanceMinor)) * BigInt(USD_RATE_MICROS[account.currency]);
    const rounded = Number((magnitude + 500000n) / 1000000n);
    return sum + (account.balanceMinor < 0 ? -rounded : rounded);
  }, 0);
}
