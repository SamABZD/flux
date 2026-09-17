import { analyticsPeriod, dateKey, strictDate } from './analytics-period';
import {
  aggregateAnalytics,
  changePercent,
  classifyActivity,
  reportActivities,
  reportingConverter,
} from './analytics-model';
import type { InsightTransaction, RateSnapshot } from './analytics-model';
const now = new Date('2026-09-15T10:00:00Z');
const rates: RateSnapshot = [
  { currency: 'USD', usdMicros: 1000000, updatedAt: now },
  { currency: 'EUR', usdMicros: 1100000, updatedAt: now },
  { currency: 'GBP', usdMicros: 1300000, updatedAt: now },
  { currency: 'AED', usdMicros: 272294, updatedAt: now },
];
const transaction = (overrides: Partial<InsightTransaction> = {}): InsightTransaction => ({
  id: 'payment',
  accountId: 'usd',
  currency: 'USD',
  merchantId: 'roadster',
  amountMinor: 1000,
  direction: 'debit',
  kind: 'purchase',
  category: 'dining',
  timestamp: new Date('2026-09-05T10:00:00Z'),
  status: 'completed',
  paymentMethod: 'card',
  location: 'Demo',
  reference: 'DEMO-1',
  notes: '',
  transferId: null,
  cardPaymentId: null,
  cardRefundId: null,
  transfer: null,
  merchant: { id: 'roadster', name: 'Roadster', icon: 'dining' },
  account: {
    id: 'usd',
    userId: 'user',
    name: 'Dollar',
    currency: 'USD',
    balanceMinor: 0,
    openingBalanceMinor: 0,
    identifier: 'DEMO',
    status: 'active',
  },
  ...overrides,
});
test.each([
  ['week', '2026-09-09', '2026-09-02', '2026-09-09'],
  ['month', '2026-09-01', '2026-08-01', '2026-08-16'],
  ['quarter', '2026-07-01', '2026-04-01', '2026-06-16'],
  ['half-year', '2026-04-01', '2025-10-01', '2026-03-16'],
  ['year', '2026-01-01', '2025-01-01', '2025-09-16'],
] as const)(
  '%s uses explicit UTC current and comparable previous ranges',
  (period, start, previous, end) => {
    const result = analyticsPeriod({ period }, now);
    expect(dateKey(result.start)).toBe(start);
    expect(dateKey(result.end)).toBe('2026-09-16');
    expect(dateKey(result.previousStart)).toBe(previous);
    expect(dateKey(result.previousEnd)).toBe(end);
  },
);
test('month ends and leap years clamp instead of overflowing into another month', () => {
  expect(
    dateKey(analyticsPeriod({ period: 'month' }, new Date('2024-03-31T10:00:00Z')).previousEnd),
  ).toBe('2024-03-01');
  expect(
    dateKey(analyticsPeriod({ period: 'month' }, new Date('2025-03-31T10:00:00Z')).previousEnd),
  ).toBe('2025-03-01');
  expect(
    dateKey(analyticsPeriod({ period: 'year' }, new Date('2024-02-29T10:00:00Z')).previousEnd),
  ).toBe('2023-03-01');
});
test('custom inclusive dates compare the immediately preceding equal duration', () => {
  const result = analyticsPeriod(
    { period: 'month', dateFrom: '2026-09-04', dateTo: '2026-09-10' },
    now,
  );
  expect([result.start, result.end, result.previousStart, result.previousEnd].map(dateKey)).toEqual(
    ['2026-09-04', '2026-09-11', '2026-08-28', '2026-09-04'],
  );
});
test.each(['2026-02-30', '2026-13-01', '2026-1-01', 'invalid'])(
  'rejects malformed date %s',
  (value) => expect(() => strictDate(value)).toThrow(),
);
test('rejects incomplete, backwards, overlong and future reporting windows', () => {
  for (const query of [
    { dateFrom: '2026-09-01' },
    { dateFrom: '2026-09-10', dateTo: '2026-09-01' },
    { dateFrom: '2024-01-01', dateTo: '2026-01-01' },
    { dateFrom: '2026-09-01', dateTo: '2026-09-16' },
  ])
    expect(() => analyticsPeriod({ period: 'month', ...query }, now)).toThrow();
});
test('same-currency and cross-currency conversion uses exact shared integer rounding', () => {
  expect(reportingConverter(rates, 'USD')(100, 'EUR')).toBe(110);
  expect(reportingConverter(rates, 'EUR')(100, 'USD')).toBe(91);
  expect(reportingConverter(rates, 'AED')(1, 'USD')).toBe(4);
  expect(reportingConverter(rates, 'GBP')(1234, 'GBP')).toBe(1234);
  expect(() => reportingConverter(rates.slice(1), 'USD')).toThrow('Reporting rates');
});
test('pending and failed transactions never enter settled insight totals', () => {
  expect(classifyActivity(transaction({ status: 'pending' }))).toBeNull();
  expect(classifyActivity(transaction({ status: 'failed' }))).toBeNull();
});
test('internal FX principal is excluded on both sides while its source fee counts once', () => {
  const debit = transaction({
    kind: 'transfer',
    amountMinor: 10050,
    transfer: { kind: 'exchange', feeMinor: 50 },
  });
  expect(classifyActivity(debit)).toMatchObject({
    amountMinor: 50,
    feeOnly: true,
    category: 'other',
  });
  expect(classifyActivity({ ...debit, direction: 'credit' })).toBeNull();
  expect(classifyActivity({ ...debit, transfer: { kind: 'send', feeMinor: 50 } })).toMatchObject({
    amountMinor: 10000,
    direction: 'transfer-out',
    category: 'transfers',
    feeOnly: false,
  });
});
test('refunds preserve the original debit and credit the actual refund date without double counting', () => {
  const items = reportActivities(
    [
      transaction({ status: 'refunded', timestamp: new Date('2026-08-05T10:00:00Z') }),
      transaction({
        id: 'refund',
        kind: 'refund',
        direction: 'credit',
        status: 'refunded',
        timestamp: new Date('2026-09-05T10:00:00Z'),
      }),
    ],
    rates,
    'USD',
  );
  const result = aggregateAnalytics(items, analyticsPeriod({ period: 'month' }, now));
  expect(result).toMatchObject({
    spendingMinor: -1000,
    previousSpendingMinor: 1000,
    incomeMinor: 0,
    netCashFlowMinor: 1000,
  });
  expect(result.incomeSources).toEqual([]);
  expect(result.categories[0]).toMatchObject({
    category: 'dining',
    amountMinor: -1000,
    sharePercent: 0,
  });
});
test('categories, merchants, trend and cash flow all reconcile to the same converted activity', () => {
  const items = reportActivities(
    [
      transaction(),
      transaction({ id: 'eur-payment', currency: 'EUR', amountMinor: 2000, category: 'shopping' }),
      transaction({ id: 'salary', kind: 'income', direction: 'credit', amountMinor: 5000 }),
    ],
    rates,
    'USD',
  );
  const result = aggregateAnalytics(items, analyticsPeriod({ period: 'month' }, now));
  expect(result).toMatchObject({
    spendingMinor: 3200,
    incomeMinor: 5000,
    netCashFlowMinor: 1800,
    transactionCount: 2,
    averageTransactionMinor: 1600,
    spendingChangePercent: null,
  });
  expect(result.categories.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(3200);
  expect(result.trend.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(3200);
  expect(result.trend.find((item) => item.date === '2026-09-05')?.topCategory).toBe('shopping');
  expect(result.merchants[0]).toMatchObject({ amountMinor: 3200, count: 2, averageMinor: 1600 });
});
test('empty periods remain zero-filled without NaN, Infinity or fabricated comparisons', () => {
  const result = aggregateAnalytics([], analyticsPeriod({ period: 'month' }, now));
  expect(result.trend).toHaveLength(15);
  expect(result.spendingMinor).toBe(0);
  expect(result.averageTransactionMinor).toBe(0);
  expect(result.spendingChangePercent).toBeNull();
  expect(changePercent(0, 100)).toBe(-100);
  expect(changePercent(100, 100)).toBe(0);
});
test('linked refunds follow category edits even when the original purchase is outside the range', () => {
  const refund = transaction({
    kind: 'refund',
    direction: 'credit',
    category: 'shopping',
    cardPayment: {
      status: 'REFUNDED',
      transactions: [{ id: 'original', category: 'dining', direction: 'debit' }],
    },
  });
  expect(classifyActivity(refund)).toMatchObject({
    category: 'dining',
    direction: 'spending',
    amountMinor: -1000,
  });
  expect(reportingConverter(rates, 'EUR')(-1000, 'USD')).toBe(-910);
});
test.each(['REVERSED', 'DECLINED', 'AUTHORIZED', 'PENDING'])(
  'card lifecycle %s excludes otherwise settled history',
  (status) => {
    expect(classifyActivity(transaction({ cardPayment: { status, transactions: [] } }))).toBeNull();
  },
);
test('transfers stay separate from merchant rankings and only their fee enters cash flow', () => {
  const items = reportActivities(
    [
      transaction({
        kind: 'transfer',
        amountMinor: 10050,
        transfer: { kind: 'send', feeMinor: 50 },
      }),
      transaction({ kind: 'transfer', direction: 'credit', amountMinor: 3000 }),
    ],
    rates,
    'USD',
  );
  expect(aggregateAnalytics(items, analyticsPeriod({ period: 'month' }, now))).toMatchObject({
    spendingMinor: 50,
    incomeMinor: 0,
    netCashFlowMinor: -50,
    transfersOutMinor: 10000,
    transfersInMinor: 3000,
    merchants: [],
  });
});
test('large portfolio values preserve integer totals and chart output stays bounded', () => {
  const rows = Array.from({ length: 10000 }, (_, index) =>
    transaction({ id: String(index), amountMinor: 1000000, currency: 'GBP' }),
  );
  const start = performance.now();
  const result = aggregateAnalytics(
    reportActivities(rows, rates, 'AED'),
    analyticsPeriod({ period: 'year' }, now),
  );
  expect(result.spendingMinor).toBe(10000 * reportingConverter(rates, 'AED')(1000000, 'GBP'));
  expect(Number.isSafeInteger(result.spendingMinor)).toBe(true);
  expect(result.trend.length).toBeLessThanOrEqual(12);
  expect(performance.now() - start).toBeLessThan(2000);
});
