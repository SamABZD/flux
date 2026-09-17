import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CategoryUpdateDto, TransactionQueryDto } from './finance.dto';
import { DEMO_USER_ID, transactionWhere } from './transaction-query';
import { toAccount, toTransaction } from './finance-mappers';

@Injectable()
export class FinanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async accounts() {
    const [user, accounts, holds] = await this.prisma.$transaction(
      async (database) => {
        const user = await database.user.findUnique({ where: { id: DEMO_USER_ID } });
        const accounts = await database.account.findMany({
          where: { userId: DEMO_USER_ID },
          orderBy: { id: 'asc' },
        });
        const holds = await database.transaction.groupBy({
          by: ['accountId'],
          where: { account: { userId: DEMO_USER_ID }, status: 'pending', direction: 'debit' },
          _sum: { amountMinor: true },
        });
        return [user, accounts, holds] as const;
      },
      { isolationLevel: 'RepeatableRead' },
    );
    if (!user) throw new NotFoundException('Demo user has not been seeded.');
    const order = ['USD', 'EUR', 'GBP', 'AED'];
    return {
      user,
      items: accounts
        .sort((a, b) => order.indexOf(a.currency) - order.indexOf(b.currency))
        .map((account) =>
          toAccount(
            account,
            holds.find((hold) => hold.accountId === account.id)?._sum.amountMinor ?? 0,
          ),
        ),
    };
  }
  async account(id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, userId: DEMO_USER_ID } });
    if (!account) throw new NotFoundException('Account not found.');
    const hold = await this.prisma.transaction.aggregate({
      where: { accountId: id, status: 'pending', direction: 'debit' },
      _sum: { amountMinor: true },
    });
    return toAccount(account, hold._sum.amountMinor ?? 0);
  }
  async transactions(query: TransactionQueryDto) {
    const where = transactionWhere(query);

    const [total, items] = await this.prisma.$transaction(
      async (transaction) => {
        const total = await transaction.transaction.count({ where });
        const items = await transaction.transaction.findMany({
          where,
          include: { merchant: true, account: true },
          orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        return [total, items] as const;
      },
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      items: items.map(toTransaction),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }
  async transaction(id: string) {
    const item = await this.prisma.transaction.findFirst({
      where: { id, account: { userId: DEMO_USER_ID } },
      include: { merchant: true, account: true },
    });
    if (!item) throw new NotFoundException('Transaction not found.');
    return toTransaction(item);
  }
  async updateCategory(id: string, body: CategoryUpdateDto) {
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.transaction.findFirst({
        where: { id, account: { userId: DEMO_USER_ID } },
      });
      if (!item) throw new NotFoundException('Transaction not found.');

      await tx.transaction.updateMany({
        where: {
          ...(item.cardPaymentId ? { cardPaymentId: item.cardPaymentId } : { id }),
          account: { userId: DEMO_USER_ID },
        },
        data: { category: body.category },
      });
    });
    return this.transaction(id);
  }
  merchants() {
    return this.prisma.merchant.findMany({
      where: { transactions: { some: { account: { userId: DEMO_USER_ID } } } },
      orderBy: { name: 'asc' },
    });
  }
}
