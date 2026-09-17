import type { Card, CardDeclineReason, CardPaymentType } from '../generated/prisma/client';
import type { AuthorizeCardDto } from './card.dto';

export const declineMessages: Record<CardDeclineReason, { message: string; action: string }> = {
  CARD_FROZEN: {
    message: 'This card is frozen.',
    action: 'Unfreeze the card before trying a new payment.',
  },
  CARD_TERMINATED: {
    message: 'This card has been terminated.',
    action: 'Use another active card. Historical payments and refunds remain available.',
  },
  CARD_EXPIRED: { message: 'This card has expired.', action: 'Use another active card.' },
  CARD_PENDING: { message: 'This card is not active yet.', action: 'Use an active card.' },
  INVALID_CARD: {
    message: 'This card is unavailable.',
    action: 'Select a card in your demo workspace.',
  },
  ONLINE_PAYMENTS_DISABLED: {
    message: 'Online payments are turned off.',
    action: 'Enable online payments in this card’s settings, then make a new attempt.',
  },
  CONTACTLESS_DISABLED: {
    message: 'Contactless payments are turned off.',
    action: 'Enable contactless or use chip and PIN.',
  },
  ATM_DISABLED: {
    message: 'Cash withdrawals are turned off.',
    action: 'Enable ATM withdrawals for this physical card.',
  },
  MAGSTRIPE_DISABLED: {
    message: 'Magnetic-stripe payments are turned off.',
    action: 'Use chip and PIN, or enable magnetic stripe in settings.',
  },
  LOCATION_MISMATCH: {
    message: 'The simulated cardholder and merchant countries do not match.',
    action: 'Use matching simulated countries or review location security in card settings.',
  },
  LOCATION_REQUIRED: {
    message: 'Location security needs both simulated countries.',
    action: 'Choose cardholder and merchant countries in Demo Tools.',
  },
  SPENDING_LIMIT_EXCEEDED: {
    message: 'This payment would exceed the card’s monthly limit.',
    action: 'Increase or disable the limit, reduce the amount, or use another card.',
  },
  INSUFFICIENT_FUNDS: {
    message: 'No single available account can cover this payment and any FX fee.',
    action:
      'Reduce the amount or use another funded currency account. Partial balances are not combined.',
  },
  UNSUPPORTED_CURRENCY: {
    message: 'This currency is not supported by the demo.',
    action: 'Choose USD, EUR, GBP, or AED.',
  },
  STALE_CREDENTIALS: {
    message: 'These saved card details are no longer active.',
    action: 'Use the refreshed card details for a new one-time purchase.',
  },
  SINGLE_USE_RECURRING_NOT_ALLOWED: {
    message: 'Single-use cards cannot pay subscriptions or recurring charges.',
    action: 'Use a reusable virtual or physical card.',
  },
  SINGLE_USE_ATM_NOT_ALLOWED: {
    message: 'Single-use cards cannot withdraw cash.',
    action: 'Use an active physical card with ATM withdrawals enabled.',
  },
  SINGLE_USE_PAYMENT_METHOD_NOT_ALLOWED: {
    message: 'Single-use cards work only for one-time online purchases without a PIN.',
    action: 'Choose an eligible online purchase or use another card.',
  },
  SINGLE_USE_WALLET_NOT_ALLOWED: {
    message: 'Single-use cards cannot be added to a digital wallet.',
    action: 'Use a reusable virtual or physical card.',
  },
  VIRTUAL_ATM_NOT_ALLOWED: {
    message: 'Virtual cards cannot withdraw cash.',
    action: 'Use an active physical card.',
  },
  VIRTUAL_PAYMENT_METHOD_NOT_ALLOWED: {
    message: 'This virtual card does not support physical-card or PIN-required payments.',
    action: 'Use an online payment or an enrolled demo wallet, or choose a physical card.',
  },
  WALLET_NOT_ENROLLED: {
    message: 'This card has not been added to the demo wallet.',
    action: 'Run the wallet enrollment simulation first.',
  },
};
export function effectiveCardStatus(
  card: Pick<Card, 'status' | 'expiryMonth' | 'expiryYear'>,
  now = new Date(),
) {
  if (card.status === 'TERMINATED') return 'TERMINATED' as const;
  if (
    card.status === 'EXPIRED' ||
    card.expiryYear < now.getUTCFullYear() ||
    (card.expiryYear === now.getUTCFullYear() && card.expiryMonth < now.getUTCMonth() + 1)
  )
    return 'EXPIRED' as const;
  return card.status;
}
export function cardStateDecline(card: Card, now = new Date()): CardDeclineReason | null {
  const state = effectiveCardStatus(card, now);
  return state === 'FROZEN'
    ? 'CARD_FROZEN'
    : state === 'TERMINATED'
      ? 'CARD_TERMINATED'
      : state === 'EXPIRED'
        ? 'CARD_EXPIRED'
        : state === 'PENDING'
          ? 'CARD_PENDING'
          : null;
}
const physicalMethods: CardPaymentType[] = ['CONTACTLESS', 'CHIP_AND_PIN', 'MAGSTRIPE', 'ATM'];
export function paymentPolicyDecline(
  card: Card,
  request: AuthorizeCardDto,
  now = new Date(),
): CardDeclineReason | null {
  const state = cardStateDecline(card, now);
  if (state) return state;
  if (request.credentialVersion !== card.credentialVersion) return 'STALE_CREDENTIALS';
  if (card.type === 'SINGLE_USE') {
    if (request.paymentType === 'RECURRING' || request.isSubscription)
      return 'SINGLE_USE_RECURRING_NOT_ALLOWED';
    if (request.paymentType === 'ATM') return 'SINGLE_USE_ATM_NOT_ALLOWED';
    if (request.paymentType === 'DIGITAL_WALLET') return 'SINGLE_USE_WALLET_NOT_ALLOWED';
    if (request.paymentType !== 'ONLINE' || request.requiresPin)
      return 'SINGLE_USE_PAYMENT_METHOD_NOT_ALLOWED';
  }
  if (card.type === 'VIRTUAL') {
    if (request.paymentType === 'ATM') return 'VIRTUAL_ATM_NOT_ALLOWED';
    if (physicalMethods.includes(request.paymentType) || request.requiresPin)
      return 'VIRTUAL_PAYMENT_METHOD_NOT_ALLOWED';
  }
  if (
    (request.paymentType === 'ONLINE' ||
      request.paymentType === 'RECURRING' ||
      request.isSubscription) &&
    !card.onlinePayments
  )
    return 'ONLINE_PAYMENTS_DISABLED';
  if (request.paymentType === 'CONTACTLESS' && !card.contactlessPayments)
    return 'CONTACTLESS_DISABLED';
  if (request.paymentType === 'ATM' && !card.atmWithdrawals) return 'ATM_DISABLED';
  if (request.paymentType === 'MAGSTRIPE' && !card.magstripePayments) return 'MAGSTRIPE_DISABLED';
  if (request.paymentType === 'DIGITAL_WALLET' && !card.walletEnrolled)
    return 'WALLET_NOT_ENROLLED';
  if (
    card.type === 'PHYSICAL' &&
    card.locationSecurity &&
    (physicalMethods.includes(request.paymentType) || request.paymentType === 'DIGITAL_WALLET')
  ) {
    if (!request.cardholderLocation || !request.merchantLocation) return 'LOCATION_REQUIRED';
    if (request.cardholderLocation !== request.merchantLocation) return 'LOCATION_MISMATCH';
  }
  return null;
}
export function monthBounds(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}
