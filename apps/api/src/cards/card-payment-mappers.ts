import type { Prisma } from '../generated/prisma/client';
import { declineMessages } from './card-policy';
export const paymentInclude = {
  card: true,
  account: true,
  refund: true,
} satisfies Prisma.CardPaymentInclude;
export type PaymentRecord = Prisma.CardPaymentGetPayload<{ include: typeof paymentInclude }>;
export function publicCardPayment(payment: PaymentRecord) {
  return {
    id: payment.id,
    merchantName: payment.merchantName,
    merchantCategory: payment.merchantCategory,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    paymentType: payment.paymentType,
    isSubscription: payment.isSubscription,
    merchantLocation: payment.merchantLocation,
    cardholderLocation: payment.cardholderLocation,
    status: payment.status,
    declineReason: payment.declineReason,
    decline: payment.declineReason ? declineMessages[payment.declineReason] : null,
    account: payment.account
      ? { id: payment.account.id, name: payment.account.name, currency: payment.account.currency }
      : null,
    billingCurrency: payment.billingCurrency,
    billingAmountMinor: payment.billingAmountMinor,
    principalMinor: payment.principalMinor,
    feeMinor: payment.feeMinor,
    rateLabel: payment.rateLabel,
    fundingReason: payment.fundingReason,
    limitAmountUsdMinor: payment.limitAmountUsdMinor,
    card: {
      id: payment.card.id,
      label: payment.card.label,
      type: payment.card.type,
      last4: payment.cardLast4,
      credentialVersion: payment.credentialVersion,
    },
    currentCredentialVersion: payment.card.credentialVersion,
    reference: payment.reference,
    note: payment.note,
    createdAt: payment.createdAt.toISOString(),
    authorizedAt: payment.authorizedAt?.toISOString() ?? null,
    completedAt: payment.completedAt?.toISOString() ?? null,
    refundedAt: payment.refundedAt?.toISOString() ?? null,
    refund: payment.refund
      ? {
          id: payment.refund.id,
          reference: payment.refund.reference,
          reason: payment.refund.reason,
          createdAt: payment.refund.createdAt.toISOString(),
        }
      : null,
  };
}
