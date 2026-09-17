import { BadRequestException } from '@nestjs/common';
import { TransactionQueryDto } from './finance.dto';
import { transactionWhere, DEMO_USER_ID } from './transaction-query';
import { equivalentUsdMinor } from './finance-mappers';

describe('finance query boundaries', () => {
  test('combines filters while retaining user scope', () => {
    const query = Object.assign(new TransactionQueryDto(), {
      account: 'usd',
      category: 'dining',
      status: 'completed',
      direction: 'debit',
      merchant: 'roadster',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-14',
      search: 'ROADSTER',
    });
    expect(transactionWhere(query)).toMatchObject({
      account: { userId: DEMO_USER_ID },
      accountId: 'usd',
      category: 'dining',
      status: 'completed',
      direction: 'debit',
      merchantId: 'roadster',
      timestamp: { gte: new Date('2026-09-01T00:00:00Z'), lt: new Date('2026-09-15T00:00:00Z') },
    });
    expect(transactionWhere(query).OR).toContainEqual({
      merchant: { name: { contains: 'ROADSTER', mode: 'insensitive' } },
    });
  });
  test('search recognizes category names and ignores surrounding whitespace', () => {
    expect(
      transactionWhere(Object.assign(new TransactionQueryDto(), { search: '  DINING  ' })).OR,
    ).toContainEqual({ category: { in: ['dining'] } });
  });
  test('rejects reversed date ranges', () => {
    expect(() =>
      transactionWhere(
        Object.assign(new TransactionQueryDto(), { dateFrom: '2026-09-14', dateTo: '2026-09-01' }),
      ),
    ).toThrow(BadRequestException);
  });
  test('empty search does not add unnecessary conditions', () => {
    expect(transactionWhere(Object.assign(new TransactionQueryDto(), { search: '  ' }))).toEqual({
      account: { userId: DEMO_USER_ID },
    });
  });
  test('converts each account to cents before adding different currencies', () => {
    expect(
      equivalentUsdMinor([
        { currency: 'USD', balanceMinor: 482040 },
        { currency: 'EUR', balanceMinor: 284012 },
        { currency: 'GBP', balanceMinor: 142082 },
        { currency: 'AED', balanceMinor: 794000 },
      ]),
    ).toBe(1195361);
    expect(equivalentUsdMinor([{ currency: 'AED', balanceMinor: 2 }])).toBe(1);
    expect(equivalentUsdMinor([])).toBe(0);
    expect(equivalentUsdMinor([{ currency: 'USD', balanceMinor: -1 }])).toBe(-1);
  });
});
