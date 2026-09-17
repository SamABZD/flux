import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';
import type { Card, Prisma } from '../generated/prisma/client';
import { createCredential, revealCredential } from '../../prisma/card-credentials.cjs';
import { cardAudit } from './card-records';
@Injectable()
export class CardCredentialsService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Environment, true>) {}
  create(id: string, previousLast4?: string) {
    return createCredential(
      id,
      this.config.get('CARD_ENCRYPTION_KEY', { infer: true }),
      previousLast4,
    );
  }
  reveal(cardId: string, record: { encryptedNumber: string; encryptedCvv: string }) {
    return revealCredential(
      cardId,
      this.config.get('CARD_ENCRYPTION_KEY', { infer: true }),
      record,
    );
  }
  async rotate(tx: Prisma.TransactionClient, card: Card) {
    if (card.type !== 'SINGLE_USE')
      throw new Error('Only single-use credentials rotate after payment.');
    const details = this.create(card.id, card.last4);
    await tx.cardCredential.update({
      where: { cardId: card.id },
      data: { encryptedNumber: details.encryptedNumber, encryptedCvv: details.encryptedCvv },
    });
    await tx.card.update({
      where: { id: card.id },
      data: {
        last4: details.last4,
        credentialVersion: { increment: 1 },
        lastCredentialRotation: new Date(),
      },
    });
    await cardAudit(tx, card, 'CREDENTIALS_ROTATED', {
      fromVersion: card.credentialVersion,
      toVersion: card.credentialVersion + 1,
    });
  }
}
