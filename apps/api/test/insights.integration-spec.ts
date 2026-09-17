import 'reflect-metadata';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import type {
  TransactionCategory,
  TransactionDirection,
  TransactionKind,
  TransactionStatus,
} from '../src/generated/prisma/client';
import { AnalyticsService } from '../src/insights/analytics.service';
import { BudgetsService } from '../src/insights/budgets.service';
import { SubscriptionsService } from '../src/insights/subscriptions.service';
import {
  AnalyticsQueryDto,
  InsightMonthDto,
  CreateSubscriptionDto,
} from '../src/insights/insights.dto';
import { dateKey, monthStart } from '../src/insights/analytics-period';
import { LedgerService } from '../src/transfers/ledger.service';
import { QuotesService } from '../src/transfers/quotes.service';
import { TransfersService } from '../src/transfers/transfers.service';
import { CardsService } from '../src/cards/cards.service';
import { CardPaymentsService } from '../src/cards/card-payments.service';

describe('insights, budgets and subscription tracking against PostgreSQL', () => {
  let app: INestApplication<Server>,
    db: PrismaService,
    analytics: AnalyticsService,
    budgets: BudgetsService,
    subscriptions: SubscriptionsService,
    ledger: LedgerService;
  let userId: string, usd: string, eur: string, merchantId: string, cookie: string;
  const now = new Date();
  const query = (value: Partial<AnalyticsQueryDto> = {}) =>
    Object.assign(new AnalyticsQueryDto(), value);
  const monthQuery = (value: Partial<InsightMonthDto> = {}) =>
    Object.assign(new InsightMonthDto(), value);
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    analytics = app.get(AnalyticsService);
    budgets = app.get(BudgetsService);
    subscriptions = app.get(SubscriptionsService);
    ledger = app.get(LedgerService);
  });
  afterAll(async () => {
    await app.close();
  });
  async function activity({
    amount = 1000,
    accountId = usd,
    category = 'dining',
    direction = 'debit',
    kind = 'purchase',
    status = 'completed',
    date = monthStart(now),
    merchant = merchantId,
  }: {
    amount?: number;
    accountId?: string;
    category?: TransactionCategory;
    direction?: TransactionDirection;
    kind?: TransactionKind;
    status?: TransactionStatus;
    date?: Date;
    merchant?: string;
  } = {}) {
    const id = randomUUID(),
      currency = accountId === eur ? 'EUR' : 'USD';
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id=${accountId} FOR UPDATE`;
      await tx.transaction.create({
        data: {
          id,
          accountId,
          currency,
          merchantId: merchant,
          amountMinor: amount,
          direction,
          kind,
          category,
          status,
          timestamp: date,
          paymentMethod: 'card',
          location: 'Demo',
          reference: 'INSIGHT-' + id,
          notes: '',
        },
      });
      if (status === 'completed' || status === 'refunded') {
        const delta = direction === 'credit' ? amount : -amount;
        await ledger.postJournal(tx, { reference: 'INSIGHT-' + id }, [
          { ledgerAccountId: 'customer:' + accountId, currency, amountMinor: delta },
          { ledgerAccountId: 'external:' + currency, currency, amountMinor: -delta },
        ]);
      }
    });
    return id;
  }
  beforeEach(async () => {
    userId = 'insight-test-' + randomUUID();
    usd = userId + '-usd';
    eur = userId + '-eur';
    merchantId = userId + '-merchant';
    await db.user.create({
      data: { id: userId, name: 'Insight test', email: userId + '@example.invalid' },
    });
    await db.merchant.create({
      data: { id: merchantId, name: 'Test recurring ' + userId, icon: 'subscriptions' },
    });
    for (const [id, currency] of [
      [usd, 'USD'],
      [eur, 'EUR'],
    ] as const) {
      await db.account.create({
        data: {
          id,
          userId,
          name: currency,
          currency,
          balanceMinor: 100000,
          openingBalanceMinor: 100000,
          identifier: 'DEMO-' + id,
        },
      });
      await db.ledgerAccount.create({
        data: { id: 'customer:' + id, accountId: id, currency, kind: 'customer' },
      });
      await db.ledgerJournal.create({
        data: {
          reference: 'OPENING-' + id,
          entries: {
            create: [
              { ledgerAccountId: 'customer:' + id, currency, amountMinor: 100000 },
              { ledgerAccountId: 'opening:' + currency, currency, amountMinor: -100000 },
            ],
          },
        },
      });
    }
    await activity();
    await activity({ accountId: eur, category: 'shopping' });
    await activity({ amount: 5000, kind: 'income', direction: 'credit', category: 'income' });
    await activity({
      amount: 500,
      kind: 'refund',
      direction: 'credit',
      status: 'refunded',
      category: 'shopping',
    });
    await activity({ amount: 900, status: 'pending' });
    await activity({ amount: 800, status: 'failed' });
    await activity({ amount: 2000, date: monthStart(now, -1) });
    for (const offset of [0, -1, -2])
      await activity({ amount: 1099, category: 'subscriptions', date: monthStart(now, offset) });
    const token = randomBytes(32).toString('hex');
    await db.demoSession.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    cookie = 'flux_session=' + token;
  });
  afterEach(async () => {
    const journals = await db.ledgerJournal.findMany({
      where: { entries: { some: { ledgerAccount: { account: { userId } } } } },
      select: { id: true },
    });
    const ids = journals.map((item) => item.id);
    await db.ledgerEntry.deleteMany({ where: { journalId: { in: ids } } });
    await db.ledgerJournal.deleteMany({ where: { id: { in: ids } } });
    await db.transaction.deleteMany({ where: { account: { userId } } });
    await db.cardRefund.deleteMany({ where: { userId } });
    await db.cardPayment.deleteMany({ where: { userId } });
    await db.cardAuditEvent.deleteMany({ where: { userId } });
    await db.cardCredential.deleteMany({ where: { card: { userId } } });
    await db.card.deleteMany({ where: { userId } });
    await db.transfer.deleteMany({ where: { userId } });
    await db.transferQuote.deleteMany({ where: { userId } });
    await db.subscription.deleteMany({ where: { userId } });
    await db.budgetAllocation.deleteMany({ where: { budget: { userId } } });
    await db.budget.deleteMany({ where: { userId } });
    await db.demoSession.deleteMany({ where: { userId } });
    await db.ledgerAccount.deleteMany({ where: { account: { userId } } });
    await db.account.deleteMany({ where: { userId } });
    await db.merchant.deleteMany({ where: { id: merchantId } });
    await db.user.delete({ where: { id: userId } });
  });
  const subscriptionBody = (overrides: Partial<CreateSubscriptionDto> = {}) =>
    Object.assign(new CreateSubscriptionDto(), {
      accountId: usd,
      merchantId,
      merchantName: 'Test recurring ' + userId,
      label: 'Test subscription',
      amountMinor: 1099,
      cadence: 'MONTHLY',
      nextPaymentDate: dateKey(monthStart(now, 1)),
      ...overrides,
    });
  test('summary, category proportions, trend, sources and linked original transactions reconcile', async () => {
    const result = await analytics.summary(userId, query());
    expect(result).toMatchObject({
      spendingMinor: 2699,
      incomeMinor: 5000,
      netCashFlowMinor: 2301,
      previousSpendingMinor: 3099,
      transactionCount: 3,
    });
    expect(result.categories.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(2699);
    expect(result.trend.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(2699);
    expect(result.transactions.total).toBe(4);
    expect(
      result.transactions.items.every(
        (item) => item.transaction.accountId === usd || item.transaction.accountId === eur,
      ),
    ).toBe(true);
    const incomes = await analytics.summary(userId, query({ direction: 'income' }));
    expect(incomes.transactions.total).toBe(1);
    expect(incomes.incomeSources).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'income', amountMinor: 5000 })]),
    );
  });
  test('currency, account, category, merchant and pagination filters stay consistent', async () => {
    expect((await analytics.summary(userId, query({ baseCurrency: 'EUR' }))).spendingMinor).toBe(
      1000 + 910 + 1000 - 455,
    );
    const filtered = await analytics.summary(
      userId,
      query({ accountId: eur, baseCurrency: 'GBP', category: 'shopping', merchantId }),
    );
    expect(filtered.spendingMinor).toBe(847);
    expect(filtered.transactionCount).toBe(1);
    expect(filtered.selectedMerchant?.id).toBe(merchantId);
    const first = await analytics.summary(userId, query({ limit: 1 })),
      second = await analytics.summary(userId, query({ limit: 1, page: 2 }));
    expect(first.transactions.items[0]?.transaction.id).not.toBe(
      second.transactions.items[0]?.transaction.id,
    );
    expect(first.transactions.totalPages).toBe(4);
  });
  test('owned-account exchange contributes exactly one fee and no received principal', async () => {
    const quotes = app.get(QuotesService),
      transfers = app.get(TransfersService);
    const quote = await quotes.create(userId, {
      kind: 'exchange',
      sourceAccountId: usd,
      destinationAccountId: eur,
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      destinationAmountMinor: 10000,
    });
    await transfers.execute(userId, randomUUID(), {
      quoteId: quote.id,
      sourceAccountId: usd,
      destinationAccountId: eur,
    });
    const result = await analytics.summary(userId, query());
    expect(result.spendingMinor).toBe(2699 + quote.feeMinor);
    expect(result.incomeMinor).toBe(5000);
    expect(result.transactions.items.find((item) => item.feeOnly)?.reportingAmountMinor).toBe(
      quote.feeMinor,
    );
    expect((await analytics.summary(userId, query({ accountId: eur }))).incomeMinor).toBe(0);
  });
  test('real card purchase and refund update insights reduce net category spending without changing income', async () => {
    const card = await app
      .get(CardsService)
      .create(userId, { type: 'VIRTUAL', label: 'Insight card' });
    const payments = app.get(CardPaymentsService);
    const payment = await payments.authorize(userId, randomUUID(), {
      cardId: card.id,
      credentialVersion: card.credentialVersion,
      merchantName: 'Test recurring ' + userId,
      merchantCategory: 'dining',
      amountMinor: 1000,
      currency: 'USD',
      paymentType: 'ONLINE',
    });
    expect((await analytics.summary(userId, query())).spendingMinor).toBe(3699);
    await payments.refund(userId, payment.id, randomUUID(), { reason: 'Insight refund' });
    const result = await analytics.summary(userId, query());
    expect(result.spendingMinor).toBe(2699);
    expect(result.incomeMinor).toBe(5000);
  });
  test('endpoints enforce sessions, ownership, range validation and server-derived fields', async () => {
    const server = app.getHttpServer();
    await request(server).get('/analytics/summary').expect(401);
    for (const suffix of ['accountId=usd', 'merchantId=roadster'])
      await request(server)
        .get('/analytics/summary?' + suffix)
        .set('Cookie', cookie)
        .expect(404);
    for (const suffix of [
      'period=century',
      'baseCurrency=BTC',
      'dateFrom=2026-02-30&dateTo=2026-03-01',
      'dateFrom=2026-01-01',
      'page=0',
    ])
      await request(server)
        .get('/analytics/summary?' + suffix)
        .set('Cookie', cookie)
        .expect(400);
    for (const endpoint of ['summary', 'spending', 'categories', 'merchants', 'income', 'cashflow'])
      await request(server)
        .get('/analytics/' + endpoint)
        .set('Cookie', cookie)
        .expect(200);
    await request(server)
      .post('/budgets')
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .set('Idempotency-Key', randomUUID())
      .send({ category: 'dining', currency: 'USD', amountMinor: 1000, spentMinor: 0 })
      .expect(400);
  });
  test('budget thresholds use actual category spending and edits preserve past targets', async () => {
    const created = await budgets.create(
      userId,
      randomUUID(),
      { category: 'dining', currency: 'USD', amountMinor: 2000 },
      monthStart(now, -1),
    );
    let result = await budgets.list(userId, monthQuery());
    expect(result.items[0]).toMatchObject({
      spentMinor: 1000,
      remainingMinor: 1000,
      status: 'WITHIN',
    });
    await budgets.edit(userId, created.id, { revision: 1, amountMinor: 1200 });
    result = await budgets.list(userId, monthQuery());
    expect(result.items[0]).toMatchObject({ status: 'NEAR', remainingMinor: 200 });
    await budgets.edit(userId, created.id, { revision: 2, amountMinor: 999 });
    expect((await budgets.list(userId, monthQuery())).items[0]).toMatchObject({
      status: 'OVER',
      remainingMinor: -1,
      dailyAllowanceMinor: 0,
    });
    expect(
      (await budgets.list(userId, monthQuery({ month: dateKey(monthStart(now, -1)).slice(0, 7) })))
        .items[0]?.amountMinor,
    ).toBe(2000);
  });
  test('budget creation retries and uniqueness prevent duplicate category targets', async () => {
    const key = randomUUID(),
      body = { category: 'dining' as const, currency: 'EUR' as const, amountMinor: 1000 };
    const [a, b] = await Promise.all([
      budgets.create(userId, key, body),
      budgets.create(userId, key, body),
    ]);
    expect(a.id).toBe(b.id);
    expect((await budgets.list(userId, monthQuery())).items[0]?.spentMinor).toBe(910);
    await expect(budgets.create(userId, key, { ...body, amountMinor: 2000 })).rejects.toMatchObject(
      { code: 'IDEMPOTENCY_CONFLICT' },
    );
    await expect(budgets.create(userId, randomUUID(), body)).rejects.toMatchObject({
      code: 'BUDGET_EXISTS',
    });
  });
  test('budget revision conflicts, archive and recreation retain historical data', async () => {
    const created = await budgets.create(
      userId,
      randomUUID(),
      { category: 'dining', currency: 'USD', amountMinor: 2000 },
      monthStart(now, -1),
    );
    const edits = await Promise.allSettled([
      budgets.edit(userId, created.id, { revision: 1, amountMinor: 3000 }),
      budgets.edit(userId, created.id, { revision: 1, amountMinor: 4000 }),
    ]);
    expect(edits.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    await expect(
      budgets.edit('another-user', created.id, { revision: 2, amountMinor: 10 }),
    ).rejects.toMatchObject({ code: 'BUDGET_CHANGED' });
    await budgets.archive(userId, created.id, 2);
    expect((await budgets.list(userId, monthQuery())).items).toHaveLength(0);
    expect(
      (await budgets.list(userId, monthQuery({ month: dateKey(monthStart(now, -1)).slice(0, 7) })))
        .items,
    ).toHaveLength(1);
    expect(
      (
        await budgets.create(userId, randomUUID(), {
          category: 'dining',
          currency: 'USD',
          amountMinor: 2000,
        })
      ).id,
    ).not.toBe(created.id);
  });
  test('subscription candidates cite actual recurring history and acceptance removes the suggestion', async () => {
    const before = await subscriptions.read(userId);
    expect(before.candidates).toHaveLength(1);
    expect(before.candidates[0]?.evidenceIds).toHaveLength(3);
    expect(before.actualSubscriptionSpendingMinor).toBe(1099);
    const added = await subscriptions.create(
      userId,
      randomUUID(),
      subscriptionBody({ source: 'DETECTED' }),
    );
    const after = await subscriptions.read(userId);
    expect(after.candidates).toHaveLength(0);
    expect(after.items[0]).toMatchObject({ id: added.id, cadence: 'MONTHLY', amountMinor: 1099 });
    expect(after.monthlyEquivalentMinor).toBe(1099);
    expect(after.yearlyEquivalentMinor).toBe(13188);
  });
  test('manual tracking never changes balances, journals or transaction history', async () => {
    const balances = await db.account.findMany({ where: { userId }, orderBy: { id: 'asc' } });
    const transactions = await db.transaction.findMany({
      where: { account: { userId } },
      orderBy: { id: 'asc' },
    });
    const journalCount = await db.ledgerJournal.count();
    const added = await subscriptions.create(userId, randomUUID(), subscriptionBody());
    await subscriptions.edit(userId, added.id, {
      revision: 1,
      amountMinor: 2000,
      cadence: 'WEEKLY',
      nextPaymentDate: dateKey(now),
    });
    expect(await db.account.findMany({ where: { userId }, orderBy: { id: 'asc' } })).toEqual(
      balances,
    );
    expect(
      await db.transaction.findMany({ where: { account: { userId } }, orderBy: { id: 'asc' } }),
    ).toEqual(transactions);
    expect(await db.ledgerJournal.count()).toBe(journalCount);
  });
  test('subscription pause, resume and cancellation change forecasts while retaining payment history', async () => {
    const added = await subscriptions.create(userId, randomUUID(), subscriptionBody());
    const before = (await subscriptions.read(userId)).items[0]!.paymentCount;
    await subscriptions.edit(userId, added.id, { revision: 1, status: 'PAUSED' });
    expect((await subscriptions.read(userId)).monthlyEquivalentMinor).toBe(0);
    await subscriptions.edit(userId, added.id, { revision: 2, status: 'ACTIVE' });
    expect((await subscriptions.read(userId)).monthlyEquivalentMinor).toBe(1099);
    await subscriptions.edit(userId, added.id, { revision: 3, status: 'CANCELLED' });
    const after = await subscriptions.read(userId);
    expect(after.monthlyEquivalentMinor).toBe(0);
    expect(after.items[0]?.paymentCount).toBe(before);
    expect(after.candidates).toHaveLength(0);
  });
  test('subscription idempotency, uniqueness, ownership and stale-edit checks are enforced', async () => {
    const key = randomUUID(),
      body = subscriptionBody();
    const [a, b] = await Promise.all([
      subscriptions.create(userId, key, body),
      subscriptions.create(userId, key, body),
    ]);
    expect(a.id).toBe(b.id);
    await expect(
      subscriptions.create(userId, key, { ...body, label: 'Changed' }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(subscriptions.create(userId, randomUUID(), body)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_EXISTS',
    });
    await expect(
      subscriptions.create(userId, randomUUID(), { ...body, accountId: 'usd' }),
    ).rejects.toMatchObject({ code: 'INVALID_ACCOUNT' });
    await expect(
      subscriptions.edit('another-user', a.id, { revision: 1, label: 'Changed' }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_CHANGED' });
    await subscriptions.edit(userId, a.id, { revision: 1, label: 'Updated' });
    await expect(
      subscriptions.edit(userId, a.id, { revision: 1, label: 'Stale' }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_CHANGED' });
  });
  test('database checks reject invalid targets and schedules', async () => {
    const added = await budgets.create(userId, randomUUID(), {
      category: 'dining',
      currency: 'USD',
      amountMinor: 2000,
    });
    await expect(
      db.budgetAllocation.updateMany({ where: { budgetId: added.id }, data: { amountMinor: 0 } }),
    ).rejects.toThrow();
    const subscription = await subscriptions.create(userId, randomUUID(), subscriptionBody());
    await expect(
      db.subscription.update({ where: { id: subscription.id }, data: { amountMinor: -1 } }),
    ).rejects.toThrow();
  });
  test('exact limit, one-cent excess, disabled totals and pace forecasts derive from actual spending', async () => {
    const added = await budgets.create(userId, randomUUID(), {
      category: 'dining',
      currency: 'USD',
      amountMinor: 1000,
    });
    let item = (await budgets.list(userId, monthQuery())).items[0]!;
    expect(item).toMatchObject({ status: 'AT_LIMIT', usagePercent: 100, remainingMinor: 0 });
    const monthDays = new Date(monthStart(now, 1).getTime() - 1).getUTCDate();
    expect(item.projectedMinor).toBe(Math.round((1000 * monthDays) / now.getUTCDate()));
    await activity({ amount: 1 });
    item = (await budgets.list(userId, monthQuery())).items[0]!;
    expect(item).toMatchObject({ status: 'OVER', remainingMinor: -1, usagePercent: 100.1 });
    await budgets.edit(userId, added.id, { revision: 1, enabled: false });
    const disabled = await budgets.list(userId, monthQuery());
    expect(disabled.totalPlannedMinor).toBe(0);
    expect(disabled.totalSpentMinor).toBe(0);
    expect(disabled.items[0]).toMatchObject({
      enabled: false,
      spentMinor: 1001,
      status: 'DISABLED',
    });
    await budgets.edit(userId, added.id, { revision: 2, enabled: true });
    expect((await budgets.list(userId, monthQuery())).totalSpentMinor).toBe(1001);
    await request(app.getHttpServer())
      .delete('/budgets/' + added.id)
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .send({ revision: 3 })
      .expect(200);
    expect((await budgets.list(userId, monthQuery())).items).toHaveLength(0);
  });
  test('linked refunds follow later category changes and can exceed the current month’s purchases', async () => {
    await budgets.create(userId, randomUUID(), {
      category: 'dining',
      currency: 'USD',
      amountMinor: 5000,
    });
    await budgets.create(userId, randomUUID(), {
      category: 'shopping',
      currency: 'USD',
      amountMinor: 5000,
    });
    const card = await app
      .get(CardsService)
      .create(userId, { type: 'VIRTUAL', label: 'Refund test' });
    const payments = app.get(CardPaymentsService);
    const payment = await payments.authorize(userId, randomUUID(), {
      cardId: card.id,
      credentialVersion: card.credentialVersion,
      merchantName: 'Test recurring ' + userId,
      merchantCategory: 'shopping',
      amountMinor: 5000,
      currency: 'USD',
      paymentType: 'ONLINE',
    });
    await db.transaction.updateMany({
      where: { cardPaymentId: payment.id, direction: 'debit' },
      data: { timestamp: monthStart(now, -1) },
    });
    await payments.refund(userId, payment.id, randomUUID(), { reason: 'Previous-month purchase' });
    let report = await analytics.summary(userId, query());
    expect(report.spendingMinor).toBe(-2301);
    expect(report.incomeMinor).toBe(5000);
    expect(report.categories.find((item) => item.category === 'shopping')?.amountMinor).toBe(-4400);
    await db.transaction.updateMany({
      where: { cardPaymentId: payment.id, direction: 'debit' },
      data: { category: 'dining' },
    });
    report = await analytics.summary(userId, query());
    expect(report.categories.find((item) => item.category === 'shopping')?.amountMinor).toBe(600);
    expect(report.categories.find((item) => item.category === 'dining')?.amountMinor).toBe(-4000);
    const targets = await budgets.list(userId, monthQuery());
    expect(targets.items.find((item) => item.category === 'dining')).toMatchObject({
      spentMinor: -4000,
      usagePercent: -80,
      projectedMinor: 0,
    });
    expect(targets.items.find((item) => item.category === 'shopping')?.spentMinor).toBe(600);
  });
  test('real recurring card charges update subscription history, yearly net paid and card warnings', async () => {
    const cards = app.get(CardsService),
      payments = app.get(CardPaymentsService);
    const card = await cards.create(userId, { type: 'VIRTUAL', label: 'Recurring card' });
    const added = await subscriptions.create(
      userId,
      randomUUID(),
      subscriptionBody({ nextPaymentDate: dateKey(now) }),
    );
    const before = (await subscriptions.read(userId)).items.find((item) => item.id === added.id)!;
    const payment = await payments.authorize(userId, randomUUID(), {
      cardId: card.id,
      credentialVersion: card.credentialVersion,
      merchantName: 'Test recurring ' + userId,
      merchantCategory: 'subscriptions',
      amountMinor: 1099,
      currency: 'USD',
      paymentType: 'RECURRING',
      isSubscription: true,
    });
    let item = (await subscriptions.read(userId)).items.find((row) => row.id === added.id)!;
    expect(item.paymentCount).toBe(before.paymentCount + 1);
    expect(item.nextPaymentDate! > dateKey(now)).toBe(true);
    expect(
      (await subscriptions.read(userId)).upcoming.some(
        (row) => row.subscriptionId === added.id && row.date === dateKey(now),
      ),
    ).toBe(false);
    expect(item.spentThisYearMinor).toBe(before.spentThisYearMinor + 1099);
    expect(item.paymentCard).toMatchObject({ id: card.id, last4: card.last4 });
    expect(item.transactions.some((row) => row.cardPaymentId === payment.id)).toBe(true);
    expect((await analytics.summary(userId, query())).spendingMinor).toBe(3798);
    await cards.patch(userId, card.id, { status: 'FROZEN' });
    item = (await subscriptions.read(userId)).items.find((row) => row.id === added.id)!;
    expect(item.cardWarning).toContain('frozen');
    const declined = await payments.authorize(userId, randomUUID(), {
      cardId: card.id,
      credentialVersion: card.credentialVersion,
      merchantName: 'Test recurring ' + userId,
      merchantCategory: 'subscriptions',
      amountMinor: 1099,
      currency: 'USD',
      paymentType: 'RECURRING',
    });
    expect(declined.status).toBe('DECLINED');
    expect((await analytics.summary(userId, query())).spendingMinor).toBe(3798);
    await cards.patch(userId, card.id, { status: 'ACTIVE', onlinePayments: false });
    expect(
      (await subscriptions.read(userId)).items.find((row) => row.id === added.id)?.cardWarning,
    ).toContain('restricts');
    await cards.terminate(userId, card.id);
    expect(
      (await subscriptions.read(userId)).items.find((row) => row.id === added.id)?.cardWarning,
    ).toContain('terminated');
    await payments.refund(userId, payment.id, randomUUID(), { reason: 'Recurring refund' });
    item = (await subscriptions.read(userId)).items.find((row) => row.id === added.id)!;
    expect(item.spentThisYearMinor).toBe(before.spentThisYearMinor);
  });
  test('similar merchant names stay distinct and detected acceptance requires evidence', async () => {
    const otherId = merchantId + '-similar';
    await db.merchant.create({
      data: { id: otherId, name: 'Test recurring ' + userId + ' Plus', icon: 'subscriptions' },
    });
    try {
      await activity({ merchant: otherId, category: 'subscriptions', amount: 1099 });
      const result = await subscriptions.read(userId);
      expect(result.candidates.map((item) => item.merchant.id)).toEqual([merchantId]);
      await expect(
        subscriptions.create(
          userId,
          randomUUID(),
          subscriptionBody({ merchantId: otherId, source: 'DETECTED' }),
        ),
      ).rejects.toMatchObject({ code: 'CANDIDATE_CHANGED' });
    } finally {
      await db.transaction.updateMany({
        where: { merchantId: otherId, account: { userId } },
        data: { merchantId },
      });
      await db.merchant.delete({ where: { id: otherId } });
    }
  });
  test('a ten-thousand-transaction portfolio remains responsive with bounded chart and page output', async () => {
    const count = 10000;
    await db.$transaction(
      async (tx) => {
        await tx.transaction.createMany({
          data: Array.from({ length: count }, (_, index) => ({
            id: `${userId}-bulk-${index}`,
            accountId: usd,
            currency: 'USD' as const,
            merchantId,
            amountMinor: 1,
            direction: 'debit' as const,
            kind: 'purchase' as const,
            category: 'dining' as const,
            timestamp: monthStart(now),
            status: 'completed' as const,
            paymentMethod: 'card' as const,
            location: 'Demo',
            reference: `${userId}-BULK-${index}`,
            notes: '',
          })),
        });
        await ledger.postJournal(tx, { reference: `${userId}-BULK` }, [
          { ledgerAccountId: 'customer:' + usd, currency: 'USD', amountMinor: -count },
          { ledgerAccountId: 'external:USD', currency: 'USD', amountMinor: count },
        ]);
      },
      { timeout: 15000 },
    );
    const start = performance.now();
    const result = await analytics.summary(userId, query());
    const elapsed = performance.now() - start;
    expect(result.spendingMinor).toBe(2699 + count);
    expect(result.transactions.items).toHaveLength(20);
    expect(result.trend.length).toBeLessThanOrEqual(31);
    expect(elapsed).toBeLessThan(5000);
  }, 30000);
});
