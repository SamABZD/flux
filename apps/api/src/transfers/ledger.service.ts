import { Injectable } from '@nestjs/common';
import type { Currency, Prisma, TransferQuote } from '../generated/prisma/client';

export type Posting = { ledgerAccountId: string; currency: Currency; amountMinor: number };
export function transferPostings(quote: TransferQuote): Posting[] {
  return [
    {
      ledgerAccountId: `customer:${quote.sourceAccountId}`,
      currency: quote.sourceCurrency,
      amountMinor: -quote.totalDebitMinor,
    },
    {
      ledgerAccountId: `fx:${quote.sourceCurrency}`,
      currency: quote.sourceCurrency,
      amountMinor: quote.sourceAmountMinor,
    },
    {
      ledgerAccountId: `fee:${quote.sourceCurrency}`,
      currency: quote.sourceCurrency,
      amountMinor: quote.feeMinor,
    },
    {
      ledgerAccountId: `fx:${quote.destinationCurrency}`,
      currency: quote.destinationCurrency,
      amountMinor: -quote.destinationAmountMinor,
    },
    {
      ledgerAccountId:
        quote.kind === 'exchange'
          ? `customer:${quote.destinationAccountId}`
          : `external:${quote.destinationCurrency}`,
      currency: quote.destinationCurrency,
      amountMinor: quote.destinationAmountMinor,
    },
  ];
}
@Injectable()
export class LedgerService {
  async post(
    tx: Prisma.TransactionClient,
    transferId: string,
    reference: string,
    quote: TransferQuote,
  ) {
    const postings = transferPostings(quote);
    return this.postJournal(tx, { transferId, reference }, postings);
  }
  async postJournal(
    tx: Prisma.TransactionClient,
    identity: {
      reference: string;
      transferId?: string;
      cardPaymentId?: string;
      cardRefundId?: string;
    },
    postings: Posting[],
  ) {
    if (postings.length < 2) throw new Error('A journal requires balanced postings.');
    const sums = new Map<Currency, bigint>();
    for (const posting of postings) {
      if (!Number.isSafeInteger(posting.amountMinor) || posting.amountMinor === 0)
        throw new Error('Invalid ledger amount.');
      sums.set(posting.currency, (sums.get(posting.currency) ?? 0n) + BigInt(posting.amountMinor));
    }
    if ([...sums.values()].some((sum) => sum !== 0n)) throw new Error('Unbalanced ledger journal.');
    const ledgerAccounts = await tx.ledgerAccount.findMany({
      where: { id: { in: postings.map((posting) => posting.ledgerAccountId) } },
      select: { id: true, accountId: true, currency: true },
    });
    for (const posting of postings) {
      const account = ledgerAccounts.find((item) => item.id === posting.ledgerAccountId);
      if (!account || account.currency !== posting.currency)
        throw new Error('Ledger posting currency does not match its account.');
    }
    const journal = await tx.ledgerJournal.create({
      data: { ...identity, entries: { create: postings } },
    });
    const deltas = new Map<string, number>();
    for (const posting of postings) {
      const account = ledgerAccounts.find((a) => a.id === posting.ledgerAccountId);
      if (account?.accountId)
        deltas.set(account.accountId, (deltas.get(account.accountId) ?? 0) + posting.amountMinor);
    }
    for (const [id, delta] of [...deltas].sort(([a], [b]) => a.localeCompare(b)))
      await tx.account.update({
        where: { id },
        data: { balanceMinor: { increment: delta } },
      });
    for (const id of deltas.keys()) {
      const projected = await tx.account.findUniqueOrThrow({ where: { id } });
      const ledger = await tx.ledgerEntry.aggregate({
        where: { ledgerAccountId: `customer:${id}` },
        _sum: { amountMinor: true },
      });
      if (projected.balanceMinor !== ledger._sum.amountMinor)
        throw new Error('Ledger/account projection mismatch.');
    }
    return journal;
  }
}
