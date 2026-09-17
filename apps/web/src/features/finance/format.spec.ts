import {
  accessibleAmount,
  formatMoney,
  formatDate,
  transactionAmount,
  transactionReturnPath,
} from './format';
import { activeFilterCount, defaultFilters, filterParams, readFilters } from './filters';

test('formats cents across all four currencies', () => {
  expect(formatMoney(482040, 'USD')).toBe('$4,820.40');
  expect(formatMoney(284012, 'EUR')).toBe('€2,840.12');
  expect(formatMoney(142082, 'GBP')).toBe('£1,420.82');
  expect(formatMoney(794000, 'AED').replace(/\s/g, ' ')).toBe('AED 7,940.00');
  expect(formatMoney(1, 'USD')).toBe('$0.01');
});
test('shows directions and distinguishes failed or pending from settled amounts', () => {
  const base = {
    currency: 'USD' as const,
    amountMinor: 2240,
    direction: 'debit' as const,
    status: 'completed' as const,
  };
  expect(transactionAmount(base)).toBe('−$22.40');
  expect(transactionAmount({ ...base, direction: 'credit' })).toBe('+$22.40');
  expect(accessibleAmount({ ...base, status: 'failed' })).toMatch(/^Failed payment/);
  expect(accessibleAmount({ ...base, status: 'pending' })).toMatch(/^Pending payment/);
  expect(accessibleAmount({ ...base, direction: 'credit' })).toMatch(/^Received/);
});
test('formats an instant consistently in UTC', () => {
  expect(formatDate('2026-09-14T10:42:00Z', true)).toContain('10:42');
});
test('round-trips combined URL filters and page', () => {
  const filters = {
    ...defaultFilters,
    account: 'eur',
    search: 'Weekly essentials',
    category: 'groceries' as const,
    direction: 'debit' as const,
    status: 'completed' as const,
    dateFrom: '2026-08-01',
    dateTo: '2026-09-14',
    page: 3,
  };
  expect(readFilters(filterParams(filters))).toEqual(filters);
  expect(activeFilterCount(filters)).toBe(6);
});
test('normalizes malformed URLs without trusting invalid enum or date values', () => {
  expect(
    readFilters(
      new URLSearchParams(
        'page=-1&category=unknown&status=bad&direction=sideways&dateFrom=2026-02-30',
      ),
    ),
  ).toEqual(defaultFilters);
  expect(filterParams(defaultFilters).toString()).toBe('');
});
test('return links preserve context but cannot leave the app', () => {
  expect(transactionReturnPath('/transactions?account=eur&search=roadster')).toBe(
    '/transactions?account=eur&search=roadster',
  );
  expect(transactionReturnPath('/accounts/usd')).toBe('/accounts/usd');
  expect(transactionReturnPath('/analytics/categories/dining?period=year&baseCurrency=EUR')).toBe(
    '/analytics/categories/dining?period=year&baseCurrency=EUR',
  );
  expect(transactionReturnPath('/subscriptions/subscription-netflix?baseCurrency=USD')).toBe(
    '/subscriptions/subscription-netflix?baseCurrency=USD',
  );
  for (const value of ['https://example.com', '//example.com', '/transactions/../login', null])
    expect(transactionReturnPath(value)).toBe('/transactions');
});
