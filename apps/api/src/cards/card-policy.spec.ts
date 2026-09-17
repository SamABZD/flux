import type {
  Account,
  Card,
  CardPaymentType,
  CardType,
  CardDeclineReason,
} from '../generated/prisma/client';
import { paymentPolicyDecline, monthBounds } from './card-policy';
import { resolveCardFunding, cardPaymentPostings } from './card-funding';
import { createCredential, revealCredential, luhnValid } from '../../prisma/card-credentials.cjs';
import type { AuthorizeCardDto } from './card.dto';
const now = new Date('2026-09-14T12:00:00Z');
function card(type: CardType = 'PHYSICAL'): Card {
  return {
    id: 'card',
    userId: 'user',
    type,
    status: 'ACTIVE',
    label: 'Everyday',
    network: 'FLUX_DEMO',
    last4: '4821',
    expiryMonth: 8,
    expiryYear: 2029,
    monthlyLimitMinor: null,
    onlinePayments: true,
    contactlessPayments: type === 'PHYSICAL',
    atmWithdrawals: type === 'PHYSICAL',
    magstripePayments: type === 'PHYSICAL',
    locationSecurity: false,
    walletEnrolled: type !== 'SINGLE_USE',
    credentialVersion: 1,
    lastCredentialRotation: now,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null,
  };
}
function request(paymentType: CardPaymentType = 'ONLINE'): AuthorizeCardDto {
  return {
    cardId: 'card',
    credentialVersion: 1,
    merchantName: 'Demo merchant',
    merchantCategory: 'shopping',
    amountMinor: 1000,
    currency: 'USD',
    paymentType,
    cardholderLocation: 'LB',
    merchantLocation: 'LB',
  };
}
test.each<[CardType, CardPaymentType, CardDeclineReason | null]>([
  ['PHYSICAL', 'CONTACTLESS', null],
  ['PHYSICAL', 'CHIP_AND_PIN', null],
  ['PHYSICAL', 'ATM', null],
  ['PHYSICAL', 'MAGSTRIPE', null],
  ['PHYSICAL', 'ONLINE', null],
  ['PHYSICAL', 'RECURRING', null],
  ['VIRTUAL', 'ONLINE', null],
  ['VIRTUAL', 'RECURRING', null],
  ['VIRTUAL', 'DIGITAL_WALLET', null],
  ['VIRTUAL', 'ATM', 'VIRTUAL_ATM_NOT_ALLOWED'],
  ['VIRTUAL', 'CONTACTLESS', 'VIRTUAL_PAYMENT_METHOD_NOT_ALLOWED'],
  ['VIRTUAL', 'CHIP_AND_PIN', 'VIRTUAL_PAYMENT_METHOD_NOT_ALLOWED'],
  ['VIRTUAL', 'MAGSTRIPE', 'VIRTUAL_PAYMENT_METHOD_NOT_ALLOWED'],
  ['SINGLE_USE', 'ONLINE', null],
  ['SINGLE_USE', 'RECURRING', 'SINGLE_USE_RECURRING_NOT_ALLOWED'],
  ['SINGLE_USE', 'ATM', 'SINGLE_USE_ATM_NOT_ALLOWED'],
  ['SINGLE_USE', 'CONTACTLESS', 'SINGLE_USE_PAYMENT_METHOD_NOT_ALLOWED'],
  ['SINGLE_USE', 'CHIP_AND_PIN', 'SINGLE_USE_PAYMENT_METHOD_NOT_ALLOWED'],
  ['SINGLE_USE', 'MAGSTRIPE', 'SINGLE_USE_PAYMENT_METHOD_NOT_ALLOWED'],
  ['SINGLE_USE', 'DIGITAL_WALLET', 'SINGLE_USE_WALLET_NOT_ALLOWED'],
])('%s using %s enforces its instrument capabilities', (type, method, reason) =>
  expect(paymentPolicyDecline(card(type), request(method), now)).toBe(reason),
);
test('single-use subscription/PIN flags cannot disguise an ineligible online payment', () => {
  expect(
    paymentPolicyDecline(card('SINGLE_USE'), { ...request(), isSubscription: true }, now),
  ).toBe('SINGLE_USE_RECURRING_NOT_ALLOWED');
  expect(paymentPolicyDecline(card('SINGLE_USE'), { ...request(), requiresPin: true }, now)).toBe(
    'SINGLE_USE_PAYMENT_METHOD_NOT_ALLOWED',
  );
});
test('expiry uses the end of the UTC month and terminated state stays terminal', () => {
  expect(
    paymentPolicyDecline(
      { ...card(), expiryMonth: 9, expiryYear: 2026 },
      request(),
      new Date('2026-09-30T23:59:59.999Z'),
    ),
  ).toBeNull();
  expect(
    paymentPolicyDecline(
      { ...card(), expiryMonth: 9, expiryYear: 2026 },
      request(),
      new Date('2026-10-01T00:00:00Z'),
    ),
  ).toBe('CARD_EXPIRED');
  expect(
    paymentPolicyDecline({ ...card(), status: 'TERMINATED', expiryYear: 2020 }, request(), now),
  ).toBe('CARD_TERMINATED');
  expect(monthBounds(new Date('2026-12-31T23:30:00-02:00'))).toEqual({
    start: new Date('2027-01-01T00:00:00Z'),
    end: new Date('2027-02-01T00:00:00Z'),
  });
});
test('physical controls are independent of demo-wallet usage and online merchant geography', () => {
  expect(
    paymentPolicyDecline({ ...card(), contactlessPayments: false }, request('CONTACTLESS'), now),
  ).toBe('CONTACTLESS_DISABLED');
  expect(
    paymentPolicyDecline({ ...card(), contactlessPayments: false }, request('DIGITAL_WALLET'), now),
  ).toBeNull();
  expect(
    paymentPolicyDecline({ ...card(), onlinePayments: false }, request('CHIP_AND_PIN'), now),
  ).toBeNull();
  expect(
    paymentPolicyDecline(
      { ...card(), locationSecurity: true },
      { ...request(), merchantLocation: 'FR' },
      now,
    ),
  ).toBeNull();
  expect(
    paymentPolicyDecline(
      { ...card(), locationSecurity: true },
      { ...request('CONTACTLESS'), merchantLocation: 'FR' },
      now,
    ),
  ).toBe('LOCATION_MISMATCH');
});
const rates = [
  { currency: 'USD' as const, usdMicros: 1000000, updatedAt: now },
  { currency: 'EUR' as const, usdMicros: 1100000, updatedAt: now },
];
function account(id: string, currency: 'USD' | 'EUR', balanceMinor: number): Account {
  return {
    id,
    userId: 'user',
    name: id,
    currency,
    balanceMinor,
    openingBalanceMinor: balanceMinor,
    identifier: 'DEMO',
    status: 'active',
  };
}
test('funding prefers a matching currency and never combines partial balances', () => {
  const accounts = [account('usd', 'USD', 100000), account('eur', 'EUR', 10000)];
  const exact = resolveCardFunding(accounts, new Map(), rates, 5000, 'EUR');
  expect(exact).toMatchObject({
    accountId: 'eur',
    billingAmountMinor: 5000,
    feeMinor: 0,
    limitAmountUsdMinor: 5500,
  });
  const fx = resolveCardFunding(accounts, new Map(), rates, 20000, 'EUR');
  expect(fx).toMatchObject({
    accountId: 'usd',
    billingAmountMinor: 22088,
    principalMinor: 22000,
    feeMinor: 88,
    fundingReason: 'FX_FALLBACK',
  });
  expect(
    resolveCardFunding(
      [account('usd', 'USD', 1000), account('eur', 'EUR', 1000)],
      new Map(),
      rates,
      1500,
      'USD',
    ),
  ).toBeNull();
  expect(resolveCardFunding(accounts, new Map([['usd', 1000]]), rates, 90000, 'EUR')).toBeNull();
  if (!fx) throw new Error('Expected FX funding');
  const postings = cardPaymentPostings(fx, 20000, 'EUR');
  for (const currency of ['USD', 'EUR'])
    expect(
      postings.filter((p) => p.currency === currency).reduce((sum, p) => sum + p.amountMinor, 0),
    ).toBe(0);
});
test('synthetic credentials are non-issuable, encrypted, context-bound and rotate last four digits', () => {
  const key = '42'.repeat(32),
    first = createCredential('test-card', key),
    revealed = revealCredential('test-card', key, first);
  expect(revealed.number.startsWith('0000') && revealed.number.length === 16).toBe(true);
  expect(luhnValid(revealed.number)).toBe(false);
  expect(/^\d{3}$/.test(revealed.cvv)).toBe(true);
  expect(JSON.stringify(first).includes(revealed.number)).toBe(false);
  const next = createCredential('test-card', key, first.last4);
  expect(next.last4 === first.last4).toBe(false);
  expect(() => revealCredential('other-card', key, first)).toThrow();
  expect(() => revealCredential('test-card', '43'.repeat(32), first)).toThrow();
});
