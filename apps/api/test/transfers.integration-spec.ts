import 'reflect-metadata';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { QuotesService } from '../src/transfers/quotes.service';
import { TransfersService } from '../src/transfers/transfers.service';
import { LedgerService } from '../src/transfers/ledger.service';
import { DemoClearingService } from '../src/transfers/demo-clearing.service';
import type { ExecuteTransferDto } from '../src/transfers/transfer.dto';

describe('atomic transfers and ledger against PostgreSQL', () => {
  let app: INestApplication<Server>,
    db: PrismaService,
    quotes: QuotesService,
    transfers: TransfersService,
    ledger: LedgerService,
    clearing: DemoClearingService;
  let userId: string, sourceId: string, destinationId: string, recipientId: string, cookie: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    quotes = app.get(QuotesService);
    transfers = app.get(TransfersService);
    ledger = app.get(LedgerService);
    clearing = app.get(DemoClearingService);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    userId = `test-${randomUUID()}`;
    sourceId = `${userId}-usd`;
    destinationId = `${userId}-eur`;
    recipientId = `${userId}-recipient`;
    await db.user.create({
      data: { id: userId, name: 'Transfer integration', email: `${userId}@example.invalid` },
    });
    for (const [id, currency, balance] of [
      [sourceId, 'USD', 100000],
      [destinationId, 'EUR', 50000],
    ] as const) {
      await db.account.create({
        data: {
          id,
          userId,
          name: 'Test account',
          currency,
          balanceMinor: balance,
          openingBalanceMinor: balance,
          identifier: `DEMO-${currency}`,
        },
      });
      await db.ledgerAccount.create({
        data: { id: `customer:${id}`, currency, kind: 'customer', accountId: id },
      });
      await db.ledgerJournal.create({
        data: {
          id: `opening:${id}`,
          reference: `OPENING-${id}`,
          entries: {
            create: [
              { ledgerAccountId: `customer:${id}`, currency, amountMinor: balance },
              { ledgerAccountId: `opening:${currency}`, currency, amountMinor: -balance },
            ],
          },
        },
      });
    }
    await db.transaction.create({
      data: {
        id: `hold-${userId}`,
        accountId: sourceId,
        currency: 'USD',
        merchantId: 'roadster',
        amountMinor: 1000,
        direction: 'debit',
        kind: 'purchase',
        category: 'dining',
        timestamp: new Date(),
        status: 'pending',
        paymentMethod: 'card',
        location: 'Test',
        reference: `HOLD-${userId}`,
        notes: '',
      },
    });
    await db.recipient.create({
      data: {
        id: recipientId,
        userId,
        name: 'Test recipient',
        type: 'person',
        country: 'FR',
        preferredCurrency: 'EUR',
        supportedCurrencies: ['EUR'],
        bankName: 'Demo bank',
        accountIdentifier: 'DEMO-TEST-12345',
      },
    });
    const token = randomBytes(32).toString('hex');
    cookie = `flux_session=${token}`;
    await db.demoSession.create({
      data: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        userId,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    jest.spyOn(clearing, 'submit').mockResolvedValue({ accepted: true });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    const ids = (await db.transfer.findMany({ where: { userId }, select: { id: true } })).map(
      (t) => t.id,
    );
    const journalIds = (
      await db.ledgerJournal.findMany({
        where: {
          OR: [
            { transferId: { in: ids } },
            { id: { in: [`opening:${sourceId}`, `opening:${destinationId}`] } },
          ],
        },
        select: { id: true },
      })
    ).map((j) => j.id);
    await db.ledgerEntry.deleteMany({ where: { journalId: { in: journalIds } } });
    await db.ledgerJournal.deleteMany({ where: { id: { in: journalIds } } });
    await db.transaction.deleteMany({ where: { accountId: { in: [sourceId, destinationId] } } });
    await db.transfer.deleteMany({ where: { userId } });
    await db.transferQuote.deleteMany({ where: { userId } });
    await db.merchant.deleteMany({ where: { id: `recipient:${recipientId}` } });
    await db.recipient.deleteMany({ where: { userId } });
    await db.ledgerAccount.deleteMany({ where: { accountId: { in: [sourceId, destinationId] } } });
    await db.account.deleteMany({ where: { userId } });
    await db.demoSession.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  });
  async function quote(amount = 10000) {
    return quotes.create(userId, {
      kind: 'send',
      sourceAccountId: sourceId,
      recipientId,
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      destinationAmountMinor: amount,
    });
  }
  function body(quoteId: string): ExecuteTransferDto {
    return { quoteId, sourceAccountId: sourceId, recipientId, note: 'Dinner' };
  }
  async function assertClean() {
    expect(await db.transfer.count({ where: { userId } })).toBe(0);
    expect((await db.account.findUniqueOrThrow({ where: { id: sourceId } })).balanceMinor).toBe(
      100000,
    );
    expect(await db.ledgerJournal.count({ where: { transfer: { userId } } })).toBe(0);
    expect(await db.transaction.count({ where: { accountId: sourceId, kind: 'transfer' } })).toBe(
      0,
    );
  }
  test('executes with fees, records balanced journal and history, and reconciles account projection', async () => {
    const q = await quote();
    const result = await transfers.execute(userId, randomUUID(), body(q.id));
    expect(result.status).toBe('COMPLETED');
    expect(result.feeMinor).toBe(50);
    expect(result.totalDebitMinor).toBe(11050);
    expect((await db.account.findUniqueOrThrow({ where: { id: sourceId } })).balanceMinor).toBe(
      88950,
    );
    const entries = await db.ledgerEntry.findMany({
      where: { journal: { transferId: result.id } },
    });
    expect(entries).toHaveLength(5);
    for (const currency of ['USD', 'EUR'])
      expect(
        entries.filter((e) => e.currency === currency).reduce((sum, e) => sum + e.amountMinor, 0),
      ).toBe(0);
    expect((await db.transaction.findMany({ where: { transferId: result.id } }))[0]).toMatchObject({
      amountMinor: 11050,
      direction: 'debit',
      category: 'transfers',
    });
    expect(
      (
        await db.ledgerEntry.aggregate({
          where: { ledgerAccountId: `customer:${sourceId}` },
          _sum: { amountMinor: true },
        })
      )._sum.amountMinor,
    ).toBe(88950);
  });
  test('exchanges between owned accounts with a credit and two linked history records', async () => {
    const q = await quotes.create(userId, {
      kind: 'exchange',
      sourceAccountId: sourceId,
      destinationAccountId: destinationId,
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      destinationAmountMinor: 10000,
    });
    const result = await transfers.execute(userId, randomUUID(), {
      quoteId: q.id,
      sourceAccountId: sourceId,
      destinationAccountId: destinationId,
    });
    expect(
      (await db.account.findUniqueOrThrow({ where: { id: destinationId } })).balanceMinor,
    ).toBe(60000);
    expect(await db.transaction.count({ where: { transferId: result.id } })).toBe(2);
  });
  test('fee-inclusive funds and pending holds are authoritative', async () => {
    const q = await quote(90000);
    expect(q.sourceAmountMinor).toBe(99000);
    expect(q.shortfallMinor).toBe(396);
    await expect(transfers.execute(userId, randomUUID(), body(q.id))).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { shortfallMinor: 396 },
    });
    await assertClean();
  });
  test('rejects expiry at execution without a partial transfer', async () => {
    const q = await quote();
    await db.transferQuote.update({
      where: { id: q.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await expect(transfers.execute(userId, randomUUID(), body(q.id))).rejects.toMatchObject({
      code: 'QUOTE_EXPIRED',
    });
    await assertClean();
  });
  test('exact concurrent same-key requests return one result even after quote expiry', async () => {
    const q = await quote(),
      key = randomUUID();
    const results = await Promise.all([
      transfers.execute(userId, key, body(q.id)),
      transfers.execute(userId, key, body(q.id)),
    ]);
    expect(results[0]?.id).toBe(results[1]?.id);
    expect(await db.transfer.count({ where: { userId } })).toBe(1);
    await db.transferQuote.update({ where: { id: q.id }, data: { expiresAt: new Date(0) } });
    expect((await transfers.execute(userId, key, body(q.id))).id).toBe(results[0]?.id);
    await expect(
      transfers.execute(userId, key, { ...body(q.id), note: 'Changed' }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  test('two different keys cannot consume the same quote twice', async () => {
    const q = await quote();
    const results = await Promise.allSettled([
      transfers.execute(userId, randomUUID(), body(q.id)),
      transfers.execute(userId, randomUUID(), body(q.id)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.transfer.count({ where: { userId } })).toBe(1);
  });
  test('concurrent transfers cannot spend the same available balance', async () => {
    const first = await quote(60000),
      second = await quote(60000);
    const results = await Promise.allSettled([
      transfers.execute(userId, randomUUID(), body(first.id)),
      transfers.execute(userId, randomUUID(), body(second.id)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.account.findUniqueOrThrow({ where: { id: sourceId } })).balanceMinor).toBe(
      33736,
    );
  });
  test('rolls back transfer, journal, projection, and history when posting fails', async () => {
    const q = await quote();
    const original = ledger.post.bind(ledger);
    jest.spyOn(ledger, 'post').mockImplementation(async (...args) => {
      await original(...args);
      throw new Error('Injected persistence failure');
    });
    await expect(transfers.execute(userId, randomUUID(), body(q.id))).rejects.toThrow(
      'Injected persistence failure',
    );
    await assertClean();
  });
  test('declared bank rejection is terminal, idempotent, and moves no funds', async () => {
    jest.spyOn(clearing, 'submit').mockResolvedValue({
      accepted: false,
      reason: 'Receiving bank unavailable. No funds were moved.',
    });
    const q = await quote(),
      key = randomUUID();
    const result = await transfers.execute(userId, key, body(q.id));
    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toContain('No funds');
    expect((await transfers.execute(userId, key, body(q.id))).id).toBe(result.id);
    expect((await db.account.findUniqueOrThrow({ where: { id: sourceId } })).balanceMinor).toBe(
      100000,
    );
    expect(await db.ledgerJournal.count({ where: { transferId: result.id } })).toBe(0);
  });
  test('unexpected clearing failure rolls back and the same key can safely retry', async () => {
    jest.spyOn(clearing, 'submit').mockRejectedValueOnce(new Error('Temporary processing outage'));
    const q = await quote(),
      key = randomUUID();
    await expect(transfers.execute(userId, key, body(q.id))).rejects.toThrow();
    await assertClean();
    expect((await transfers.execute(userId, key, body(q.id))).status).toBe('COMPLETED');
  });
  test('validates quote ID, account, recipient and pair on the backend', async () => {
    await expect(transfers.execute(userId, randomUUID(), body(randomUUID()))).rejects.toMatchObject(
      { code: 'INVALID_QUOTE' },
    );
    const q = await quote();
    await expect(
      transfers.execute(userId, randomUUID(), { ...body(q.id), sourceAccountId: destinationId }),
    ).rejects.toMatchObject({ code: 'QUOTE_MISMATCH' });
    await db.recipient.update({ where: { id: recipientId }, data: { status: 'blocked' } });
    await expect(transfers.execute(userId, randomUUID(), body(q.id))).rejects.toMatchObject({
      code: 'INVALID_RECIPIENT',
    });
    await db.recipient.update({ where: { id: recipientId }, data: { status: 'active' } });
    await db.account.update({ where: { id: sourceId }, data: { status: 'frozen' } });
    await expect(transfers.execute(userId, randomUUID(), body(q.id))).rejects.toMatchObject({
      code: 'INACTIVE_ACCOUNT',
    });
    await expect(
      quotes.create(userId, {
        kind: 'send',
        sourceAccountId: destinationId,
        recipientId,
        sourceCurrency: 'EUR',
        destinationCurrency: 'GBP',
        destinationAmountMinor: 100,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PAIR' });
    await assertClean();
  });
  test('checks session ownership and rejects missing identity, cross-origin writes and tampered totals', async () => {
    const q = await quote();
    await request(app.getHttpServer()).get('/recipients').expect(401);
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .set('Origin', 'https://untrusted.example')
      .send(body(q.id))
      .expect(403);
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .set('Idempotency-Key', randomUUID())
      .send({ ...body(q.id), totalDebitMinor: 1 })
      .expect(400);
    await expect(quotes.get('another-user', q.id)).rejects.toMatchObject({ code: 'INVALID_QUOTE' });
    await expect(
      quotes.create(userId, {
        kind: 'send',
        sourceAccountId: 'usd',
        recipientId,
        sourceCurrency: 'USD',
        destinationCurrency: 'EUR',
        destinationAmountMinor: 100,
      }),
    ).rejects.toMatchObject({ code: 'INACTIVE_ACCOUNT' });
    const key = randomUUID();
    const response = await request(app.getHttpServer())
      .post('/transfers')
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .set('Idempotency-Key', key)
      .send(body(q.id))
      .expect(201);
    expect(response.body).toMatchObject({ status: 'COMPLETED' });
    const repeat = await request(app.getHttpServer())
      .post('/transfers')
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .set('Idempotency-Key', key)
      .send(body(q.id))
      .expect(201);
    expect(repeat.body).toEqual(response.body);
  });
  test('database rejects an unbalanced journal at commit', async () => {
    await expect(
      db.ledgerJournal.create({
        data: {
          reference: `INVALID-${userId}`,
          entries: {
            create: { ledgerAccountId: `customer:${sourceId}`, currency: 'USD', amountMinor: 1 },
          },
        },
      }),
    ).rejects.toThrow();
    expect(await db.ledgerJournal.count({ where: { reference: `INVALID-${userId}` } })).toBe(0);
  });
  test('moving an entry cannot leave its original journal unbalanced', async () => {
    const contra = await db.ledgerEntry.findFirstOrThrow({
      where: { journalId: `opening:${sourceId}`, amountMinor: -100000 },
    });
    await expect(
      db.$transaction(async (tx) => {
        const journal = await tx.ledgerJournal.create({
          data: {
            reference: `MOVE-${userId}`,
            entries: {
              create: { ledgerAccountId: 'opening:USD', currency: 'USD', amountMinor: 100000 },
            },
          },
        });
        await tx.ledgerEntry.update({ where: { id: contra.id }, data: { journalId: journal.id } });
      }),
    ).rejects.toThrow();
    expect((await db.ledgerEntry.findUniqueOrThrow({ where: { id: contra.id } })).journalId).toBe(
      `opening:${sourceId}`,
    );
    expect(await db.ledgerJournal.count({ where: { reference: `MOVE-${userId}` } })).toBe(0);
  });
  test('two funded accounts can send concurrently to the same recipient without a lock upgrade deadlock', async () => {
    const first = await quote(100);
    const second = await quotes.create(userId, {
      kind: 'send',
      sourceAccountId: destinationId,
      sourceCurrency: 'EUR',
      recipientId,
      destinationCurrency: 'EUR',
      destinationAmountMinor: 100,
    });
    const results = await Promise.all([
      transfers.execute(userId, randomUUID(), body(first.id)),
      transfers.execute(userId, randomUUID(), {
        quoteId: second.id,
        sourceAccountId: destinationId,
        recipientId,
      }),
    ]);
    expect(results.every((result) => result.status === 'COMPLETED')).toBe(true);
    expect(await db.transfer.count({ where: { userId } })).toBe(2);
  });
  test('recipient creation validates demo bank fields and exposes only owned public records', async () => {
    const fields = {
      name: '  Alex Sample  ',
      type: 'person',
      country: 'FR',
      preferredCurrency: 'EUR',
      bankName: ' Demo Bank ',
      accountIdentifier: 'DEMO-FR-123456',
    };
    const create = (value: object) =>
      request(app.getHttpServer())
        .post('/recipients')
        .set('Cookie', cookie)
        .set('X-Flux-Client', 'web')
        .send(value);
    await create({ ...fields, country: 'ZZ' }).expect(422);
    await create({ ...fields, accountIdentifier: '<script>' }).expect(400);
    await create({ ...fields, name: '   ' }).expect(400);
    await create({ ...fields, name: ' a ' }).expect(422);
    await create({ ...fields, userId: 'demo-alex' }).expect(400);
    await create({ ...fields, bankRoute: 'demo-unavailable' }).expect(400);
    const response = await create(fields).expect(201);
    expect(response.body).toMatchObject({
      name: 'Alex Sample',
      bankName: 'Demo Bank',
      supportedCurrencies: ['EUR'],
      status: 'active',
      lastUsedAt: null,
    });
    expect(response.body).not.toHaveProperty('userId');
    expect(response.body).not.toHaveProperty('bankRoute');
    const all = await request(app.getHttpServer())
      .get('/recipients')
      .set('Cookie', cookie)
      .expect(200);
    expect(all.body).toHaveLength(2);
    await expect(
      quotes.create(userId, {
        kind: 'send',
        sourceAccountId: sourceId,
        sourceCurrency: 'USD',
        recipientId: 'maya-haddad',
        destinationCurrency: 'EUR',
        destinationAmountMinor: 100,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RECIPIENT' });
  });
});
