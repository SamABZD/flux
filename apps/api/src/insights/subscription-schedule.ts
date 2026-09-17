import type { SubscriptionCadence } from '../generated/prisma/client';
import { addDays, DAY_MS, monthStart, utcDay } from './analytics-period';

export function occurrence(anchor: Date, cadence: SubscriptionCadence, index: number) {
  if (cadence === 'WEEKLY') return addDays(anchor, index * 7);
  const month = monthStart(anchor, index * (cadence === 'YEARLY' ? 12 : 1));
  const lastDay = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(anchor.getUTCDate(), lastDay)),
  );
}
export function nextOccurrence(anchor: Date, cadence: SubscriptionCadence, now: Date) {
  const today = utcDay(now);
  if (anchor >= today) return anchor;
  const index =
    cadence === 'WEEKLY'
      ? Math.max(0, Math.floor((today.getTime() - anchor.getTime()) / DAY_MS / 7))
      : Math.max(
          0,
          Math.floor(
            ((today.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
              today.getUTCMonth() -
              anchor.getUTCMonth()) /
              (cadence === 'YEARLY' ? 12 : 1),
          ),
        );
  let next = occurrence(anchor, cadence, index);
  if (next < today) next = occurrence(anchor, cadence, index + 1);
  return next;
}
export function scheduledDates(anchor: Date, cadence: SubscriptionCadence, start: Date, end: Date) {
  const dates: Date[] = [];
  let next = nextOccurrence(anchor, cadence, start);
  while (next < end && dates.length < 60) {
    dates.push(next);
    next = nextOccurrence(anchor, cadence, addDays(next, 1));
  }
  return dates;
}
export function nextUnpaidOccurrence(
  anchor: Date,
  cadence: SubscriptionCadence,
  now: Date,
  lastPaidAt?: Date,
) {
  const start =
    lastPaidAt && utcDay(lastPaidAt) >= utcDay(now) ? addDays(utcDay(lastPaidAt), 1) : now;
  return nextOccurrence(anchor, cadence, start);
}
export function monthlyEquivalent(amount: number, cadence: SubscriptionCadence) {
  const numerator = BigInt(amount) * (cadence === 'WEEKLY' ? 52n : 1n),
    denominator = cadence === 'MONTHLY' ? 1n : 12n;
  return Number((numerator + denominator / 2n) / denominator);
}
export interface RecurringEvidence {
  id: string;
  accountId: string;
  merchantId: string;
  amountMinor: number;
  timestamp: Date;
}
export function detectSchedule(rows: RecurringEvidence[], now: Date) {
  const dates = [...rows]
    .filter((row) => row.timestamp <= now)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const unique = dates
    .filter(
      (row, index) =>
        index === 0 ||
        utcDay(row.timestamp).getTime() !== utcDay(dates[index - 1]!.timestamp).getTime(),
    )
    .slice(0, 6);
  if (unique.length < 3) return null;
  const latest = unique[0]!;
  const gaps = unique
    .slice(0, -1)
    .map(
      (row, index) =>
        (utcDay(row.timestamp).getTime() - utcDay(unique[index + 1]!.timestamp).getTime()) / DAY_MS,
    );
  const cadence: SubscriptionCadence | null = gaps.every((days) => days >= 6 && days <= 8)
    ? 'WEEKLY'
    : gaps.every((days) => (days >= 25 && days <= 35) || (days >= 50 && days <= 70)) &&
        gaps.filter((days) => days >= 25 && days <= 35).length >= 2 &&
        gaps.filter((days) => days > 35).length <= 1
      ? 'MONTHLY'
      : gaps.every((days) => days >= 350 && days <= 380)
        ? 'YEARLY'
        : null;
  if (
    !cadence ||
    unique.some((row) => Math.abs(row.amountMinor - latest.amountMinor) / latest.amountMinor > 0.2)
  )
    return null;
  const age = (utcDay(now).getTime() - utcDay(latest.timestamp).getTime()) / DAY_MS;
  if (age > (cadence === 'WEEKLY' ? 21 : cadence === 'MONTHLY' ? 75 : 400)) return null;
  return {
    cadence,
    amountMinor: latest.amountMinor,
    anchorDate: utcDay(latest.timestamp),
    evidenceIds: unique.map((row) => row.id),
    lastPaidAt: latest.timestamp,
  };
}
