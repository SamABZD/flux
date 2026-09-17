import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { OperationError } from '../common/operation-error';
import { fingerprint, lockRequest, verifyReplay } from '../common/idempotency';
import { AnalyticsService } from './analytics.service';
import { addDays, dateKey, monthStart, strictDate, utcDay } from './analytics-period';
import { reportingConverter, total } from './analytics-model';
import { AnalyticsQueryDto } from './insights.dto';
import type { CreateBudgetDto, EditBudgetDto, InsightMonthDto } from './insights.dto';
import { budgetUsage } from './budget-calculation';

export function budgetMonth(value: string | undefined, now: Date) {
  const start = value ? strictDate(value + '-01') : monthStart(now);
  if (start > monthStart(now) || start.getUTCFullYear() < 2000)
    throw new OperationError(
      'INVALID_MONTH',
      'Choose this month or an earlier month from 2000 onward.',
      400,
    );
  return start;
}
@Injectable()
export class BudgetsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}
  async list(userId: string, query: InsightMonthDto, now = new Date()) {
    const start = budgetMonth(query.month, now),
      nextMonth = monthStart(start, 1);
    const end = new Date(Math.min(nextMonth.getTime(), addDays(utcDay(now), 1).getTime()));
    const { snapshot, budgets } = await this.db.$transaction(
      async (tx) => {
        const snapshot = await this.analytics.read(
          tx,
          userId,
          Object.assign(new AnalyticsQueryDto(), {
            dateFrom: dateKey(start),
            dateTo: dateKey(addDays(end, -1)),
            baseCurrency: query.baseCurrency,
          }),
          now,
        );
        const budgets = await tx.budget.findMany({
          where: {
            userId,
            createdMonth: { lte: start },
            OR: [{ archivedAt: null }, { archivedAt: { gte: nextMonth } }],
          },
          include: {
            allocations: { where: { month: { lte: start } }, orderBy: { month: 'desc' }, take: 1 },
          },
          orderBy: { category: 'asc' },
        });
        return { snapshot, budgets };
      },
      { isolationLevel: 'RepeatableRead' },
    );
    const transactions = snapshot.items.filter(
      (item) =>
        item.transaction.timestamp >= start &&
        item.transaction.timestamp < end &&
        item.direction === 'spending',
    );
    const convertReport = reportingConverter(snapshot.rates, query.baseCurrency);
    const daysInMonth = new Date(nextMonth.getTime() - 1).getUTCDate();
    const daysRemaining =
      start.getTime() === monthStart(now).getTime() ? daysInMonth - now.getUTCDate() + 1 : 0;
    const items = budgets.flatMap((budget) => {
      const allocation = budget.allocations[0];
      if (!allocation) return [];
      const convert = reportingConverter(snapshot.rates, budget.currency);
      const rows = transactions.filter((item) => item.category === budget.category);
      const spentMinor = rows.reduce(
        (sum, item) => sum + convert(item.amountMinor, item.transaction.currency),
        0,
      );
      return [
        {
          id: budget.id,
          category: budget.category,
          currency: budget.currency,
          amountMinor: allocation.amountMinor,
          enabled: allocation.enabled,
          ...budgetUsage(allocation.amountMinor, spentMinor, allocation.enabled, start, now),
          revision: budget.revision,
          transactionCount: rows.filter((item) => item.amountMinor > 0).length,
          reportAmountMinor: allocation.enabled
            ? convertReport(allocation.amountMinor, budget.currency)
            : 0,
          reportSpentMinor: allocation.enabled ? total(rows) : 0,
        },
      ];
    });
    return {
      month: dateKey(start).slice(0, 7),
      baseCurrency: query.baseCurrency,
      editable: start.getTime() === monthStart(now).getTime(),
      items,
      totalPlannedMinor: items.reduce((sum, item) => sum + item.reportAmountMinor, 0),
      totalSpentMinor: items.reduce((sum, item) => sum + item.reportSpentMinor, 0),
      daysRemaining,
      fx: 'Current illustrative reporting rates. Refunds reduce category spending on the date credited; linked refunds follow the purchase’s current category. Transfers are excluded except for fees.',
    };
  }
  async create(userId: string, key: string, body: CreateBudgetDto, now = new Date()) {
    if (body.category === 'income')
      throw new OperationError('INVALID_CATEGORY', 'Choose an outgoing spending category.', 400);
    const requestHash = fingerprint({
      category: body.category,
      currency: body.currency,
      amountMinor: body.amountMinor,
    });
    try {
      return await this.db.$transaction(async (tx) => {
        await lockRequest(tx, userId, key, 'budget-create');
        const replay = await tx.budget.findUnique({
          where: { userId_createKey: { userId, createKey: key } },
        });
        if (replay) {
          verifyReplay(replay, requestHash);
          return { id: replay.id };
        }
        const budget = await tx.budget.create({
          data: {
            userId,
            category: body.category,
            currency: body.currency,
            createdMonth: monthStart(now),
            createKey: key,
            requestHash,
            allocations: { create: { month: monthStart(now), amountMinor: body.amountMinor } },
          },
        });
        return { id: budget.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new OperationError(
          'BUDGET_EXISTS',
          'You already have a budget for this category. Edit that budget instead.',
          409,
        );
      throw error;
    }
  }
  async edit(userId: string, id: string, body: EditBudgetDto, now = new Date()) {
    if (body.amountMinor === undefined && body.enabled === undefined)
      throw new OperationError('EMPTY_EDIT', 'Change the amount or enabled status.', 400);
    return this.db.$transaction(async (tx) => {
      const result = await tx.budget.updateMany({
        where: { id, userId, revision: body.revision, archivedAt: null },
        data: { revision: { increment: 1 } },
      });
      if (!result.count)
        throw new OperationError(
          'BUDGET_CHANGED',
          'This budget changed or is no longer available. Reload before editing.',
          409,
        );
      const prior = await tx.budgetAllocation.findFirstOrThrow({
        where: { budgetId: id, month: { lte: monthStart(now) } },
        orderBy: { month: 'desc' },
      });
      const amountMinor = body.amountMinor ?? prior.amountMinor;
      const enabled = body.enabled ?? prior.enabled;
      await tx.budgetAllocation.upsert({
        where: { budgetId_month: { budgetId: id, month: monthStart(now) } },
        create: { budgetId: id, month: monthStart(now), amountMinor, enabled },
        update: { amountMinor, enabled },
      });
      return { id };
    });
  }
  async archive(userId: string, id: string, revision: number, now = new Date()) {
    const result = await this.db.budget.updateMany({
      where: { id, userId, revision, archivedAt: null },
      data: { archivedAt: now, revision: { increment: 1 } },
    });
    if (!result.count)
      throw new OperationError(
        'BUDGET_CHANGED',
        'This budget changed or is no longer available. Reload before editing.',
        409,
      );
    return { id };
  }
}
