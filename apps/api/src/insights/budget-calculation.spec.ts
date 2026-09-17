import { budgetUsage } from './budget-calculation';

const month = new Date('2026-09-01T00:00:00Z');
const today = new Date('2026-09-16T12:00:00Z');
test.each([
  [0, 'WITHIN'],
  [7999, 'WITHIN'],
  [8000, 'NEAR'],
  [9999, 'NEAR'],
  [10000, 'AT_LIMIT'],
  [10001, 'OVER'],
  [-2500, 'WITHIN'],
])('budget spending %i preserves the exact threshold %s', (spent, status) => {
  const result = budgetUsage(10000, spent, true, month, today);
  expect(result.status).toBe(status);
  expect(result.remainingMinor).toBe(10000 - spent);
});
test('a rounded displayed 80% does not trigger the near-limit status early', () => {
  expect(budgetUsage(10000, 7999, true, month, today)).toMatchObject({
    usagePercent: 80,
    status: 'WITHIN',
  });
});
test('pace includes today and rounds projection once, with whole-cent daily allowance', () => {
  expect(budgetUsage(10000, 6400, true, month, today)).toMatchObject({
    projectedMinor: 12000,
    projectedOverMinor: 2000,
    daysRemaining: 15,
    dailyAllowanceMinor: 240,
  });
});
test('refunds can produce negative usage while the forecast stays zero', () => {
  expect(budgetUsage(10000, -2500, true, month, today)).toMatchObject({
    usagePercent: -25,
    remainingMinor: 12500,
    projectedMinor: 0,
    projectedOverMinor: 0,
    dailyAllowanceMinor: 833,
  });
});
test('disabled, zero-spend and large valid targets remain finite and exact', () => {
  const disabled = budgetUsage(10000, 11000, false, month, today);
  expect(disabled.status).toBe('DISABLED');
  expect(disabled.dailyAllowanceMinor).toBe(0);
  expect(budgetUsage(100000000, 0, true, month, today)).toMatchObject({
    projectedMinor: 0,
    usagePercent: 0,
    remainingMinor: 100000000,
  });
  expect(budgetUsage(100000000, 16000000, true, month, today).projectedMinor).toBe(30000000);
});
test('leap February, first day, last day and completed months use UTC calendar days', () => {
  const leap = new Date('2024-02-01T00:00:00Z');
  expect(budgetUsage(10000, 100, true, leap, leap)).toMatchObject({
    projectedMinor: 2900,
    daysRemaining: 29,
  });
  expect(budgetUsage(10000, 2900, true, leap, new Date('2024-02-29T23:59:59Z'))).toMatchObject({
    projectedMinor: 2900,
    daysRemaining: 1,
  });
  expect(budgetUsage(10000, 2900, true, leap, today)).toMatchObject({
    projectedMinor: 2900,
    daysRemaining: 0,
    dailyAllowanceMinor: 0,
  });
});
