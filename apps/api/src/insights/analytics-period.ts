import { BadRequestException } from '@nestjs/common';
import type { AnalyticsQueryDto } from './insights.dto';

export const DAY_MS = 86400000;
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const utcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
export const monthStart = (date: Date, offset = 0) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
export function strictDate(value: string) {
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    dateKey(date) !== value
  )
    throw new BadRequestException('Use a valid calendar date in YYYY-MM-DD format.');
  return date;
}
export function analyticsPeriod(
  query: Pick<AnalyticsQueryDto, 'period' | 'dateFrom' | 'dateTo'>,
  now: Date,
) {
  const today = utcDay(now);
  let start: Date, end: Date, previousStart: Date, previousEnd: Date;
  if (query.dateFrom || query.dateTo) {
    if (!query.dateFrom || !query.dateTo)
      throw new BadRequestException('Choose both a start and end date.');
    start = strictDate(query.dateFrom);
    if (start.getUTCFullYear() < 2000)
      throw new BadRequestException('Choose a reporting date from 2000 onward.');
    end = addDays(strictDate(query.dateTo), 1);
    if (start >= end || (end.getTime() - start.getTime()) / DAY_MS > 366)
      throw new BadRequestException('Choose a range of 1 to 366 days.');
    if (end > addDays(today, 1))
      throw new BadRequestException('Analytics cannot include future dates.');
    previousEnd = start;
    previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
  } else {
    end = addDays(today, 1);
    if (query.period === 'week') {
      start = addDays(end, -7);
      previousEnd = start;
      previousStart = addDays(start, -7);
    } else {
      const months =
        query.period === 'quarter'
          ? 3
          : query.period === 'half-year'
            ? 6
            : query.period === 'year'
              ? 12
              : 1;
      start =
        query.period === 'year'
          ? new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
          : monthStart(today, 1 - months);
      previousStart = monthStart(start, -months);

      const lastMonth = monthStart(today, -months);
      const lastDay = new Date(
        Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 0),
      ).getUTCDate();
      previousEnd = addDays(
        new Date(
          Date.UTC(
            lastMonth.getUTCFullYear(),
            lastMonth.getUTCMonth(),
            Math.min(today.getUTCDate(), lastDay),
          ),
        ),
        1,
      );
    }
  }
  const days = (end.getTime() - start.getTime()) / DAY_MS;
  return {
    start,
    end,
    previousStart,
    previousEnd,
    bucket: days > 62 ? ('month' as const) : ('day' as const),
  };
}
export type AnalyticsRange = ReturnType<typeof analyticsPeriod>;
