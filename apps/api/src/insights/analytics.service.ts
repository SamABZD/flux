import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { analyticsPeriod, addDays, dateKey } from './analytics-period';
import { aggregateAnalytics, reportActivities, toInsightTransaction } from './analytics-model';
import type { AnalyticsQueryDto } from './insights.dto';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async snapshot(userId: string, query: AnalyticsQueryDto, now = new Date()) {
    return this.prisma.$transaction((tx) => this.read(tx, userId, query, now), {
      isolationLevel: 'RepeatableRead',
    });
  }
  async read(tx: Prisma.TransactionClient, userId: string, query: AnalyticsQueryDto, now: Date) {
    const range = analyticsPeriod(query, now);
    const accounts = await tx.account.findMany({
      where: { userId },
      select: { id: true, name: true, currency: true },
      orderBy: { id: 'asc' },
    });
    if (query.accountId && !accounts.some((account) => account.id === query.accountId))
      throw new NotFoundException('Account not found.');
    const rates = await tx.fxRate.findMany({ orderBy: { currency: 'asc' } });
    const selectedMerchant = query.merchantId
      ? await tx.merchant.findFirst({
          where: { id: query.merchantId, transactions: { some: { account: { userId } } } },
        })
      : null;
    if (query.merchantId && !selectedMerchant)
      throw new NotFoundException('Merchant not found in your transaction history.');
    const transactions = await tx.transaction.findMany({
      where: {
        account: { userId },
        ...(query.accountId ? { accountId: query.accountId } : {}),
        status: { in: ['completed', 'refunded'] },
        timestamp: { gte: range.previousStart, lt: range.end, lte: now },
      },
      include: {
        merchant: true,
        account: true,
        transfer: { select: { kind: true, feeMinor: true } },
        cardPayment: {
          select: {
            status: true,
            transactions: { select: { id: true, category: true, direction: true } },
          },
        },
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    });
    return {
      range,
      rates,
      accounts,
      selectedMerchant,
      items: reportActivities(transactions, rates, query.baseCurrency),
      now,
    };
  }
  async summary(userId: string, query: AnalyticsQueryDto) {
    const snapshot = await this.snapshot(userId, query);
    const { range, rates, accounts, items, now } = snapshot;
    const filtered = items.filter(
      (item) =>
        (!query.category || item.category === query.category) &&
        (!query.merchantId || item.transaction.merchantId === query.merchantId),
    );
    const current = filtered.filter(
      (item) =>
        item.transaction.timestamp >= range.start &&
        item.transaction.timestamp < range.end &&
        item.direction === query.direction,
    );
    return {
      asOf: now.toISOString(),
      baseCurrency: query.baseCurrency,
      accountId: query.accountId ?? null,
      accounts,
      selectedMerchant: snapshot.selectedMerchant,
      period: query.dateFrom ? 'custom' : query.period,
      range: {
        dateFrom: dateKey(range.start),
        dateTo: dateKey(addDays(range.end, -1)),
        previousFrom: dateKey(range.previousStart),
        previousTo: dateKey(addDays(range.previousEnd, -1)),
        bucket: range.bucket,
      },
      fx: {
        strategy:
          'Current illustrative rates for both periods; each transaction rounds up to the reporting minor unit.',
        rates: rates.map((rate) => ({ ...rate, updatedAt: rate.updatedAt.toISOString() })),
      },
      ...aggregateAnalytics(filtered, range),
      transactions: {
        items: current
          .slice((query.page - 1) * query.limit, query.page * query.limit)
          .map(toInsightTransaction),
        total: current.length,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(current.length / query.limit),
      },
    };
  }
}
