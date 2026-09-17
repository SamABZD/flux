import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { TransferQuote } from '../generated/prisma/client';
import type { QuoteDto } from './transfer.dto';
import { TransferError } from './transfer-error';
import { availableMinor, calculateQuote, QUOTE_LIFETIME_MS } from './money';

export function publicQuote(quote: TransferQuote, availableBalanceMinor: number, now = new Date()) {
  return {
    id: quote.id,
    kind: quote.kind,
    sourceAccountId: quote.sourceAccountId,
    recipientId: quote.recipientId,
    destinationAccountId: quote.destinationAccountId,
    sourceCurrency: quote.sourceCurrency,
    destinationCurrency: quote.destinationCurrency,
    sourceAmountMinor: quote.sourceAmountMinor,
    destinationAmountMinor: quote.destinationAmountMinor,
    feeMinor: quote.feeMinor,
    totalDebitMinor: quote.totalDebitMinor,
    rateLabel: quote.rateLabel,
    expiresAt: quote.expiresAt.toISOString(),
    serverNow: now.toISOString(),
    availableBalanceMinor,
    shortfallMinor: Math.max(0, quote.totalDebitMinor - availableBalanceMinor),
    estimatedArrival: 'Usually within a few seconds in this demo',
    rateSource: 'Illustrative demo exchange rates',
  };
}
@Injectable()
export class QuotesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async available(accountId: string, userId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account || account.status !== 'active')
      throw new TransferError('INACTIVE_ACCOUNT', 'Choose an active account that belongs to you.');
    const holds = await this.prisma.transaction.aggregate({
      where: { accountId, status: 'pending', direction: 'debit' },
      _sum: { amountMinor: true },
    });
    return availableMinor(account.balanceMinor, holds._sum.amountMinor ?? 0);
  }
  async create(userId: string, body: QuoteDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: body.sourceAccountId, userId },
    });
    if (!account || account.status !== 'active')
      throw new TransferError('INACTIVE_ACCOUNT', 'Choose an active account that belongs to you.');
    if (account.currency !== body.sourceCurrency)
      throw new TransferError('QUOTE_MISMATCH', 'The source currency does not match this account.');
    if (body.kind === 'send') {
      if (!body.recipientId || body.destinationAccountId)
        throw new TransferError('INVALID_RECIPIENT', 'Select a saved recipient.');
      const recipient = await this.prisma.recipient.findFirst({
        where: { id: body.recipientId, userId, status: 'active' },
      });
      if (!recipient)
        throw new TransferError(
          'INVALID_RECIPIENT',
          'This recipient is unavailable. Choose another recipient.',
        );
      if (!recipient.supportedCurrencies.includes(body.destinationCurrency))
        throw new TransferError(
          'INVALID_PAIR',
          'This recipient’s bank does not support the selected currency.',
        );
    } else {
      if (
        body.recipientId ||
        !body.destinationAccountId ||
        body.destinationAccountId === body.sourceAccountId
      )
        throw new TransferError(
          'INVALID_PAIR',
          'Choose a different currency account to receive this exchange.',
        );
      const destination = await this.prisma.account.findFirst({
        where: { id: body.destinationAccountId, userId, status: 'active' },
      });
      if (
        !destination ||
        destination.currency !== body.destinationCurrency ||
        destination.currency === body.sourceCurrency
      )
        throw new TransferError(
          'INVALID_PAIR',
          'Choose an active destination account in a different currency.',
        );
    }
    const rates = await this.prisma.fxRate.findMany({
      where: { currency: { in: [body.sourceCurrency, body.destinationCurrency] } },
    });
    const sourceRate = rates.find((rate) => rate.currency === body.sourceCurrency)?.usdMicros ?? 0;
    const destinationRate =
      rates.find((rate) => rate.currency === body.destinationCurrency)?.usdMicros ?? 0;
    const calculated = calculateQuote(body.destinationAmountMinor, sourceRate, destinationRate);
    const quote = await this.prisma.transferQuote.create({
      data: {
        ...body,
        ...calculated,
        userId,
        sourceUsdMicros: sourceRate,
        destinationUsdMicros: destinationRate,
        expiresAt: new Date(Date.now() + QUOTE_LIFETIME_MS),
      },
    });
    return publicQuote(quote, await this.available(account.id, userId));
  }
  async get(userId: string, id: string) {
    const quote = await this.prisma.transferQuote.findFirst({ where: { id, userId } });
    if (!quote)
      throw new TransferError(
        'INVALID_QUOTE',
        'This quote could not be found. Get a new quote.',
        404,
      );
    return publicQuote(quote, await this.available(quote.sourceAccountId, userId));
  }
}
