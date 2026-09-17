import type { CardPaymentRequest } from './types';
import { paymentTypes } from './types';
import { categories } from '@/features/finance/types';
export const CARD_PENDING_KEY = 'flux.card-payment.pending.v1';
export const refundKey = (id: string) => `flux.card-refund.pending.v1:${id}`;
export interface PendingCardPayment {
  key: string;
  body: CardPaymentRequest;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function readPendingPayment(): PendingCardPayment | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(CARD_PENDING_KEY) ?? 'null');
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('key' in parsed) ||
      typeof parsed.key !== 'string' ||
      !uuid.test(parsed.key) ||
      !('body' in parsed) ||
      !parsed.body ||
      typeof parsed.body !== 'object'
    )
      return null;
    const body = parsed.body as Record<string, unknown>;
    if (
      typeof body.cardId !== 'string' ||
      typeof body.credentialVersion !== 'number' ||
      !Number.isInteger(body.credentialVersion) ||
      typeof body.merchantName !== 'string' ||
      !categories.some((category) => category === body.merchantCategory) ||
      typeof body.amountMinor !== 'number' ||
      !Number.isInteger(body.amountMinor) ||
      body.amountMinor <= 0 ||
      typeof body.currency !== 'string' ||
      !/^\p{Lu}{3}$/u.test(body.currency) ||
      !paymentTypes.some((type) => type === body.paymentType)
    )
      return null;
    for (const field of ['merchantLocation', 'cardholderLocation', 'note'])
      if (body[field] !== undefined && typeof body[field] !== 'string') return null;
    for (const field of ['isSubscription', 'requiresPin'])
      if (body[field] !== undefined && typeof body[field] !== 'boolean') return null;
    const safe: CardPaymentRequest = {
      cardId: body.cardId,
      credentialVersion: body.credentialVersion,
      merchantName: body.merchantName,
      merchantCategory: body.merchantCategory as CardPaymentRequest['merchantCategory'],
      amountMinor: body.amountMinor,
      currency: body.currency,
      paymentType: body.paymentType as CardPaymentRequest['paymentType'],
    };
    if (typeof body.isSubscription === 'boolean') safe.isSubscription = body.isSubscription;
    if (typeof body.requiresPin === 'boolean') safe.requiresPin = body.requiresPin;
    if (typeof body.merchantLocation === 'string') safe.merchantLocation = body.merchantLocation;
    if (typeof body.cardholderLocation === 'string')
      safe.cardholderLocation = body.cardholderLocation;
    if (typeof body.note === 'string') safe.note = body.note;
    return { key: parsed.key, body: safe };
  } catch {
    return null;
  }
}
export function savePendingPayment(value: PendingCardPayment) {
  sessionStorage.setItem(CARD_PENDING_KEY, JSON.stringify(value));
}
export function clearPendingPayment() {
  sessionStorage.removeItem(CARD_PENDING_KEY);
}
export function readRefund(id: string): { key: string; reason: string } | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(refundKey(id)) ?? 'null');
    return typeof value === 'object' &&
      value &&
      'key' in value &&
      typeof value.key === 'string' &&
      uuid.test(value.key) &&
      'reason' in value &&
      typeof value.reason === 'string'
      ? { key: value.key, reason: value.reason }
      : null;
  } catch {
    return null;
  }
}
