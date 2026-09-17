import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { RecipientDto } from './transfer.dto';
import type { Recipient } from '../generated/prisma/client';
import { TransferError } from './transfer-error';

export const COUNTRIES = [
  'US',
  'GB',
  'FR',
  'DE',
  'AE',
  'LB',
  'CA',
  'NL',
  'ES',
  'IE',
  'IT',
  'CH',
] as const;
export function publicRecipient(recipient: Recipient) {
  return {
    id: recipient.id,
    name: recipient.name,
    type: recipient.type,
    country: recipient.country,
    preferredCurrency: recipient.preferredCurrency,
    supportedCurrencies: recipient.supportedCurrencies,
    bankName: recipient.bankName,
    accountIdentifier: recipient.accountIdentifier,
    lastUsedAt: recipient.lastUsedAt?.toISOString() ?? null,
    status: recipient.status,
  };
}
@Injectable()
export class RecipientsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(userId: string) {
    return (
      await this.prisma.recipient.findMany({
        where: { userId },
        orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
      })
    ).map(publicRecipient);
  }
  async create(userId: string, body: RecipientDto) {
    if (!COUNTRIES.some((country) => country === body.country))
      throw new TransferError('INVALID_COUNTRY', 'Choose a supported country.');
    const name = body.name.trim(),
      bankName = body.bankName.trim();
    if (name.length < 2 || bankName.length < 2)
      throw new TransferError('INVALID_RECIPIENT', 'Enter the recipient’s name and bank name.');
    return publicRecipient(
      await this.prisma.recipient.create({
        data: { ...body, name, bankName, userId, supportedCurrencies: [body.preferredCurrency] },
      }),
    );
  }
}
