import { ServiceUnavailableException } from '@nestjs/common';
import type { Currency, Prisma, TransactionCategory } from '../generated/prisma/client';
import { toTransaction } from '../finance/finance-mappers';
import { convertMinor } from '../transfers/money';
import { addDays, dateKey, monthStart } from './analytics-period';
import type { AnalyticsRange } from './analytics-period';

export type InsightTransaction = Prisma.TransactionGetPayload<{
  include: { merchant: true; account: true; transfer: { select: { kind: true; feeMinor: true } } };
}> & {
  cardPayment?: {
    status: string;
    transactions: { id: string; category: TransactionCategory; direction: string }[];
  } | null;
};
export type RateSnapshot = { currency: Currency; usdMicros: number; updatedAt: Date }[];
export function reportingConverter(rates: RateSnapshot, base: Currency) {
  const table = new Map(rates.map((rate) => [rate.currency, rate.usdMicros]));
  const to = table.get(base);
  if (!to || rates.length !== 4 || rates.some((rate) => rate.usdMicros <= 0))
    throw new ServiceUnavailableException(
      'Reporting rates are unavailable. Try again in a moment.',
    );
  return (amount: number, currency: Currency) => {
    const from = table.get(currency);
    if (!from) throw new ServiceUnavailableException('A reporting rate is unavailable.');
    return Math.sign(amount) * convertMinor(Math.abs(amount), from, to, Number.MAX_SAFE_INTEGER);
  };
}
export function classifyActivity(transaction: InsightTransaction) {
  if (transaction.status !== 'completed' && transaction.status !== 'refunded') return null;
  if (
    transaction.cardPayment &&
    !['COMPLETED', 'REFUNDED'].includes(transaction.cardPayment.status)
  )
    return null;
  if (transaction.transfer?.kind === 'exchange') {
    if (transaction.direction === 'credit' || !transaction.transfer.feeMinor) return null;
    return {
      direction: 'spending' as const,
      category: 'other' as const,
      amountMinor: transaction.transfer.feeMinor,
      incomeSource: null,
      feeOnly: true,
    };
  }
  if (transaction.kind === 'transfer') {
    return {
      direction:
        transaction.direction === 'debit' ? ('transfer-out' as const) : ('transfer-in' as const),
      category: 'transfers' as const,
      amountMinor:
        transaction.amountMinor -
        (transaction.direction === 'debit' ? (transaction.transfer?.feeMinor ?? 0) : 0),
      incomeSource: null,
      feeOnly: false,
    };
  }
  if (transaction.kind === 'refund' && transaction.direction === 'credit') {
    const purchase = transaction.cardPayment?.transactions.find((row) => row.direction === 'debit');
    return {
      direction: 'spending' as const,
      category: purchase?.category ?? transaction.category,
      amountMinor: -transaction.amountMinor,
      incomeSource: null,
      feeOnly: false,
    };
  }
  if (transaction.direction === 'credit')
    return {
      direction: 'income' as const,
      category: transaction.category,
      amountMinor: transaction.amountMinor,
      incomeSource: 'income',
      feeOnly: false,
    };
  return {
    direction: 'spending' as const,
    category: transaction.category,
    amountMinor: transaction.amountMinor,
    incomeSource: null,
    feeOnly: false,
  };
}
export type ReportActivity = NonNullable<ReturnType<typeof classifyActivity>> & {
  transaction: InsightTransaction;
  reportingAmountMinor: number;
};
export function reportActivities(
  transactions: InsightTransaction[],
  rates: RateSnapshot,
  base: Currency,
): ReportActivity[] {
  const convert = reportingConverter(rates, base);
  return transactions.flatMap((transaction) => {
    const activity = classifyActivity(transaction);
    const rows: ReportActivity[] = activity
      ? [
          {
            ...activity,
            transaction,
            reportingAmountMinor: convert(activity.amountMinor, transaction.currency),
          },
        ]
      : [];
    if (activity?.direction === 'transfer-out' && transaction.transfer?.feeMinor) {
      rows.push({
        direction: 'spending',
        category: 'other',
        amountMinor: transaction.transfer.feeMinor,
        incomeSource: null,
        feeOnly: true,
        transaction,
        reportingAmountMinor: convert(transaction.transfer.feeMinor, transaction.currency),
      });
    }
    return rows;
  });
}
export function total(items: ReportActivity[]) {
  const value = items.reduce((sum, item) => sum + BigInt(item.reportingAmountMinor), 0n);
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER))
    throw new ServiceUnavailableException('This reporting total exceeds the supported range.');
  return Number(value);
}
export const changePercent = (current: number, previous: number) =>
  previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
export function grouped<T extends string>(
  items: ReportActivity[],
  getKey: (item: ReportActivity) => T,
) {
  const groups = new Map<T, ReportActivity[]>();
  for (const item of items) {
    const key = getKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups]
    .map(([id, rows]) => ({ id, amountMinor: total(rows), count: rows.length, rows }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.id.localeCompare(b.id));
}
export function trend(items: ReportActivity[], start: Date, end: Date, bucket: 'day' | 'month') {
  const points = new Map<
    string,
    { date: string; amountMinor: number; topCategory: TransactionCategory | null }
  >();
  for (
    let cursor = new Date(start);
    cursor < end;
    cursor = bucket === 'month' ? monthStart(cursor, 1) : addDays(cursor, 1)
  ) {
    const key = dateKey(bucket === 'month' ? monthStart(cursor) : cursor);
    points.set(key, { date: key, amountMinor: 0, topCategory: null });
  }
  const byDate = grouped(items, (item) =>
    dateKey(
      bucket === 'month' ? monthStart(item.transaction.timestamp) : item.transaction.timestamp,
    ),
  );
  for (const group of byDate) {
    const point = points.get(group.id);
    if (point) {
      point.amountMinor = group.amountMinor;
      point.topCategory = grouped(group.rows, (item) => item.category)[0]?.id ?? null;
    }
  }
  return [...points.values()];
}
export function aggregateAnalytics(items: ReportActivity[], range: AnalyticsRange) {
  const inRange = (start: Date, end: Date) =>
    items.filter((item) => item.transaction.timestamp >= start && item.transaction.timestamp < end);
  const current = inRange(range.start, range.end),
    previous = inRange(range.previousStart, range.previousEnd);
  const spending = current.filter((item) => item.direction === 'spending'),
    income = current.filter((item) => item.direction === 'income');
  const priorSpending = previous.filter((item) => item.direction === 'spending'),
    priorIncome = previous.filter((item) => item.direction === 'income');
  const spendingMinor = total(spending),
    incomeMinor = total(income),
    previousSpendingMinor = total(priorSpending),
    previousIncomeMinor = total(priorIncome);
  const priorCategories = new Map(
    grouped(priorSpending, (item) => item.category).map((group) => [group.id, group.amountMinor]),
  );
  const categoryGroups = grouped(spending, (item) => item.category);
  const positiveCategoryTotal = categoryGroups.reduce(
    (sum, group) => sum + Math.max(0, group.amountMinor),
    0,
  );
  const paymentCount = spending.filter((item) => item.amountMinor > 0).length;
  return {
    spendingMinor,
    previousSpendingMinor,
    spendingChangePercent: changePercent(spendingMinor, previousSpendingMinor),
    incomeMinor,
    previousIncomeMinor,
    incomeChangePercent: changePercent(incomeMinor, previousIncomeMinor),
    netCashFlowMinor: incomeMinor - spendingMinor,
    previousNetCashFlowMinor: previousIncomeMinor - previousSpendingMinor,
    transfersOutMinor: total(current.filter((item) => item.direction === 'transfer-out')),
    transfersInMinor: total(current.filter((item) => item.direction === 'transfer-in')),
    transactionCount: paymentCount,
    averageTransactionMinor: paymentCount ? Math.round(spendingMinor / paymentCount) : 0,
    trend: trend(spending, range.start, range.end, range.bucket),
    previousTrend: trend(priorSpending, range.previousStart, range.previousEnd, range.bucket),
    categories: categoryGroups.map((group) => ({
      category: group.id,
      amountMinor: group.amountMinor,
      count: group.count,
      sharePercent: positiveCategoryTotal
        ? Math.round((Math.max(0, group.amountMinor) / positiveCategoryTotal) * 1000) / 10
        : 0,
      previousMinor: priorCategories.get(group.id) ?? 0,
    })),
    merchants: grouped(
      spending.filter((item) => !item.feeOnly),
      (item) => item.transaction.merchantId,
    )
      .slice(0, 10)
      .map((group) => ({
        merchant: group.rows[0]!.transaction.merchant,
        amountMinor: group.amountMinor,
        count: group.rows.filter((item) => item.amountMinor > 0).length,
        averageMinor: group.rows.some((item) => item.amountMinor > 0)
          ? Math.round(group.amountMinor / group.rows.filter((item) => item.amountMinor > 0).length)
          : 0,
      })),
    incomeSources: grouped(income, (item) => item.incomeSource ?? 'income').map((group) => ({
      source: group.id,
      amountMinor: group.amountMinor,
      count: group.count,
    })),
    incomeMerchants: grouped(income, (item) => item.transaction.merchantId)
      .slice(0, 5)
      .map((group) => ({
        merchant: group.rows[0]!.transaction.merchant,
        amountMinor: group.amountMinor,
        count: group.count,
      })),
  };
}
export const toInsightTransaction = (item: ReportActivity) => ({
  transaction: toTransaction(item.transaction),
  reportingAmountMinor: item.reportingAmountMinor,
  feeOnly: item.feeOnly,
});
