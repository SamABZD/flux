import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { FinanceService } from '../src/finance/finance.service';
import { OverviewService } from '../src/finance/overview.service';
import { TransactionQueryDto } from '../src/finance/finance.dto';
import { DEMO_USER_ID } from '../src/finance/transaction-query';
import { equivalentUsdMinor } from '../src/finance/finance-mappers';

describe('finance against seeded PostgreSQL', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let finance: FinanceService;
  let overview: OverviewService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    finance = app.get(FinanceService);
    overview = app.get(OverviewService);
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  const query = (values: Partial<TransactionQueryDto> = {}) =>
    Object.assign(new TransactionQueryDto(), values);
  test('four seeded account balances reconcile to their posted ledger', async () => {
    const accounts = await prisma.account.findMany({
      where: { userId: DEMO_USER_ID },
      include: { transactions: true },
    });
    expect(accounts).toHaveLength(4);
    expect(accounts.map((a) => a.currency).sort()).toEqual(['AED', 'EUR', 'GBP', 'USD']);
    expect(
      accounts.reduce(
        (sum, a) => sum + a.transactions.filter((t) => t.id.startsWith('tx_')).length,
        0,
      ),
    ).toBe(444);
    for (const account of accounts) {
      const posted = account.transactions.filter(
        (t) => t.status === 'completed' || t.status === 'refunded',
      );
      expect(
        account.openingBalanceMinor +
          posted.reduce(
            (sum, t) => sum + (t.direction === 'credit' ? t.amountMinor : -t.amountMinor),
            0,
          ),
      ).toBe(account.balanceMinor);
      expect(
        account.transactions.every(
          (t) =>
            t.currency === account.currency && Number.isInteger(t.amountMinor) && t.amountMinor > 0,
        ),
      ).toBe(true);
      const pending = account.transactions
        .filter((t) => t.status === 'pending' && t.direction === 'debit')
        .reduce((sum, t) => sum + t.amountMinor, 0);
      expect((await finance.account(account.id)).availableBalanceMinor).toBe(
        account.balanceMinor - pending,
      );
    }
  });
  test('preserves UTC instants on a host with a non-UTC timezone', async () => {
    expect((await finance.transaction('tx_0437')).timestamp).toBe('2026-09-14T10:42:00.000Z');
    const result = await overview.overview('usd');
    expect(result.spending.daily.find((day) => day.day === 14)?.amountMinor).toBeGreaterThanOrEqual(
      2240,
    );
    expect(result.spending.daily.reduce((sum, day) => sum + day.amountMinor, 0)).toBe(
      result.spending.currentMinor,
    );
    expect(result.totalBalanceMinor).toBe(equivalentUsdMinor((await finance.accounts()).items));
  });
  test('paginates deterministically without duplicates', async () => {
    const first = await finance.transactions(query());
    const second = await finance.transactions(query({ page: 2 }));
    const total = await prisma.transaction.count({ where: { account: { userId: DEMO_USER_ID } } });
    expect(first.total).toBe(total);
    expect(first.totalPages).toBe(Math.ceil(total / 20));
    expect(first.items).toHaveLength(20);
    expect(new Set([...first.items, ...second.items].map((t) => t.id)).size).toBe(40);
    expect(first.items).toEqual((await finance.transactions(query())).items);
  });
  test.each(['usd', 'eur', 'gbp', 'aed'])(
    'filters the %s account without mixing currencies',
    async (account) => {
      const result = await finance.transactions(query({ account, limit: 100 }));
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.every((t) => t.accountId === account)).toBe(true);
    },
  );
  test.each(['ROADSTER', 'FLX-202609-0437', 'dining', 'weekly essentials'])(
    'searches meaningful fields: %s',
    async (search) => {
      const result = await finance.transactions(query({ search, limit: 100 }));
      expect(result.total).toBeGreaterThan(0);
      expect(
        result.items.every((t) =>
          [t.merchant.name, t.category, t.reference, t.notes].some((value) =>
            value.toLowerCase().includes(search.toLowerCase()),
          ),
        ),
      ).toBe(true);
    },
  );
  test('combines account, search, merchant, category, direction, status and inclusive dates', async () => {
    const original = await finance.transaction('tx_0437');
    const result = await finance.transactions(
      query({
        account: 'usd',
        search: 'roadster',
        merchant: 'roadster',
        category: original.category,
        direction: 'debit',
        status: 'completed',
        dateFrom: '2026-09-14',
        dateTo: '2026-09-14',
      }),
    );
    expect(result.items.map((t) => t.id)).toEqual(['tx_0437']);
    expect(result.total).toBe(1);
    expect((await finance.transactions(query({ account: 'eur', search: 'roadster' }))).total).toBe(
      0,
    );
  });
  test('returns an explicit empty page for no matches', async () => {
    expect(
      await finance.transactions(query({ search: 'there is no merchant with this name' })),
    ).toEqual({ items: [], total: 0, totalPages: 0, page: 1, limit: 20 });
  });
  test('category edits persist and update both filtered activity and the Home breakdown', async () => {
    const original = await finance.transaction('tx_0437');
    const category = original.category === 'other' ? 'dining' : 'other';
    const before = await overview.overview('usd');
    try {
      await request(app.getHttpServer())
        .patch('/transactions/tx_0437/category')
        .send({ category })
        .expect(200);
      expect(
        (await prisma.transaction.findUniqueOrThrow({ where: { id: original.id } })).category,
      ).toBe(category);
      expect(
        (await finance.transactions(query({ category, search: original.reference }))).items,
      ).toHaveLength(1);
      expect(
        (
          await finance.transactions(
            query({ category: original.category, search: original.reference }),
          )
        ).items,
      ).toHaveLength(0);
      const after = await overview.overview('usd');
      expect(after.spending.currentMinor).toBe(before.spending.currentMinor);
      expect(after.spending.categories.find((c) => c.category === category)?.amountMinor).toBe(
        (before.spending.categories.find((c) => c.category === category)?.amountMinor ?? 0) +
          original.amountMinor,
      );
    } finally {
      await finance.updateCategory(original.id, { category: original.category });
    }
  });
  test.each([
    '/transactions?category=bad',
    '/transactions?limit=101',
    '/transactions?page=0',
    '/transactions?dateFrom=2026-02-30',
    '/transactions?dateFrom=2026-09-14&dateTo=2026-09-01',
  ])('rejects invalid requests: %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(400);
  });
  test('rejects invalid category edits and unknown IDs', async () => {
    await request(app.getHttpServer())
      .patch('/transactions/tx_0437/category')
      .send({ category: 'invalid' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/transactions/tx_0437/category')
      .send({ category: 'other', amountMinor: 1 })
      .expect(400);
    for (const path of ['/accounts/missing', '/transactions/missing', '/overview?account=missing'])
      await request(app.getHttpServer()).get(path).expect(404);
  });
  test('scopes reads and edits to the demo user', async () => {
    const userId = 'test-isolated-finance-user';
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Isolated test',
        email: 'isolated-finance-test@example.invalid',
        accounts: {
          create: {
            id: 'test-isolated-account',
            name: 'Private',
            currency: 'USD',
            balanceMinor: 1,
            openingBalanceMinor: 1,
            identifier: 'TEST',
          },
        },
      },
    });
    try {
      await prisma.transaction.create({
        data: {
          id: 'test-isolated-tx',
          accountId: 'test-isolated-account',
          currency: 'USD',
          merchantId: 'roadster',
          amountMinor: 1,
          direction: 'debit',
          kind: 'purchase',
          category: 'dining',
          timestamp: new Date(),
          status: 'failed',
          paymentMethod: 'card',
          location: 'Test',
          reference: 'TEST-ISOLATED',
          notes: 'test',
        },
      });
      expect((await finance.transactions(query({ account: 'test-isolated-account' }))).total).toBe(
        0,
      );
      await request(app.getHttpServer()).get('/accounts/test-isolated-account').expect(404);
      await request(app.getHttpServer()).get('/transactions/test-isolated-tx').expect(404);
      await request(app.getHttpServer())
        .patch('/transactions/test-isolated-tx/category')
        .send({ category: 'other' })
        .expect(404);
    } finally {
      await prisma.transaction.deleteMany({ where: { accountId: 'test-isolated-account' } });
      await prisma.account.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  });
});
