import type { Card, CardPayment, CardType } from '../src/features/cards/types';
export function cardFixture(type: CardType = 'PHYSICAL'): Card {
  return {
    id: `card-${type.toLowerCase()}`,
    type,
    status: 'ACTIVE',
    label:
      type === 'PHYSICAL'
        ? 'Everyday'
        : type === 'VIRTUAL'
          ? 'Online shopping'
          : 'One-time purchases',
    network: 'FLUX_DEMO',
    holderName: 'Alex Morgan',
    last4: '1234',
    expiryMonth: 8,
    expiryYear: 2029,
    credentialVersion: 1,
    lastCredentialRotation: '2026-09-15T10:00:00Z',
    createdAt: '2026-09-14T10:00:00Z',
    terminatedAt: null,
    monthlyLimit: {
      enabled: false,
      amountMinor: null,
      currency: 'USD',
      spentMinor: 0,
      remainingMinor: null,
      periodStart: '2026-09-01T00:00:00Z',
      periodEnd: '2026-10-01T00:00:00Z',
    },
    security: {
      onlinePayments: true,
      ...(type === 'PHYSICAL'
        ? {
            contactlessPayments: true,
            atmWithdrawals: true,
            magstripePayments: false,
            locationSecurity: false,
          }
        : {}),
    },
    walletEnrolled: false,
  };
}
export function cardPaymentFixture(card: Card = cardFixture()): CardPayment {
  return {
    id: 'payment-1',
    merchantName: 'Roadster',
    merchantCategory: 'dining',
    amountMinor: 2800,
    currency: 'USD',
    paymentType: 'CONTACTLESS',
    isSubscription: false,
    merchantLocation: 'LB',
    cardholderLocation: 'LB',
    status: 'COMPLETED',
    declineReason: null,
    decline: null,
    account: { id: 'usd', name: 'Everyday dollar', currency: 'USD' },
    billingCurrency: 'USD',
    billingAmountMinor: 2800,
    principalMinor: 2800,
    feeMinor: 0,
    rateLabel: '1.000000',
    fundingReason: 'MATCHING_CURRENCY',
    limitAmountUsdMinor: 2800,
    card: {
      id: card.id,
      label: card.label,
      type: card.type,
      last4: card.last4,
      credentialVersion: card.credentialVersion,
    },
    currentCredentialVersion: 1,
    reference: 'PAY-TEST',
    note: '',
    createdAt: '2026-09-15T10:00:00Z',
    authorizedAt: '2026-09-15T10:00:00Z',
    completedAt: '2026-09-15T10:00:00Z',
    refundedAt: null,
    refund: null,
  };
}
