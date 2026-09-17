import type { Recipient, Transfer, TransferQuote } from '../src/features/transfers/types';
export const recipientFixture: Recipient = {
  id: 'maya-haddad',
  name: 'Maya Haddad',
  type: 'person',
  country: 'FR',
  preferredCurrency: 'EUR',
  supportedCurrencies: ['EUR'],
  bankName: 'Banque Lumière',
  accountIdentifier: 'DEMO-FR-MAYA-2401',
  lastUsedAt: '2026-09-14T12:00:00Z',
  status: 'active',
};
export function quoteFixture(): TransferQuote {
  return {
    id: 'cbcefbaf-a7d2-43d1-87d0-1277ed149779',
    kind: 'send',
    sourceAccountId: 'usd',
    recipientId: recipientFixture.id,
    destinationAccountId: null,
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    sourceAmountMinor: 55000,
    destinationAmountMinor: 50000,
    feeMinor: 220,
    totalDebitMinor: 55220,
    rateLabel: '0.909090',
    expiresAt: new Date(Date.now() + 45000).toISOString(),
    serverNow: new Date().toISOString(),
    availableBalanceMinor: 480760,
    shortfallMinor: 0,
    estimatedArrival: 'Usually within a few seconds in this demo',
    rateSource: 'Illustrative demo exchange rates',
  };
}
export function transferFixture(): Transfer {
  return {
    id: 'b0ddf4cc-6f04-434a-b9fa-cf2c23b685a7',
    kind: 'send',
    recipient: recipientFixture,
    sourceAccount: { id: 'usd', name: 'Everyday dollar', currency: 'USD' },
    destinationAccount: null,
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    sourceAmountMinor: 55000,
    destinationAmountMinor: 50000,
    feeMinor: 220,
    totalDebitMinor: 55220,
    rateLabel: '0.909090',
    status: 'COMPLETED',
    reference: 'FLX-B0DDF4CC',
    note: 'Rent',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    failureReason: null,
  };
}
