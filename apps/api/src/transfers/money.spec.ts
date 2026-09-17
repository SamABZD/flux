import { availableMinor, calculateQuote, quoteExpired } from './money';
import { transferFingerprint } from './transfers.service';

test('converts with exact integer rounding and charges the fee in source currency', () => {
  expect(calculateQuote(50000, 1000000, 1100000)).toEqual({
    sourceAmountMinor: 55000,
    destinationAmountMinor: 50000,
    feeMinor: 220,
    totalDebitMinor: 55220,
    rateLabel: '0.909090',
  });
  expect(calculateQuote(1, 1000000, 1100000)).toMatchObject({
    sourceAmountMinor: 2,
    feeMinor: 50,
    totalDebitMinor: 52,
  });
  expect(calculateQuote(100, 272294, 1300000)).toMatchObject({
    sourceAmountMinor: 478,
    feeMinor: 184,
    totalDebitMinor: 662,
  });
});
test('minimum fees and very large amounts remain integer-safe', () => {
  for (const from of [1000000, 1100000, 1300000, 272294])
    for (const to of [1000000, 1100000, 1300000, 272294]) {
      const quote = calculateQuote(100000000, from, to);
      expect(Number.isSafeInteger(quote.totalDebitMinor)).toBe(true);
      expect(BigInt(quote.sourceAmountMinor) * BigInt(from)).toBeGreaterThanOrEqual(
        100000000n * BigInt(to),
      );
      expect(BigInt(quote.sourceAmountMinor - 1) * BigInt(from)).toBeLessThan(
        100000000n * BigInt(to),
      );
      expect(quote.totalDebitMinor).toBe(quote.sourceAmountMinor + quote.feeMinor);
    }
});
test.each([0, -1, 1.5, NaN, Infinity, 100000001])('rejects invalid amount %s', (amount) => {
  expect(() => calculateQuote(amount, 1000000, 1100000)).toThrow();
});
test('rejects unknown rates', () => {
  expect(() => calculateQuote(100, 0, 1)).toThrow();
});
test('expiration is inclusive and funds use available balance', () => {
  const end = new Date('2026-09-14T12:00:00Z');
  expect(quoteExpired(end, new Date(end.getTime() - 1))).toBe(false);
  expect(quoteExpired(end, end)).toBe(true);
  expect(availableMinor(58800, 249)).toBe(58551);
});
test('fingerprint is stable and detects changes to exact request intent', () => {
  const body = { quoteId: 'quote', sourceAccountId: 'usd', recipientId: 'maya', note: 'Dinner' };
  expect(transferFingerprint(body)).toBe(transferFingerprint({ ...body }));
  expect(transferFingerprint(body)).not.toBe(transferFingerprint({ ...body, note: 'Rent' }));
});
