import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Account, CardDeclineReason, Prisma } from '../generated/prisma/client';
import { OperationError } from '../common/operation-error';
import { fingerprint, lockRequest, validateKey, verifyReplay } from '../common/idempotency';
import { LedgerService } from '../transfers/ledger.service';
import { CardCredentialsService } from './card-credentials.service';
import { cardAudit, lockCard, spendingThisMonth } from './card-records';
import { paymentPolicyDecline } from './card-policy';
import { cardPaymentPostings, isSupportedCurrency, resolveCardFunding } from './card-funding';
import type { Funding } from './card-funding';
import { paymentInclude, publicCardPayment } from './card-payment-mappers';
import type { AuthorizeCardDto, RefundCardDto } from './card.dto';

export function paymentFingerprint(body: AuthorizeCardDto) {
  return fingerprint({
    cardId: body.cardId,
    credentialVersion: body.credentialVersion,
    merchantName: body.merchantName,
    merchantCategory: body.merchantCategory,
    amountMinor: body.amountMinor,
    currency: body.currency,
    paymentType: body.paymentType,
    isSubscription: body.isSubscription ?? false,
    requiresPin: body.requiresPin ?? false,
    merchantLocation: body.merchantLocation ?? null,
    cardholderLocation: body.cardholderLocation ?? null,
    note: body.note ?? '',
  });
}
@Injectable()
export class CardPaymentsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(CardCredentialsService) private readonly credentials: CardCredentialsService,
  ) {}
  async list(userId: string, cardId?: string) {
    if (cardId && !(await this.db.card.findFirst({ where: { id: cardId, userId } })))
      throw new OperationError('INVALID_CARD', 'Card not found.', 404);
    return (
      await this.db.cardPayment.findMany({
        where: { userId, ...(cardId ? { cardId } : {}) },
        include: paymentInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      })
    ).map(publicCardPayment);
  }
  async get(userId: string, id: string) {
    const payment = await this.db.cardPayment.findFirst({
      where: { id, userId },
      include: paymentInclude,
    });
    if (!payment) throw new OperationError('PAYMENT_NOT_FOUND', 'Card payment not found.', 404);
    return publicCardPayment(payment);
  }
  async byKey(userId: string, key: string) {
    const payment = await this.db.cardPayment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      include: paymentInclude,
    });
    return { payment: payment ? publicCardPayment(payment) : null };
  }
  async authorize(userId: string, key: string, body: AuthorizeCardDto) {
    validateKey(key);
    const hash = paymentFingerprint(body);
    if (['income', 'transfers'].includes(body.merchantCategory))
      throw new OperationError(
        'INVALID_CATEGORY',
        'Choose a purchase category for this card payment.',
        400,
      );
    return this.db.$transaction(
      async (tx) => {
        await lockRequest(tx, userId, key, 'card-authorization');
        const previous = await tx.cardPayment.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
          include: paymentInclude,
        });
        if (previous) {
          verifyReplay(previous, hash);
          return publicCardPayment(previous);
        }
        const card = await lockCard(tx, userId, body.cardId);
        let now = new Date(),
          reason: CardDeclineReason | null = paymentPolicyDecline(card, body, now),
          funding: Funding | null = null;
        if (!reason && !isSupportedCurrency(body.currency)) reason = 'UNSUPPORTED_CURRENCY';
        if (!reason && isSupportedCurrency(body.currency)) {
          const accounts = await tx.$queryRaw<
            Account[]
          >`SELECT * FROM "Account" WHERE "userId"=${userId} ORDER BY id FOR UPDATE`;
          const pending = await tx.transaction.groupBy({
            by: ['accountId'],
            where: {
              accountId: { in: accounts.map((a) => a.id) },
              status: 'pending',
              direction: 'debit',
            },
            _sum: { amountMinor: true },
          });
          const rates = await tx.fxRate.findMany();
          now = new Date();
          reason = paymentPolicyDecline(card, body, now);
          if (!reason && !rates.some((rate) => rate.currency === body.currency))
            reason = 'UNSUPPORTED_CURRENCY';
          if (!reason) {
            funding = resolveCardFunding(
              accounts,
              new Map(pending.map((row) => [row.accountId, row._sum.amountMinor ?? 0])),
              rates,
              body.amountMinor,
              body.currency,
            );
            if (!funding) reason = 'INSUFFICIENT_FUNDS';
          }
          if (
            !reason &&
            funding &&
            card.monthlyLimitMinor !== null &&
            (await spendingThisMonth(tx, card.id, now)) + funding.limitAmountUsdMinor >
              card.monthlyLimitMinor
          )
            reason = 'SPENDING_LIMIT_EXCEEDED';
        }
        const id = randomUUID(),
          reference = `PAY-${id.slice(0, 13).replace('-', '').toUpperCase()}`;
        const payment = await tx.cardPayment.create({
          data: {
            id,
            userId,
            cardId: card.id,
            merchantName: body.merchantName.trim(),
            merchantCategory: body.merchantCategory,
            amountMinor: body.amountMinor,
            currency: body.currency,
            paymentType: body.paymentType,
            isSubscription: body.isSubscription ?? false,
            requiresPin: body.requiresPin ?? false,
            merchantLocation: body.merchantLocation ?? null,
            cardholderLocation: body.cardholderLocation ?? null,
            status: reason ? 'DECLINED' : 'AUTHORIZED',
            declineReason: reason,
            credentialVersion: body.credentialVersion,
            cardLast4: card.last4,
            idempotencyKey: key,
            requestHash: hash,
            reference,
            note: body.note ?? '',
            createdAt: now,
            authorizedAt: reason ? null : now,
            ...(funding ?? {}),
          },
        });
        if (reason) {
          await cardAudit(tx, card, 'PAYMENT_DECLINED', { paymentId: id, reason });
          return publicCardPayment(
            await tx.cardPayment.findUniqueOrThrow({ where: { id }, include: paymentInclude }),
          );
        }
        if (!funding || !isSupportedCurrency(body.currency))
          throw new Error('Authorized payment has no valid funding.');
        await this.ledger.postJournal(
          tx,
          { cardPaymentId: id, reference },
          cardPaymentPostings(funding, body.amountMinor, body.currency),
        );
        await this.history(tx, payment.id, reference, body, funding, now);
        await tx.cardPayment.update({
          where: { id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        if (card.type === 'SINGLE_USE') await this.credentials.rotate(tx, card);
        await cardAudit(tx, card, 'PAYMENT_COMPLETED', {
          paymentId: id,
          amountMinor: body.amountMinor,
          currency: body.currency,
        });
        return publicCardPayment(
          await tx.cardPayment.findUniqueOrThrow({ where: { id }, include: paymentInclude }),
        );
      },
      { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 15000 },
    );
  }
  private async history(
    tx: Prisma.TransactionClient,
    id: string,
    reference: string,
    body: AuthorizeCardDto,
    funding: Funding,
    now: Date,
  ) {
    const name = body.merchantName.trim();
    let merchant = await tx.merchant.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (!merchant) {
      const merchantId = `card:${createHash('sha256').update(name.toLowerCase()).digest('hex').slice(0, 20)}`;
      merchant = await tx.merchant.upsert({
        where: { id: merchantId },
        create: { id: merchantId, name, icon: body.merchantCategory },
        update: {},
      });
    }
    await tx.transaction.create({
      data: {
        id: randomUUID(),
        cardPaymentId: id,
        accountId: funding.accountId,
        currency: funding.billingCurrency,
        merchantId: merchant.id,
        amountMinor: funding.billingAmountMinor,
        direction: 'debit',
        kind: body.paymentType === 'ATM' ? 'transfer' : 'purchase',
        category: body.merchantCategory,
        timestamp: now,
        status: 'completed',
        paymentMethod: 'card',
        location: body.merchantLocation ?? 'Online',
        reference,
        notes: body.note ?? '',
      },
    });
  }
  async refund(userId: string, paymentId: string, key: string, body: RefundCardDto) {
    validateKey(key);
    const hash = fingerprint({ paymentId, reason: body.reason });
    return this.db.$transaction(
      async (tx) => {
        await lockRequest(tx, userId, key, 'card-refund');
        const previous = await tx.cardRefund.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
        });
        if (previous) {
          verifyReplay(previous, hash);
          return publicCardPayment(
            await tx.cardPayment.findUniqueOrThrow({
              where: { id: previous.cardPaymentId },
              include: paymentInclude,
            }),
          );
        }
        const original = await tx.cardPayment.findFirst({ where: { id: paymentId, userId } });
        if (!original)
          throw new OperationError('PAYMENT_NOT_FOUND', 'Card payment not found.', 404);
        const card = await lockCard(tx, userId, original.cardId);
        await tx.$queryRaw`SELECT id FROM "CardPayment" WHERE id=${paymentId} FOR UPDATE`;
        const payment = await tx.cardPayment.findUniqueOrThrow({
          where: { id: paymentId },
          include: { journal: { include: { entries: true } }, transactions: true, refund: true },
        });
        if (payment.status === 'REFUNDED')
          throw new OperationError(
            'ALREADY_REFUNDED',
            'This payment has already been refunded. Open its details.',
            409,
          );
        if (
          payment.status !== 'COMPLETED' ||
          !payment.accountId ||
          !payment.billingAmountMinor ||
          !payment.journal
        )
          throw new OperationError(
            'REFUND_NOT_ALLOWED',
            'Only a completed card payment can be refunded.',
            409,
          );
        const accounts = await tx.$queryRaw<
          Account[]
        >`SELECT * FROM "Account" WHERE id=${payment.accountId} AND "userId"=${userId} FOR UPDATE`;
        const account = accounts[0];
        if (!account)
          throw new OperationError(
            'ACCOUNT_UNAVAILABLE',
            'The original funding account is unavailable.',
            409,
          );
        if (account.balanceMinor + payment.billingAmountMinor > 2000000000)
          throw new OperationError(
            'ACCOUNT_LIMIT',
            'This refund would exceed the demo account limit.',
            409,
          );
        const id = randomUUID(),
          reference = `REF-${id.slice(0, 13).replace('-', '').toUpperCase()}`;
        await tx.cardRefund.create({
          data: {
            id,
            userId,
            cardPaymentId: paymentId,
            idempotencyKey: key,
            requestHash: hash,
            reference,
            reason: body.reason.trim(),
          },
        });
        await this.ledger.postJournal(
          tx,
          { cardRefundId: id, reference },
          payment.journal.entries.map((entry) => ({
            ledgerAccountId: entry.ledgerAccountId,
            currency: entry.currency,
            amountMinor: -entry.amountMinor,
          })),
        );
        const purchase = payment.transactions.find(
          (transaction) => transaction.direction === 'debit',
        );
        if (!purchase) throw new Error('Completed card payment has no history record.');
        await tx.transaction.update({ where: { id: purchase.id }, data: { status: 'refunded' } });
        await tx.transaction.create({
          data: {
            id: randomUUID(),
            accountId: account.id,
            currency: account.currency,
            merchantId: purchase.merchantId,
            amountMinor: payment.billingAmountMinor,
            direction: 'credit',
            kind: 'refund',
            category: purchase.category,
            timestamp: new Date(),
            status: 'refunded',
            paymentMethod: 'card',
            location: purchase.location,
            reference,
            notes: body.reason.trim(),
            cardPaymentId: paymentId,
            cardRefundId: id,
          },
        });
        await tx.cardPayment.update({
          where: { id: paymentId },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
        await cardAudit(tx, card, 'PAYMENT_REFUNDED', { paymentId, refundId: id });
        return publicCardPayment(
          await tx.cardPayment.findUniqueOrThrow({
            where: { id: paymentId },
            include: paymentInclude,
          }),
        );
      },
      { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 15000 },
    );
  }
}
