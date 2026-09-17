import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { TransactionCategory } from '../generated/prisma/enums';
import type { TransactionQueryDto } from './finance.dto';

export const DEMO_USER_ID = 'demo-alex';
export const DEMO_AS_OF = '2026-09-14T12:00:00.000Z';

export function transactionWhere(query: TransactionQueryDto): Prisma.TransactionWhereInput {
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo)
    throw new BadRequestException('The start date must be on or before the end date.');
  const where: Prisma.TransactionWhereInput = { account: { userId: DEMO_USER_ID } };
  if (query.account) where.accountId = query.account;
  if (query.category) where.category = query.category;
  if (query.status) where.status = query.status;
  if (query.direction) where.direction = query.direction;
  if (query.merchant) where.merchantId = query.merchant;
  if (query.dateFrom || query.dateTo)
    where.timestamp = {
      ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
      ...(query.dateTo
        ? { lt: new Date(new Date(`${query.dateTo}T00:00:00.000Z`).getTime() + 86400000) }
        : {}),
    };
  const search = query.search?.trim();
  if (search) {
    const categories = Object.values(TransactionCategory).filter((category) =>
      category.includes(search.toLowerCase()),
    );
    where.OR = [
      { merchant: { name: { contains: search, mode: 'insensitive' } } },
      { notes: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { category: { in: categories } },
    ];
  }
  return where;
}
