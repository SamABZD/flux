import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Account, Recipient, TransferQuote } from '../generated/prisma/client';
import type { ExecuteTransferDto } from './transfer.dto';
import { LedgerService } from './ledger.service';
import { DemoClearingService } from './demo-clearing.service';
import { TransferError } from './transfer-error';
import { availableMinor, quoteExpired } from './money';
import { publicRecipient } from './recipients.service';
import { fingerprint, lockRequest, validateKey, verifyReplay } from '../common/idempotency';

const transferInclude = {
  recipient: true,
  sourceAccount: true,
  destinationAccount: true,
} satisfies Prisma.TransferInclude;
type TransferRecord = Prisma.TransferGetPayload<{ include: typeof transferInclude }>;
export function publicTransfer(transfer: TransferRecord) {
  return {
    id: transfer.id,
    kind: transfer.kind,
    recipient: transfer.recipient ? publicRecipient(transfer.recipient) : null,
    sourceAccount: {
      id: transfer.sourceAccount.id,
      name: transfer.sourceAccount.name,
      currency: transfer.sourceAccount.currency,
    },
    destinationAccount: transfer.destinationAccount
      ? {
          id: transfer.destinationAccount.id,
          name: transfer.destinationAccount.name,
          currency: transfer.destinationAccount.currency,
        }
      : null,
    sourceCurrency: transfer.sourceCurrency,
    destinationCurrency: transfer.destinationCurrency,
    sourceAmountMinor: transfer.sourceAmountMinor,
    destinationAmountMinor: transfer.destinationAmountMinor,
    feeMinor: transfer.feeMinor,
    totalDebitMinor: transfer.totalDebitMinor,
    rateLabel: transfer.rateLabel,
    status: transfer.status,
    reference: transfer.reference,
    note: transfer.note,
    createdAt: transfer.createdAt.toISOString(),
    completedAt: transfer.completedAt?.toISOString() ?? null,
    failureReason: transfer.failureReason,
  };
}
export function transferFingerprint(body: ExecuteTransferDto) {
  return fingerprint({
    quoteId: body.quoteId,
    sourceAccountId: body.sourceAccountId,
    recipientId: body.recipientId ?? null,
    destinationAccountId: body.destinationAccountId ?? null,
    note: body.note ?? '',
  });
}
@Injectable()
export class TransfersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(DemoClearingService) private readonly clearing: DemoClearingService,
  ) {}
  async list(userId: string) {
    return (
      await this.prisma.transfer.findMany({
        where: { userId },
        include: transferInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      })
    ).map(publicTransfer);
  }
  async get(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findFirst({
      where: { id, userId },
      include: transferInclude,
    });
    if (!transfer) throw new TransferError('TRANSFER_NOT_FOUND', 'Transfer not found.', 404);
    return publicTransfer(transfer);
  }
  async byKey(userId: string, key: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      include: transferInclude,
    });
    return { transfer: transfer ? publicTransfer(transfer) : null };
  }
  async execute(userId: string, key: string, body: ExecuteTransferDto) {
    validateKey(key);
    const fingerprint = transferFingerprint(body);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await lockRequest(tx, userId, key);
          const previous = await tx.transfer.findUnique({
            where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
            include: transferInclude,
          });
          if (previous) {
            verifyReplay(previous, fingerprint);
            return publicTransfer(previous);
          }
          const quote = await tx.transferQuote.findFirst({ where: { id: body.quoteId, userId } });
          if (!quote)
            throw new TransferError('INVALID_QUOTE', 'This quote is unavailable. Get a new quote.');
          if (
            quote.sourceAccountId !== body.sourceAccountId ||
            quote.recipientId !== (body.recipientId ?? null) ||
            quote.destinationAccountId !== (body.destinationAccountId ?? null)
          )
            throw new TransferError(
              'QUOTE_MISMATCH',
              'The transfer details do not match the quote. Get a new quote.',
            );
          const ids = [
            quote.sourceAccountId,
            ...(quote.destinationAccountId ? [quote.destinationAccountId] : []),
          ].sort();
          const locked = await tx.$queryRaw<Account[]>(
            Prisma.sql`SELECT * FROM "Account" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
          );
          if (quoteExpired(quote.expiresAt, new Date()))
            throw new TransferError(
              'QUOTE_EXPIRED',
              'Your quote expired. Refresh it before confirming.',
              409,
            );
          const consumed = await tx.transfer.findUnique({ where: { quoteId: quote.id } });
          if (consumed)
            throw new TransferError(
              'QUOTE_USED',
              'This quote has already been submitted. View the original transfer.',
              409,
              { transferId: consumed.id },
            );
          const source = locked.find((account) => account.id === quote.sourceAccountId);
          if (
            !source ||
            source.userId !== userId ||
            source.status !== 'active' ||
            source.currency !== quote.sourceCurrency
          )
            throw new TransferError(
              'INACTIVE_ACCOUNT',
              'This source account is unavailable. Choose another account.',
            );
          let recipient: Recipient | null = null;
          if (quote.recipientId) {
            const recipients = await tx.$queryRaw<
              Recipient[]
            >`SELECT * FROM "Recipient" WHERE id=${quote.recipientId} FOR UPDATE`;
            recipient = recipients[0] ?? null;
            if (
              !recipient ||
              recipient.userId !== userId ||
              recipient.status !== 'active' ||
              !recipient.supportedCurrencies.includes(quote.destinationCurrency)
            )
              throw new TransferError(
                'INVALID_RECIPIENT',
                'This recipient can no longer receive this transfer.',
              );
          } else {
            const destination = locked.find((account) => account.id === quote.destinationAccountId);
            if (
              !destination ||
              destination.userId !== userId ||
              destination.status !== 'active' ||
              destination.currency !== quote.destinationCurrency
            )
              throw new TransferError(
                'INACTIVE_ACCOUNT',
                'The destination account is unavailable.',
              );
            if (destination.balanceMinor + quote.destinationAmountMinor > 2_000_000_000)
              throw new TransferError(
                'INVALID_AMOUNT',
                'The destination account limit would be exceeded.',
              );
          }
          const holds = await tx.transaction.aggregate({
            where: { accountId: source.id, status: 'pending', direction: 'debit' },
            _sum: { amountMinor: true },
          });
          const available = availableMinor(source.balanceMinor, holds._sum.amountMinor ?? 0);
          if (available < quote.totalDebitMinor)
            throw new TransferError(
              'INSUFFICIENT_FUNDS',
              'Your available balance does not cover this transfer and its fee.',
              422,
              {
                shortfallMinor: quote.totalDebitMinor - available,
                availableBalanceMinor: available,
                currency: source.currency,
              },
            );
          const id = randomUUID(),
            reference = `FLX-${id.slice(0, 8).toUpperCase()}`;
          const transfer = await tx.transfer.create({
            data: {
              id,
              userId,
              kind: quote.kind,
              recipientId: quote.recipientId,
              destinationAccountId: quote.destinationAccountId,
              sourceAccountId: source.id,
              quoteId: quote.id,
              idempotencyKey: key,
              requestHash: fingerprint,
              sourceCurrency: quote.sourceCurrency,
              destinationCurrency: quote.destinationCurrency,
              sourceAmountMinor: quote.sourceAmountMinor,
              destinationAmountMinor: quote.destinationAmountMinor,
              feeMinor: quote.feeMinor,
              totalDebitMinor: quote.totalDebitMinor,
              rateLabel: quote.rateLabel,
              status: 'PROCESSING',
              reference,
              note: body.note ?? '',
            },
          });
          const cleared = await this.clearing.submit(recipient);
          if (!cleared.accepted) {
            return publicTransfer(
              await tx.transfer.update({
                where: { id },
                data: { status: 'FAILED', failureReason: cleared.reason },
                include: transferInclude,
              }),
            );
          }
          await this.ledger.post(tx, id, reference, quote);
          await this.history(tx, quote, recipient, id, reference, body.note ?? '');
          if (recipient)
            await tx.recipient.update({
              where: { id: recipient.id },
              data: { lastUsedAt: new Date() },
            });
          return publicTransfer(
            await tx.transfer.update({
              where: { id: transfer.id },
              data: { status: 'COMPLETED', completedAt: new Date() },
              include: transferInclude,
            }),
          );
        },
        { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 15000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new TransferError(
          'QUOTE_USED',
          'This quote has already been used. Check your recent transfers.',
          409,
        );
      throw error;
    }
  }
  private async history(
    tx: Prisma.TransactionClient,
    quote: TransferQuote,
    recipient: Recipient | null,
    id: string,
    reference: string,
    note: string,
  ) {
    const merchantId = recipient ? `recipient:${recipient.id}` : 'flux-exchange';
    await tx.merchant.upsert({
      where: { id: merchantId },
      create: {
        id: merchantId,
        name: recipient?.name ?? 'Flux currency exchange',
        icon: 'transfers',
      },
      update: {},
    });
    const shared = {
      transferId: id,
      merchantId,
      kind: 'transfer' as const,
      category: 'transfers' as const,
      timestamp: new Date(),
      status: 'completed' as const,
      paymentMethod: 'bank_transfer' as const,
      location: recipient ? recipient.country : 'Between your Flux accounts',
      notes: note,
    };
    await tx.transaction.create({
      data: {
        ...shared,
        id: randomUUID(),
        accountId: quote.sourceAccountId,
        currency: quote.sourceCurrency,
        amountMinor: quote.totalDebitMinor,
        direction: 'debit',
        reference,
      },
    });
    if (quote.destinationAccountId)
      await tx.transaction.create({
        data: {
          ...shared,
          id: randomUUID(),
          accountId: quote.destinationAccountId,
          currency: quote.destinationCurrency,
          amountMinor: quote.destinationAmountMinor,
          direction: 'credit',
          reference: `${reference}-IN`,
        },
      });
  }
}
