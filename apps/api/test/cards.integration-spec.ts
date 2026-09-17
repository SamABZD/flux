import 'reflect-metadata';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import type { CardType, CardPaymentType } from '../src/generated/prisma/client';
import { CardsService } from '../src/cards/cards.service';
import { CardPaymentsService } from '../src/cards/card-payments.service';
import { CardCredentialsService } from '../src/cards/card-credentials.service';
import { LedgerService } from '../src/transfers/ledger.service';
import { QuotesService } from '../src/transfers/quotes.service';
import { TransfersService } from '../src/transfers/transfers.service';
import type { AuthorizeCardDto } from '../src/cards/card.dto';

describe('cards, authorization, refunds and the shared ledger against PostgreSQL', () => {
  let app: INestApplication<Server>,
    db: PrismaService,
    cards: CardsService,
    payments: CardPaymentsService,
    credentials: CardCredentialsService,
    ledger: LedgerService,
    quotes: QuotesService,
    transfers: TransfersService;
  let userId: string,
    usd: string,
    eur: string,
    physical: string,
    virtual: string,
    single: string,
    cookie: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    cards = app.get(CardsService);
    payments = app.get(CardPaymentsService);
    credentials = app.get(CardCredentialsService);
    ledger = app.get(LedgerService);
    quotes = app.get(QuotesService);
    transfers = app.get(TransfersService);
  });
  afterAll(async () => {
    await app.close();
  });
  async function instrument(type: CardType) {
    const id = randomUUID(),
      values = credentials.create(id);
    await db.card.create({
      data: {
        id,
        userId,
        type,
        label: 'Test ' + type,
        last4: values.last4,
        expiryMonth: 12,
        expiryYear: 2030,
        contactlessPayments: type === 'PHYSICAL',
        atmWithdrawals: type === 'PHYSICAL',
        magstripePayments: type === 'PHYSICAL',
        credentials: {
          create: { encryptedNumber: values.encryptedNumber, encryptedCvv: values.encryptedCvv },
        },
      },
    });
    return id;
  }
  beforeEach(async () => {
    userId = `card-test-${randomUUID()}`;
    usd = `${userId}-usd`;
    eur = `${userId}-eur`;
    await db.user.create({
      data: { id: userId, name: 'Card test user', email: `${userId}@example.invalid` },
    });
    for (const [id, currency, balance] of [
      [usd, 'USD', 100000],
      [eur, 'EUR', 10000],
    ] as const) {
      await db.account.create({
        data: {
          id,
          userId,
          name: 'Test ' + currency,
          currency,
          balanceMinor: balance,
          openingBalanceMinor: balance,
          identifier: 'DEMO-' + currency,
        },
      });
      await db.ledgerAccount.create({
        data: { id: `customer:${id}`, accountId: id, currency, kind: 'customer' },
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
        id: randomUUID(),
        accountId: usd,
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
        reference: 'HOLD-' + userId,
        notes: '',
      },
    });
    physical = await instrument('PHYSICAL');
    virtual = await instrument('VIRTUAL');
    single = await instrument('SINGLE_USE');
    const token = randomBytes(32).toString('hex');
    cookie = `flux_session=${token}`;
    await db.demoSession.create({
      data: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        userId,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    const journalIds = (
      await db.ledgerJournal.findMany({
        where: { entries: { some: { ledgerAccount: { accountId: { in: [usd, eur] } } } } },
        select: { id: true },
      })
    ).map((j) => j.id);
    const merchantIds = (
      await db.transaction.findMany({
        where: { account: { userId } },
        select: { merchantId: true },
      })
    ).map((t) => t.merchantId);
    await db.ledgerEntry.deleteMany({ where: { journalId: { in: journalIds } } });
    await db.ledgerJournal.deleteMany({ where: { id: { in: journalIds } } });
    await db.transaction.deleteMany({ where: { account: { userId } } });
    await db.cardRefund.deleteMany({ where: { userId } });
    await db.cardPayment.deleteMany({ where: { userId } });
    await db.cardAuditEvent.deleteMany({ where: { userId } });
    await db.cardCredential.deleteMany({ where: { card: { userId } } });
    await db.card.deleteMany({ where: { userId } });
    await db.transfer.deleteMany({ where: { userId } });
    await db.transferQuote.deleteMany({ where: { userId } });
    await db.recipient.deleteMany({ where: { userId } });
    await db.merchant.deleteMany({
      where: {
        id: { in: merchantIds },
        OR: [{ id: { startsWith: 'card:' } }, { id: { startsWith: 'recipient:' } }],
        transactions: { none: {} },
      },
    });
    await db.ledgerAccount.deleteMany({ where: { accountId: { in: [usd, eur] } } });
    await db.account.deleteMany({ where: { userId } });
    await db.demoSession.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  });
  function body(cardId = physical, extra: Partial<AuthorizeCardDto> = {}): AuthorizeCardDto {
    return {
      cardId,
      credentialVersion: 1,
      merchantName: 'Roadster',
      merchantCategory: 'dining',
      amountMinor: 2800,
      currency: 'USD',
      paymentType: 'CONTACTLESS',
      merchantLocation: 'LB',
      cardholderLocation: 'LB',
      note: 'Card integration',
      ...extra,
    };
  }
  async function charge(
    cardId = physical,
    extra: Partial<AuthorizeCardDto> = {},
    key = randomUUID(),
  ) {
    return payments.authorize(userId, key, body(cardId, extra));
  }
  async function reconcile() {
    for (const id of [usd, eur]) {
      const account = await db.account.findUniqueOrThrow({ where: { id } });
      const total = await db.ledgerEntry.aggregate({
        where: { ledgerAccountId: `customer:${id}` },
        _sum: { amountMinor: true },
      });
      expect(account.balanceMinor).toBe(total._sum.amountMinor);
    }
    const journals = await db.ledgerJournal.findMany({
      where: { entries: { some: { ledgerAccount: { accountId: { in: [usd, eur] } } } } },
      include: { entries: true },
    });
    for (const journal of journals)
      for (const currency of ['USD', 'EUR'])
        expect(
          journal.entries
            .filter((e) => e.currency === currency)
            .reduce((sum, e) => sum + e.amountMinor, 0),
        ).toBe(0);
  }
  async function noMovement() {
    expect((await db.account.findUniqueOrThrow({ where: { id: usd } })).balanceMinor).toBe(100000);
    expect((await db.account.findUniqueOrThrow({ where: { id: eur } })).balanceMinor).toBe(10000);
    expect(await db.transaction.count({ where: { cardPayment: { userId } } })).toBe(0);
    await reconcile();
  }
  test('physical contactless purchase debits the matching account, posts ledger entries and links history', async () => {
    const result = await charge();
    expect(result).toMatchObject({
      status: 'COMPLETED',
      billingAmountMinor: 2800,
      feeMinor: 0,
      account: { id: usd },
      fundingReason: 'MATCHING_CURRENCY',
    });
    expect((await db.account.findUniqueOrThrow({ where: { id: usd } })).balanceMinor).toBe(97200);
    expect(await db.ledgerEntry.count({ where: { journal: { cardPaymentId: result.id } } })).toBe(
      2,
    );
    expect(await db.transaction.findFirst({ where: { cardPaymentId: result.id } })).toMatchObject({
      amountMinor: 2800,
      currency: 'USD',
      direction: 'debit',
      kind: 'purchase',
    });
    await reconcile();
  });
  test('freeze blocks all new methods; unfreeze restores use while history remains', async () => {
    const first = await charge();
    await cards.patch(userId, physical, { status: 'FROZEN' });
    for (const paymentType of ['ONLINE', 'CONTACTLESS', 'ATM'] as const)
      expect((await charge(physical, { paymentType })).declineReason).toBe('CARD_FROZEN');
    expect((await payments.get(userId, first.id)).status).toBe('COMPLETED');
    await cards.patch(userId, physical, { status: 'ACTIVE' });
    expect((await charge()).status).toBe('COMPLETED');
    await reconcile();
  });
  test.each([
    ['onlinePayments', 'ONLINE', 'ONLINE_PAYMENTS_DISABLED'],
    ['contactlessPayments', 'CONTACTLESS', 'CONTACTLESS_DISABLED'],
    ['atmWithdrawals', 'ATM', 'ATM_DISABLED'],
    ['magstripePayments', 'MAGSTRIPE', 'MAGSTRIPE_DISABLED'],
  ] as const)(
    '%s is enforced without blocking chip and PIN',
    async (setting, paymentType, reason) => {
      await cards.patch(userId, physical, { [setting]: false });
      expect((await charge(physical, { paymentType })).declineReason).toBe(reason);
      expect((await charge(physical, { paymentType: 'CHIP_AND_PIN' })).status).toBe('COMPLETED');
      await reconcile();
    },
  );
  test('virtual cards allow online, recurring and enrolled wallets, but not ATM or physical methods', async () => {
    for (const paymentType of ['ONLINE', 'RECURRING'] as const)
      expect((await charge(virtual, { paymentType })).status).toBe('COMPLETED');
    expect((await charge(virtual, { paymentType: 'ATM' })).declineReason).toBe(
      'VIRTUAL_ATM_NOT_ALLOWED',
    );
    expect((await charge(virtual, { paymentType: 'CONTACTLESS' })).declineReason).toBe(
      'VIRTUAL_PAYMENT_METHOD_NOT_ALLOWED',
    );
    expect((await charge(virtual, { paymentType: 'DIGITAL_WALLET' })).declineReason).toBe(
      'WALLET_NOT_ENROLLED',
    );
    expect((await cards.enrollWallet(userId, virtual)).approved).toBe(true);
    expect((await charge(virtual, { paymentType: 'DIGITAL_WALLET' })).status).toBe('COMPLETED');
    await reconcile();
  });
  test('single-use success rotates credentials once; an original-key replay survives rotation and old details fail', async () => {
    const before = await db.card.findUniqueOrThrow({ where: { id: single } }),
      key = randomUUID(),
      requestBody = body(single, { paymentType: 'ONLINE' });
    const first = await payments.authorize(userId, key, requestBody);
    const after = await db.card.findUniqueOrThrow({ where: { id: single } });
    expect(after.credentialVersion).toBe(2);
    expect(after.last4 === before.last4).toBe(false);
    expect(first.card.last4).toBe(before.last4);
    expect((await payments.authorize(userId, key, requestBody)).id).toBe(first.id);
    expect((await payments.authorize(userId, randomUUID(), requestBody)).declineReason).toBe(
      'STALE_CREDENTIALS',
    );
    expect((await db.card.findUniqueOrThrow({ where: { id: single } })).credentialVersion).toBe(2);
    expect(await db.ledgerJournal.count({ where: { cardPayment: { userId } } })).toBe(1);
    await reconcile();
  });
  test.each<CardPaymentType>([
    'RECURRING',
    'ATM',
    'CONTACTLESS',
    'CHIP_AND_PIN',
    'MAGSTRIPE',
    'DIGITAL_WALLET',
  ])('single-use %s is declined without rotation or financial movement', async (paymentType) => {
    expect((await charge(single, { paymentType })).status).toBe('DECLINED');
    expect((await db.card.findUniqueOrThrow({ where: { id: single } })).credentialVersion).toBe(1);
    await noMovement();
  });
  test('single-use online subscription/PIN flags and wallet enrollment are rejected', async () => {
    expect(
      (await charge(single, { paymentType: 'ONLINE', isSubscription: true })).declineReason,
    ).toBe('SINGLE_USE_RECURRING_NOT_ALLOWED');
    expect((await charge(single, { paymentType: 'ONLINE', requiresPin: true })).declineReason).toBe(
      'SINGLE_USE_PAYMENT_METHOD_NOT_ALLOWED',
    );
    expect((await cards.enrollWallet(userId, single)).declineReason).toBe(
      'SINGLE_USE_WALLET_NOT_ALLOWED',
    );
    await noMovement();
  });
  test('location security uses simulated in-person countries and never requests a real location', async () => {
    await cards.patch(userId, physical, { locationSecurity: true });
    expect((await charge(physical, { merchantLocation: 'FR' })).declineReason).toBe(
      'LOCATION_MISMATCH',
    );
    expect((await charge(physical, { merchantLocation: 'LB' })).status).toBe('COMPLETED');
    expect((await charge(physical, { paymentType: 'ONLINE', merchantLocation: 'FR' })).status).toBe(
      'COMPLETED',
    );
    await reconcile();
  });
  test('monthly limit permits exactly the limit, rejects a cent above, and can be edited or disabled', async () => {
    await cards.patch(userId, physical, { monthlyLimitMinor: 10000 });
    expect((await charge(physical, { amountMinor: 9999 })).status).toBe('COMPLETED');
    expect((await charge(physical, { amountMinor: 1 })).status).toBe('COMPLETED');
    expect((await charge(physical, { amountMinor: 1 })).declineReason).toBe(
      'SPENDING_LIMIT_EXCEEDED',
    );
    expect((await cards.get(userId, physical)).monthlyLimit).toMatchObject({
      spentMinor: 10000,
      remainingMinor: 0,
    });
    await cards.patch(userId, physical, { monthlyLimitMinor: 5000 });
    expect((await cards.get(userId, physical)).monthlyLimit.remainingMinor).toBe(0);
    await cards.patch(userId, physical, { monthlyLimitMinor: null });
    expect((await charge(physical, { amountMinor: 1 })).status).toBe('COMPLETED');
    await reconcile();
  });
  test('previous UTC-month purchases and refunds do not consume or release current-month limit', async () => {
    const previous = await charge(physical, { amountMinor: 5000 });
    const date = new Date();
    date.setUTCDate(0);
    date.setUTCHours(12, 0, 0, 0);
    await db.cardPayment.update({ where: { id: previous.id }, data: { createdAt: date } });
    await cards.patch(userId, physical, { monthlyLimitMinor: 5000 });
    expect((await charge(physical, { amountMinor: 5000 })).status).toBe('COMPLETED');
    await payments.refund(userId, previous.id, randomUUID(), { reason: 'Previous period refund' });
    expect((await cards.get(userId, physical)).monthlyLimit.spentMinor).toBe(5000);
    expect((await charge(physical, { amountMinor: 1 })).declineReason).toBe(
      'SPENDING_LIMIT_EXCEEDED',
    );
    await reconcile();
  });
  test('available funds include existing holds and FX fees; partial accounts are not combined', async () => {
    expect((await charge(physical, { amountMinor: 99001 })).declineReason).toBe(
      'INSUFFICIENT_FUNDS',
    );
    expect((await charge(physical, { amountMinor: 90000, currency: 'EUR' })).declineReason).toBe(
      'INSUFFICIENT_FUNDS',
    );
    await noMovement();
  });
  test('FX uses shared rates and five balanced postings; refund reverses exact original amounts', async () => {
    const result = await charge(physical, {
      currency: 'EUR',
      amountMinor: 20000,
      paymentType: 'ONLINE',
    });
    expect(result).toMatchObject({
      status: 'COMPLETED',
      account: { id: usd },
      principalMinor: 22000,
      feeMinor: 88,
      billingAmountMinor: 22088,
      rateLabel: '0.909090',
    });
    expect(await db.ledgerEntry.count({ where: { journal: { cardPaymentId: result.id } } })).toBe(
      5,
    );
    expect(await db.transaction.findFirst({ where: { cardPaymentId: result.id } })).toMatchObject({
      currency: 'USD',
      amountMinor: 22088,
    });
    const rates = jest
      .spyOn(db.fxRate, 'findMany')
      .mockRejectedValue(new Error('Refund must not fetch a new FX rate'));
    expect(
      (await payments.refund(userId, result.id, randomUUID(), { reason: 'Full FX refund' })).status,
    ).toBe('REFUNDED');
    expect(rates).not.toHaveBeenCalled();
    expect((await db.account.findUniqueOrThrow({ where: { id: usd } })).balanceMinor).toBe(100000);
    await reconcile();
  });
  test('refund reaches original account after single-use rotation and termination; exact refund replay cannot credit twice', async () => {
    const result = await charge(single, { paymentType: 'ONLINE' });
    await cards.terminate(userId, single);
    const key = randomUUID(),
      refund = { reason: 'Returned order' };
    expect((await payments.refund(userId, result.id, key, refund)).status).toBe('REFUNDED');
    expect((await payments.refund(userId, result.id, key, refund)).id).toBe(result.id);
    await expect(payments.refund(userId, result.id, randomUUID(), refund)).rejects.toMatchObject({
      code: 'ALREADY_REFUNDED',
    });
    expect(
      (await charge(single, { paymentType: 'ONLINE', credentialVersion: 2 })).declineReason,
    ).toBe('CARD_TERMINATED');
    expect(await db.transaction.count({ where: { cardPaymentId: result.id } })).toBe(2);
    expect((await cards.get(userId, single)).monthlyLimit.spentMinor).toBe(0);
    await reconcile();
  });
  test('an injected failure after credential rotation rolls back the payment, journal, history, balance, usage and credentials', async () => {
    const before = await db.cardCredential.findUniqueOrThrow({ where: { cardId: single } });
    const original = credentials.rotate.bind(credentials);
    jest.spyOn(credentials, 'rotate').mockImplementation(async (...args) => {
      await original(...args);
      throw new Error('Injected rotation persistence failure');
    });
    await expect(charge(single, { paymentType: 'ONLINE' })).rejects.toThrow(
      'Injected rotation persistence failure',
    );
    expect(await db.cardPayment.count({ where: { userId } })).toBe(0);
    expect((await db.card.findUniqueOrThrow({ where: { id: single } })).credentialVersion).toBe(1);
    const after = await db.cardCredential.findUniqueOrThrow({ where: { cardId: single } });
    expect(
      after.encryptedNumber === before.encryptedNumber &&
        after.encryptedCvv === before.encryptedCvv,
    ).toBe(true);
    expect(await db.cardAuditEvent.count({ where: { userId } })).toBe(0);
    await noMovement();
  });
  test('a refund failure after journal posting cannot leave a partial credit', async () => {
    const result = await charge();
    const original = ledger.postJournal.bind(ledger);
    jest.spyOn(ledger, 'postJournal').mockImplementation(async (...args) => {
      await original(...args);
      throw new Error('Injected refund persistence failure');
    });
    await expect(
      payments.refund(userId, result.id, randomUUID(), { reason: 'Refund failure test' }),
    ).rejects.toThrow('Injected refund persistence failure');
    expect((await payments.get(userId, result.id)).status).toBe('COMPLETED');
    expect(await db.cardRefund.count({ where: { userId } })).toBe(0);
    expect((await db.account.findUniqueOrThrow({ where: { id: usd } })).balanceMinor).toBe(97200);
    await reconcile();
  });
  test('concurrent cards cannot overspend the same account', async () => {
    const results = await Promise.all([
      charge(physical, { amountMinor: 80000, paymentType: 'ONLINE' }),
      charge(virtual, { amountMinor: 60000, paymentType: 'ONLINE' }),
    ]);
    expect(results.filter((result) => result.status === 'COMPLETED')).toHaveLength(1);
    expect(results.filter((result) => result.declineReason === 'INSUFFICIENT_FUNDS')).toHaveLength(
      1,
    );
    await reconcile();
  });
  test('card and transfer operations share account locks against overspending', async () => {
    const recipient = await db.recipient.create({
      data: {
        userId,
        name: 'Test transfer',
        type: 'person',
        country: 'US',
        preferredCurrency: 'USD',
        supportedCurrencies: ['USD'],
        bankName: 'Demo bank',
        accountIdentifier: 'DEMO-TEST-1234',
      },
    });
    const q = await quotes.create(userId, {
      kind: 'send',
      sourceAccountId: usd,
      sourceCurrency: 'USD',
      destinationCurrency: 'USD',
      destinationAmountMinor: 80000,
      recipientId: recipient.id,
    });
    const outcomes = await Promise.allSettled([
      charge(physical, { amountMinor: 60000, paymentType: 'ONLINE' }),
      transfers.execute(userId, randomUUID(), {
        quoteId: q.id,
        sourceAccountId: usd,
        recipientId: recipient.id,
      }),
    ]);
    expect(
      outcomes.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 'COMPLETED',
      ),
    ).toHaveLength(1);
    await reconcile();
  });
  test('one card serializes its monthly limit even when two funded currencies are used', async () => {
    await cards.patch(userId, physical, { monthlyLimitMinor: 10000 });
    const results = await Promise.all([
      charge(physical, { amountMinor: 6000, currency: 'USD' }),
      charge(physical, { amountMinor: 5000, currency: 'EUR' }),
    ]);
    expect(results.filter((result) => result.status === 'COMPLETED')).toHaveLength(1);
    expect(
      results.filter((result) => result.declineReason === 'SPENDING_LIMIT_EXCEEDED'),
    ).toHaveLength(1);
    await reconcile();
  });
  test('same-key concurrent authorization returns one result, including after freeze; changed intent conflicts', async () => {
    const key = randomUUID(),
      value = body();
    const results = await Promise.all([
      payments.authorize(userId, key, value),
      payments.authorize(userId, key, value),
    ]);
    expect(results[0]?.id).toBe(results[1]?.id);
    await cards.patch(userId, physical, { status: 'FROZEN' });
    expect((await payments.authorize(userId, key, value)).id).toBe(results[0]?.id);
    await expect(
      payments.authorize(userId, key, { ...value, amountMinor: 2801 }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await db.cardPayment.count({ where: { userId } })).toBe(1);
    await reconcile();
  });
  test('unsupported currencies and expired cards have structured declines', async () => {
    expect((await charge(physical, { currency: 'BTC' })).declineReason).toBe(
      'UNSUPPORTED_CURRENCY',
    );
    await db.card.update({ where: { id: physical }, data: { expiryYear: 2026, expiryMonth: 1 } });
    expect((await charge()).declineReason).toBe('CARD_EXPIRED');
    await noMovement();
  });
  test('expired single-use cards can be replaced without restoring old credentials', async () => {
    await db.card.update({ where: { id: single }, data: { expiryYear: 2026, expiryMonth: 1 } });
    const replacement = await cards.create(userId, { type: 'SINGLE_USE', label: 'Replacement' });
    expect(replacement.id).not.toBe(single);
    expect((await cards.get(userId, single)).status).toBe('EXPIRED');
    expect((await charge(single, { paymentType: 'ONLINE' })).declineReason).toBe('CARD_EXPIRED');
    await noMovement();
  });
  test('a balanced journal cannot post another currency into a customer account', async () => {
    await expect(
      db.$transaction((tx) =>
        ledger.postJournal(tx, { reference: 'TEST-WRONG-CURRENCY' }, [
          { ledgerAccountId: `customer:${usd}`, currency: 'EUR', amountMinor: -100 },
          { ledgerAccountId: 'external:EUR', currency: 'EUR', amountMinor: 100 },
        ]),
      ),
    ).rejects.toThrow('Ledger posting currency');
    await noMovement();
  });
  test('database checks reject incomplete billing and monthly-usage snapshots', async () => {
    const payment = await charge();
    await expect(
      db.cardPayment.update({ where: { id: payment.id }, data: { feeMinor: null } }),
    ).rejects.toThrow();
    await expect(
      db.cardPayment.update({ where: { id: payment.id }, data: { limitAmountUsdMinor: null } }),
    ).rejects.toThrow();
    expect((await payments.get(userId, payment.id)).feeMinor).toBe(0);
    await reconcile();
  });
  test('physical ATM withdrawal posts to accounts and history, and counts toward the monthly limit', async () => {
    await cards.patch(userId, physical, { monthlyLimitMinor: 10000 });
    const result = await charge(physical, { paymentType: 'ATM', amountMinor: 10000 });
    expect(result.status).toBe('COMPLETED');
    expect(await db.transaction.findFirst({ where: { cardPaymentId: result.id } })).toMatchObject({
      kind: 'transfer',
      amountMinor: 10000,
    });
    expect((await cards.get(userId, physical)).monthlyLimit.spentMinor).toBe(10000);
    expect((await charge(physical, { paymentType: 'ATM', amountMinor: 1 })).declineReason).toBe(
      'SPENDING_LIMIT_EXCEEDED',
    );
    await reconcile();
  });
  test('concurrent different refund keys cannot credit a purchase twice', async () => {
    const payment = await charge();
    const results = await Promise.allSettled([
      payments.refund(userId, payment.id, randomUUID(), { reason: 'First request' }),
      payments.refund(userId, payment.id, randomUUID(), { reason: 'Second request' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.cardRefund.count({ where: { userId } })).toBe(1);
    expect((await db.account.findUniqueOrThrow({ where: { id: usd } })).balanceMinor).toBe(100000);
    await reconcile();
  });
  test('frozen cards may reveal after reauthentication; terminated cards cannot', async () => {
    await cards.patch(userId, virtual, { status: 'FROZEN' });
    expect((await cards.reveal(userId, virtual, '4821')).synthetic).toBe(true);
    await cards.terminate(userId, virtual);
    await expect(cards.reveal(userId, virtual, '4821')).rejects.toMatchObject({
      code: 'DETAILS_UNAVAILABLE',
    });
  });
  test('virtual creation, labels, one live single-use card, and irreversible termination preserve history', async () => {
    const created = await cards.create(userId, { type: 'VIRTUAL', label: ' Travel ' });
    expect(created).toMatchObject({ type: 'VIRTUAL', label: 'Travel', status: 'ACTIVE' });
    await cards.patch(userId, created.id, { label: 'Subscriptions' });
    expect((await cards.get(userId, created.id)).type).toBe('VIRTUAL');
    await expect(cards.patch(userId, created.id, { atmWithdrawals: true })).rejects.toMatchObject({
      code: 'SETTING_NOT_SUPPORTED',
    });
    await expect(
      cards.create(userId, { type: 'SINGLE_USE', label: 'One time' }),
    ).rejects.toMatchObject({ code: 'SINGLE_USE_EXISTS' });
    await cards.terminate(userId, single);
    expect(
      (await cards.create(userId, { type: 'SINGLE_USE', label: 'Fresh one time' })).status,
    ).toBe('ACTIVE');
    await cards.terminate(userId, created.id);
    await expect(cards.patch(userId, created.id, { status: 'ACTIVE' })).rejects.toMatchObject({
      code: 'CARD_UNAVAILABLE',
    });
    const actions = await cards.audit(userId, created.id);
    expect(actions.map((event) => event.action)).toEqual(
      expect.arrayContaining(['CREATED', 'LABEL_CHANGED', 'TERMINATED']),
    );
  });
  test('HTTP ownership, input tampering, secure reveal and audit data never expose raw credentials through ordinary responses', async () => {
    const server = app.getHttpServer();
    await request(server).get('/cards').expect(401);
    await request(server)
      .post('/card-payments/authorize')
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .set('Idempotency-Key', randomUUID())
      .set('Origin', 'https://untrusted.example')
      .send(body())
      .expect(403);
    await request(server)
      .post('/card-payments/authorize')
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .set('Idempotency-Key', randomUUID())
      .send({ ...body(), balanceMinor: 999999 })
      .expect(400);
    await request(server)
      .patch('/cards/' + physical)
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .send({ type: 'VIRTUAL' })
      .expect(400);
    await expect(
      payments.authorize(userId, randomUUID(), body('card-physical')),
    ).rejects.toMatchObject({ code: 'INVALID_CARD' });
    await request(server)
      .post(`/cards/${physical}/reveal`)
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .send({ pin: '1111' })
      .expect(403);
    const reveal = await request(server)
      .post(`/cards/${physical}/reveal`)
      .set('Cookie', cookie)
      .set('X-Flux-Client', 'web')
      .send({ pin: '4821' })
      .expect(201);
    const values = reveal.body as { number: string; cvv: string };
    expect(reveal.headers['cache-control']).toBe('no-store');
    expect(values.number.startsWith('0000')).toBe(true);
    const normal = await request(server).get('/cards').set('Cookie', cookie).expect(200);
    const events = await cards.audit(userId, physical);
    for (const data of [normal.body, events]) {
      const json = JSON.stringify(data);
      expect(json.includes(values.number)).toBe(false);
      expect(json.includes(`"${values.cvv}"`)).toBe(false);
      expect(/encryptedNumber|encryptedCvv/.test(json)).toBe(false);
    }
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(['REVEAL_DENIED', 'DETAILS_REVEALED']),
    );
  });
});
