import {
  detectSchedule,
  monthlyEquivalent,
  nextOccurrence,
  nextUnpaidOccurrence,
  occurrence,
  scheduledDates,
} from './subscription-schedule';
import { dateKey } from './analytics-period';
const day = (value: string) => new Date(value + 'T00:00:00Z');
test('a payment settled today advances the forecast without shifting its original calendar anchor', () => {
  expect(
    dateKey(
      nextUnpaidOccurrence(day('2026-01-31'), 'MONTHLY', day('2026-02-28'), day('2026-02-28')),
    ),
  ).toBe('2026-03-31');
  expect(
    dateKey(
      nextUnpaidOccurrence(day('2026-09-16'), 'WEEKLY', day('2026-09-16'), day('2026-09-16')),
    ),
  ).toBe('2026-09-23');
  expect(dateKey(nextUnpaidOccurrence(day('2026-09-16'), 'MONTHLY', day('2026-09-16')))).toBe(
    '2026-09-16',
  );
});
test('month-end schedules keep their original anchor after short months', () => {
  const anchor = day('2025-01-31');
  expect([0, 1, 2, 3].map((index) => dateKey(occurrence(anchor, 'MONTHLY', index)))).toEqual([
    '2025-01-31',
    '2025-02-28',
    '2025-03-31',
    '2025-04-30',
  ]);
  expect(dateKey(nextOccurrence(anchor, 'MONTHLY', day('2025-02-28')))).toBe('2025-02-28');
  expect(dateKey(nextOccurrence(anchor, 'MONTHLY', day('2025-03-01')))).toBe('2025-03-31');
});
test('yearly leap-day schedule restores February 29 in the next leap year', () => {
  const anchor = day('2024-02-29');
  expect(dateKey(occurrence(anchor, 'YEARLY', 1))).toBe('2025-02-28');
  expect(dateKey(occurrence(anchor, 'YEARLY', 4))).toBe('2028-02-29');
});
test('weekly forecasts include every occurrence inside the half-open 30-day range', () => {
  expect(
    scheduledDates(day('2026-09-01'), 'WEEKLY', day('2026-09-01'), day('2026-10-01')).map(dateKey),
  ).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
  expect(
    scheduledDates(day('2026-10-01'), 'MONTHLY', day('2026-09-01'), day('2026-10-01')),
  ).toEqual([]);
});
test('normalizes weekly, monthly and annual estimates with safe minor-unit rounding', () => {
  expect(monthlyEquivalent(12000, 'YEARLY')).toBe(1000);
  expect(monthlyEquivalent(1000, 'WEEKLY')).toBe(4333);
  expect(monthlyEquivalent(1099, 'MONTHLY')).toBe(1099);
});
const rows = (dates: string[], amounts = dates.map(() => 1099)) =>
  dates.map((date, index) => ({
    id: String(index),
    accountId: 'usd',
    merchantId: 'spotify',
    amountMinor: amounts[index]!,
    timestamp: day(date),
  }));
test('requires three recent similarly priced regular payments and returns their evidence IDs', () => {
  expect(
    detectSchedule(rows(['2026-07-04', '2026-08-04', '2026-09-04']), day('2026-09-15')),
  ).toMatchObject({ cadence: 'MONTHLY', amountMinor: 1099, evidenceIds: ['2', '1', '0'] });
  expect(detectSchedule(rows(['2026-08-04', '2026-09-04']), day('2026-09-15'))).toBeNull();
  expect(
    detectSchedule(
      rows(['2026-07-04', '2026-08-04', '2026-09-04'], [1099, 3000, 1099]),
      day('2026-09-15'),
    ),
  ).toBeNull();
});
test('rejects duplicate-day, irregular, stale and future-only evidence', () => {
  for (const dates of [
    ['2026-09-04', '2026-09-04', '2026-09-04'],
    ['2026-07-01', '2026-08-16', '2026-09-04'],
    ['2026-01-04', '2026-02-04', '2026-03-04'],
    ['2027-01-04', '2027-02-04', '2027-03-04'],
  ])
    expect(detectSchedule(rows(dates), day('2026-09-15'))).toBeNull();
});
test('detects yearly payments and tolerates a modest monthly price change', () => {
  expect(
    detectSchedule(rows(['2024-07-04', '2025-07-04', '2026-07-04']), day('2026-09-15')),
  ).toMatchObject({ cadence: 'YEARLY' });
  expect(
    detectSchedule(
      rows(['2026-07-04', '2026-08-04', '2026-09-04'], [1000, 1050, 1100]),
      day('2026-09-15'),
    ),
  ).toMatchObject({ cadence: 'MONTHLY', amountMinor: 1100 });
});
test('one missed month needs at least two normal intervals; repeated skipped months are not monthly evidence', () => {
  expect(
    detectSchedule(
      rows(['2026-05-04', '2026-06-04', '2026-08-04', '2026-09-04']),
      day('2026-09-15'),
    ),
  ).toMatchObject({ cadence: 'MONTHLY' });
  expect(
    detectSchedule(rows(['2026-05-04', '2026-07-04', '2026-09-04']), day('2026-09-15')),
  ).toBeNull();
});
