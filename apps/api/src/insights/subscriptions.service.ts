import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Currency } from '../generated/prisma/client';
import { OperationError } from '../common/operation-error';
import { fingerprint, lockRequest, verifyReplay } from '../common/idempotency';
import { toTransaction } from '../finance/finance-mappers';
import { dateKey, addDays, monthStart, strictDate, utcDay } from './analytics-period';
import { classifyActivity, reportingConverter } from './analytics-model';
import {
  detectSchedule,
  monthlyEquivalent,
  nextUnpaidOccurrence,
  scheduledDates,
} from './subscription-schedule';
import type { CreateSubscriptionDto, EditSubscriptionDto } from './insights.dto';

@Injectable()
export class SubscriptionsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async read(userId: string, baseCurrency: Currency = 'USD', now = new Date()) {
    return this.db.$transaction(
      async (tx) => {
        const accounts = await tx.account.findMany({
          where: { userId },
          select: { id: true, name: true, currency: true },
          orderBy: { id: 'asc' },
        });
        const rates = await tx.fxRate.findMany();
        const convert = reportingConverter(rates, baseCurrency);
        const subscriptions = await tx.subscription.findMany({
          where: { userId },
          include: { merchant: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const history = await tx.transaction.findMany({
          where: {
            account: { userId },
            kind: { in: ['purchase', 'refund'] },
            status: { in: ['completed', 'refunded'] },
            timestamp: { gte: monthStart(now, -36), lte: now },
          },
          include: {
            merchant: true,
            account: true,
            cardPayment: {
              select: {
                isSubscription: true,
                paymentType: true,
                status: true,
                transactions: { select: { id: true, category: true, direction: true } },
                card: {
                  select: {
                    id: true,
                    label: true,
                    last4: true,
                    type: true,
                    status: true,
                    onlinePayments: true,
                    expiryMonth: true,
                    expiryYear: true,
                  },
                },
              },
            },
          },
          orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        });
        const month = monthStart(now),
          today = utcDay(now),
          upcomingEnd = addDays(today, 30);
        const settledHistory = history.filter((row) =>
          classifyActivity({ ...row, transfer: null }),
        );
        const netAmount = (row: (typeof history)[number]) =>
          row.direction === 'credit' ? -row.amountMinor : row.amountMinor;
        const cardWarning = (
          card: NonNullable<(typeof history)[number]['cardPayment']>['card'] | undefined,
        ) => {
          if (!card) return null;
          if (card.status === 'FROZEN')
            return 'This card is frozen. An upcoming payment may be declined.';
          if (card.status === 'TERMINATED')
            return 'This card is terminated. Update your payment method with the merchant.';
          if (
            card.status === 'EXPIRED' ||
            new Date(Date.UTC(card.expiryYear, card.expiryMonth, 1)) <= now
          )
            return 'This card has expired. Update your payment method with the merchant.';
          if (card.status !== 'ACTIVE' || !card.onlinePayments)
            return 'This card currently restricts online payments. Review its controls before the next charge.';
          return null;
        };
        const items = subscriptions.map((subscription) => {
          const linked = settledHistory.filter(
            (row) =>
              row.accountId === subscription.accountId &&
              row.merchantId === subscription.merchantId,
          );
          const current = linked.filter((row) => row.timestamp >= month);
          const paid = linked.filter((row) => row.direction === 'debit');
          const card = paid.find((row) => row.cardPayment)?.cardPayment?.card;
          const next =
            subscription.status === 'ACTIVE'
              ? nextUnpaidOccurrence(
                  subscription.anchorDate,
                  subscription.cadence,
                  now,
                  paid[0]?.timestamp,
                )
              : null;
          return {
            id: subscription.id,
            label: subscription.label,
            merchant: subscription.merchant,
            accountId: subscription.accountId,
            currency: subscription.currency,
            amountMinor: subscription.amountMinor,
            cadence: subscription.cadence,
            status: subscription.status,
            source: subscription.source,
            revision: subscription.revision,
            anchorDate: dateKey(subscription.anchorDate),
            nextPaymentDate: next ? dateKey(next) : null,
            monthlyEquivalentMinor: monthlyEquivalent(
              subscription.amountMinor,
              subscription.cadence,
            ),
            reportMonthlyMinor: convert(
              monthlyEquivalent(subscription.amountMinor, subscription.cadence),
              subscription.currency,
            ),
            spentThisMonthMinor: current.reduce((sum, row) => sum + netAmount(row), 0),
            spentThisYearMinor: linked
              .filter((row) => row.timestamp.getUTCFullYear() === now.getUTCFullYear())
              .reduce((sum, row) => sum + netAmount(row), 0),
            paymentCard: card
              ? {
                  id: card.id,
                  label: card.label,
                  last4: card.last4,
                  type: card.type,
                  status: card.status,
                }
              : null,
            cardWarning: cardWarning(card),
            lastPaidAt: paid[0]?.timestamp.toISOString() ?? null,
            paymentCount: paid.length,
            transactions: linked.slice(0, 20).map(toTransaction),
          };
        });
        const evidence = settledHistory.filter(
          (row) =>
            row.status === 'completed' &&
            row.direction === 'debit' &&
            (row.category === 'subscriptions' ||
              row.cardPayment?.isSubscription ||
              row.cardPayment?.paymentType === 'RECURRING'),
        );
        const groups = new Map<string, typeof evidence>();
        for (const row of evidence) {
          const key = row.accountId + ':' + row.merchantId;
          const list = groups.get(key) ?? [];
          list.push(row);
          groups.set(key, list);
        }
        const candidates = [...groups]
          .flatMap(([key, rows]) => {
            const first = rows[0]!;
            if (
              subscriptions.some(
                (item) =>
                  item.accountId === first.accountId && item.merchantId === first.merchantId,
              )
            )
              return [];
            const schedule = detectSchedule(rows, now);
            if (!schedule) return [];
            return [
              {
                key,
                merchant: first.merchant,
                accountId: first.accountId,
                currency: first.currency,
                amountMinor: schedule.amountMinor,
                cadence: schedule.cadence,
                nextPaymentDate: dateKey(
                  nextUnpaidOccurrence(
                    schedule.anchorDate,
                    schedule.cadence,
                    now,
                    schedule.lastPaidAt,
                  ),
                ),
                evidenceIds: schedule.evidenceIds,
                lastPaidAt: schedule.lastPaidAt.toISOString(),
                confidence: 'Three or more regular payments with similar amounts.',
              },
            ];
          })
          .sort(
            (a, b) =>
              a.nextPaymentDate.localeCompare(b.nextPaymentDate) || a.key.localeCompare(b.key),
          );
        const upcoming = items
          .filter((item) => item.status === 'ACTIVE')
          .flatMap((item) =>
            scheduledDates(
              new Date(item.anchorDate),
              item.cadence,
              new Date(item.nextPaymentDate!),
              upcomingEnd,
            ).map((date) => ({
              subscriptionId: item.id,
              label: item.label,
              merchant: item.merchant,
              date: dateKey(date),
              amountMinor: item.amountMinor,
              currency: item.currency,
              reportAmountMinor: convert(item.amountMinor, item.currency),
              cardWarning: item.cardWarning,
            })),
          )
          .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
        const active = items.filter((item) => item.status === 'ACTIVE');
        return {
          asOf: now.toISOString(),
          baseCurrency,
          accounts,
          items,
          candidates,
          upcoming,
          monthlyEquivalentMinor: active.reduce((sum, item) => sum + item.reportMonthlyMinor, 0),
          yearlyEquivalentMinor: active.reduce(
            (sum, item) =>
              sum +
              convert(
                item.amountMinor *
                  (item.cadence === 'WEEKLY' ? 52 : item.cadence === 'MONTHLY' ? 12 : 1),
                item.currency,
              ),
            0,
          ),
          upcomingTotalMinor: upcoming.reduce((sum, item) => sum + item.reportAmountMinor, 0),
          actualSubscriptionSpendingMinor: settledHistory
            .filter(
              (row) =>
                row.timestamp >= month &&
                (row.category === 'subscriptions' ||
                  row.cardPayment?.isSubscription ||
                  row.cardPayment?.paymentType === 'RECURRING'),
            )
            .reduce((sum, row) => sum + convert(netAmount(row), row.currency), 0),
          month: dateKey(month).slice(0, 7),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async create(userId: string, key: string, body: CreateSubscriptionDto, now = new Date()) {
    const anchorDate = strictDate(body.nextPaymentDate),
      label = body.label.trim(),
      merchantName = body.merchantName.trim();
    if (label.length < 2 || merchantName.length < 2)
      throw new OperationError('INVALID_LABEL', 'Use at least two visible characters.', 400);
    if (anchorDate.getUTCFullYear() < 2000 || anchorDate > addDays(utcDay(now), 366 * 5))
      throw new OperationError(
        'INVALID_DATE',
        'Choose a payment date between 2000 and five years from today.',
        400,
      );
    const requestHash = fingerprint({
      accountId: body.accountId,
      merchantName: merchantName.toLowerCase(),
      merchantId: body.merchantId ?? null,
      label,
      amountMinor: body.amountMinor,
      cadence: body.cadence,
      nextPaymentDate: body.nextPaymentDate,
      source: body.source,
    });
    try {
      return await this.db.$transaction(async (tx) => {
        await lockRequest(tx, userId, key, 'subscription-create');
        const replay = await tx.subscription.findUnique({
          where: { userId_createKey: { userId, createKey: key } },
        });
        if (replay) {
          verifyReplay(replay, requestHash);
          return { id: replay.id };
        }
        const account = await tx.account.findFirst({ where: { id: body.accountId, userId } });
        if (!account) throw new OperationError('INVALID_ACCOUNT', 'Account not found.', 404);
        if (body.source === 'DETECTED' && !body.merchantId)
          throw new OperationError(
            'INVALID_CANDIDATE',
            'Select a recurring payment candidate.',
            400,
          );
        let merchant = body.merchantId
          ? await tx.merchant.findFirst({
              where: {
                id: body.merchantId,
                transactions: { some: { account: { userId }, accountId: account.id } },
              },
            })
          : await tx.merchant.findFirst({
              where: { name: { equals: merchantName, mode: 'insensitive' } },
              orderBy: { id: 'asc' },
            });
        if (body.merchantId && !merchant)
          throw new OperationError(
            'INVALID_MERCHANT',
            'Merchant not found in this account’s history.',
            404,
          );
        if (body.source === 'DETECTED' && merchant) {
          const evidence = await tx.transaction.findMany({
            where: {
              accountId: account.id,
              merchantId: merchant.id,
              direction: 'debit',
              kind: 'purchase',
              status: 'completed',
              timestamp: { gte: monthStart(now, -36), lte: now },
              OR: [
                { category: 'subscriptions' },
                { cardPayment: { isSubscription: true } },
                { cardPayment: { paymentType: 'RECURRING' } },
              ],
              AND: [
                {
                  OR: [
                    { cardPaymentId: null },
                    { cardPayment: { status: { in: ['COMPLETED', 'REFUNDED'] } } },
                  ],
                },
              ],
            },
            orderBy: { timestamp: 'desc' },
          });
          if (!detectSchedule(evidence, now))
            throw new OperationError(
              'CANDIDATE_CHANGED',
              'This history no longer shows a regular subscription. Add it manually if you know its schedule.',
              409,
            );
        }
        if (!merchant) {
          const id =
            'subscription:' +
            createHash('sha256').update(merchantName.toLowerCase()).digest('hex').slice(0, 24);
          merchant = await tx.merchant.upsert({
            where: { id },
            create: { id, name: merchantName, icon: 'subscriptions' },
            update: {},
          });
        }
        const subscription = await tx.subscription.create({
          data: {
            userId,
            accountId: account.id,
            currency: account.currency,
            merchantId: merchant.id,
            label,
            amountMinor: body.amountMinor,
            cadence: body.cadence,
            anchorDate,
            source: body.source,
            createKey: key,
            requestHash,
          },
        });
        return { id: subscription.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new OperationError(
          'SUBSCRIPTION_EXISTS',
          'This merchant is already tracked for this account. Edit the existing subscription.',
          409,
        );
      throw error;
    }
  }
  async edit(userId: string, id: string, body: EditSubscriptionDto, now = new Date()) {
    const anchorDate = body.nextPaymentDate ? strictDate(body.nextPaymentDate) : undefined;
    if (
      anchorDate &&
      (anchorDate.getUTCFullYear() < 2000 || anchorDate > addDays(utcDay(now), 366 * 5))
    )
      throw new OperationError(
        'INVALID_DATE',
        'Choose a valid payment date within five years.',
        400,
      );
    if (body.label !== undefined && body.label.trim().length < 2)
      throw new OperationError('INVALID_LABEL', 'Use at least two visible characters.', 400);
    try {
      const result = await this.db.subscription.updateMany({
        where: { id, userId, revision: body.revision },
        data: {
          ...(body.label !== undefined ? { label: body.label.trim() } : {}),
          ...(body.amountMinor !== undefined ? { amountMinor: body.amountMinor } : {}),
          ...(body.cadence ? { cadence: body.cadence } : {}),
          ...(anchorDate ? { anchorDate } : {}),
          ...(body.status ? { status: body.status } : {}),
          revision: { increment: 1 },
        },
      });
      if (!result.count)
        throw new OperationError(
          'SUBSCRIPTION_CHANGED',
          'This subscription changed or is unavailable. Reload before editing.',
          409,
        );
      return { id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new OperationError(
          'SUBSCRIPTION_EXISTS',
          'Another subscription already tracks this merchant and account.',
          409,
        );
      throw error;
    }
  }
}
