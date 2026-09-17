import { monthStart } from './analytics-period';

export function budgetUsage(
  amountMinor: number,
  spentMinor: number,
  enabled: boolean,
  month: Date,
  now: Date,
) {
  const daysInMonth = new Date(monthStart(month, 1).getTime() - 1).getUTCDate();
  const currentMonth = monthStart(month).getTime() === monthStart(now).getTime();
  const daysRemaining = currentMonth ? daysInMonth - now.getUTCDate() + 1 : 0;
  const daysElapsed = currentMonth ? now.getUTCDate() : daysInMonth;
  const remainingMinor = amountMinor - spentMinor;
  const projectedMinor = Math.round((Math.max(0, spentMinor) * daysInMonth) / daysElapsed);
  const usagePercent = Math.round((spentMinor / amountMinor) * 1000) / 10;
  return {
    spentMinor,
    remainingMinor,
    usagePercent,
    projectedMinor,
    projectedOverMinor: Math.max(0, projectedMinor - amountMinor),
    daysRemaining,
    dailyAllowanceMinor: daysRemaining
      ? Math.floor(Math.max(0, remainingMinor) / daysRemaining)
      : 0,
    status: !enabled
      ? ('DISABLED' as const)
      : spentMinor > amountMinor
        ? ('OVER' as const)
        : spentMinor === amountMinor
          ? ('AT_LIMIT' as const)
          : spentMinor >= amountMinor * 0.8
            ? ('NEAR' as const)
            : ('WITHIN' as const),
  };
}
