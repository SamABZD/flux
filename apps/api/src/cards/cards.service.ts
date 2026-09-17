import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Card } from '../generated/prisma/client';
import { OperationError } from '../common/operation-error';
import type { CreateCardDto, PatchCardDto } from './card.dto';
import { cardStateDecline, declineMessages, effectiveCardStatus } from './card-policy';
import { cardAudit, lockCard, publicCard, spendingThisMonth } from './card-records';
import { CardCredentialsService } from './card-credentials.service';
const securityKeys = [
  'onlinePayments',
  'contactlessPayments',
  'atmWithdrawals',
  'magstripePayments',
  'locationSecurity',
] as const;
@Injectable()
export class CardsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(CardCredentialsService) private readonly credentials: CardCredentialsService,
  ) {}
  async present(tx: Prisma.TransactionClient, card: Card) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: card.userId } });
    return publicCard(card, user.name, await spendingThisMonth(tx, card.id));
  }
  async list(userId: string) {
    return this.db.$transaction(
      async (tx) => {
        const cards = await tx.card.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const result = [];
        for (const card of cards) result.push(await this.present(tx, card));
        return result;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async get(userId: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        const card = await tx.card.findFirst({ where: { id, userId } });
        if (!card) throw new OperationError('INVALID_CARD', 'Card not found.', 404);
        return this.present(tx, card);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async create(userId: string, body: CreateCardDto) {
    const label = body.label.trim();
    if (label.length < 2)
      throw new OperationError('INVALID_LABEL', 'Use a label with 2–32 characters.', 400);
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`cards:${userId}`},0))::text`;
        if (body.type === 'SINGLE_USE') {
          const existing = await tx.card.findFirst({
            where: { userId, type: 'SINGLE_USE', status: { in: ['ACTIVE', 'FROZEN', 'PENDING'] } },
          });
          if (existing) {
            const locked = await lockCard(tx, userId, existing.id);
            if (effectiveCardStatus(locked) === 'EXPIRED')
              await tx.card.update({
                where: { id: locked.id },
                data: { status: 'EXPIRED', walletEnrolled: false },
              });
            else if (locked.status !== 'TERMINATED')
              throw new OperationError(
                'SINGLE_USE_EXISTS',
                'You already have a single-use card. Open it from Cards.',
                409,
              );
          }
        }
        const id = randomUUID(),
          details = this.credentials.create(id),
          now = new Date();
        const card = await tx.card.create({
          data: {
            id,
            userId,
            type: body.type,
            label,
            last4: details.last4,
            expiryMonth: now.getUTCMonth() + 1,
            expiryYear: now.getUTCFullYear() + 3,
            credentials: {
              create: {
                encryptedNumber: details.encryptedNumber,
                encryptedCvv: details.encryptedCvv,
              },
            },
          },
        });
        await cardAudit(tx, card, 'CREATED', { type: card.type, label });
        return this.present(tx, card);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new OperationError(
          'SINGLE_USE_EXISTS',
          'You already have an active single-use card.',
          409,
        );
      throw error;
    }
  }
  async patch(userId: string, id: string, body: PatchCardDto) {
    return this.db.$transaction(async (tx) => {
      const card = await lockCard(tx, userId, id),
        status = effectiveCardStatus(card);
      if (status === 'TERMINATED' || status === 'EXPIRED' || status === 'PENDING')
        throw new OperationError(
          'CARD_UNAVAILABLE',
          'This card cannot be changed. Its history remains available.',
          409,
        );
      const data: Prisma.CardUpdateInput = {};
      if (body.label !== undefined) {
        const label = body.label.trim();
        if (label.length < 2)
          throw new OperationError('INVALID_LABEL', 'Use a label with 2–32 characters.', 400);
        if (label !== card.label) {
          data.label = label;
          await cardAudit(tx, card, 'LABEL_CHANGED', { label });
        }
      }
      if (body.status !== undefined && body.status !== card.status) {
        data.status = body.status;
        await cardAudit(tx, card, body.status === 'FROZEN' ? 'FROZEN' : 'UNFROZEN');
      }
      if (
        body.monthlyLimitMinor !== undefined &&
        body.monthlyLimitMinor !== card.monthlyLimitMinor
      ) {
        data.monthlyLimitMinor = body.monthlyLimitMinor;
        await cardAudit(tx, card, 'LIMIT_CHANGED', {
          amountMinor: body.monthlyLimitMinor,
          currency: 'USD',
        });
      }
      for (const key of securityKeys) {
        if (body[key] === undefined) continue;
        if (card.type !== 'PHYSICAL' && key !== 'onlinePayments')
          throw new OperationError(
            'SETTING_NOT_SUPPORTED',
            'That control is only available on physical cards.',
            400,
          );
        const value = body[key];
        if (value !== card[key]) {
          data[key] = value;
          await cardAudit(tx, card, 'SECURITY_CHANGED', { setting: key, enabled: value });
        }
      }
      const updated = await tx.card.update({ where: { id }, data });
      return this.present(tx, updated);
    });
  }
  async terminate(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const card = await lockCard(tx, userId, id);
      if (card.type === 'PHYSICAL')
        throw new OperationError(
          'TERMINATION_NOT_SUPPORTED',
          'This demo only supports virtual-card termination.',
          400,
        );
      if (card.status === 'TERMINATED') return this.present(tx, card);
      const updated = await tx.card.update({
        where: { id },
        data: { status: 'TERMINATED', terminatedAt: new Date(), walletEnrolled: false },
      });
      await cardAudit(tx, card, 'TERMINATED');
      return this.present(tx, updated);
    });
  }
  async reveal(userId: string, id: string, pin: string) {
    const result = await this.db.$transaction(async (tx) => {
      const card = await lockCard(tx, userId, id);
      if (pin !== '4821') {
        await cardAudit(tx, card, 'REVEAL_DENIED');
        return { allowed: false as const };
      }
      const status = effectiveCardStatus(card);
      if (status === 'TERMINATED' || status === 'EXPIRED' || status === 'PENDING')
        throw new OperationError(
          'DETAILS_UNAVAILABLE',
          'Details are unavailable for this inactive card.',
          409,
        );
      const record = await tx.cardCredential.findUniqueOrThrow({ where: { cardId: id } });
      const values = this.credentials.reveal(id, record);
      await cardAudit(tx, card, 'DETAILS_REVEALED', { credentialVersion: card.credentialVersion });
      return {
        allowed: true as const,
        details: {
          ...values,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          credentialVersion: card.credentialVersion,
          revealedAt: new Date().toISOString(),
          hideAfterSeconds: 30,
          synthetic: true as const,
        },
      };
    });
    if (!result.allowed)
      throw new OperationError(
        'REAUTH_FAILED',
        'That demo PIN is incorrect. Use 4821 for this simulation.',
        403,
      );
    return result.details;
  }
  async enrollWallet(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const card = await lockCard(tx, userId, id);
      const decline =
        cardStateDecline(card) ??
        (card.type === 'SINGLE_USE' ? 'SINGLE_USE_WALLET_NOT_ALLOWED' : null);
      if (decline) {
        await cardAudit(tx, card, 'WALLET_ENROLLMENT_DECLINED', { reason: decline });
        return { approved: false as const, declineReason: decline, ...declineMessages[decline] };
      }
      if (!card.walletEnrolled) {
        await tx.card.update({ where: { id }, data: { walletEnrolled: true } });
        await cardAudit(tx, card, 'WALLET_ENROLLED');
      }
      return {
        approved: true as const,
        declineReason: null,
        message: 'Card added to the demo wallet.',
        action: 'You can now simulate a digital-wallet payment. No real wallet is connected.',
      };
    });
  }
  async audit(userId: string, id: string) {
    await this.get(userId, id);
    return (
      await this.db.cardAuditEvent.findMany({
        where: { cardId: id, userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      })
    ).map((event) => ({
      id: event.id,
      action: event.action,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    }));
  }
}
