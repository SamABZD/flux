import type { Card, CardAuditAction, Prisma } from '../generated/prisma/client';
import { OperationError } from '../common/operation-error';
import { effectiveCardStatus, monthBounds } from './card-policy';
export async function lockCard(tx: Prisma.TransactionClient, userId: string, id: string) {
  const rows = await tx.$queryRaw<
    Card[]
  >`SELECT * FROM "Card" WHERE id=${id} AND "userId"=${userId} FOR UPDATE`;
  const card = rows[0];
  if (!card) throw new OperationError('INVALID_CARD', 'Select a card in your demo workspace.', 404);
  return card;
}
export async function cardAudit(
  tx: Prisma.TransactionClient,
  card: Pick<Card, 'id' | 'userId'>,
  action: CardAuditAction,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  if (Object.keys(metadata).some((key) => /pan|cvv|number|pin|encrypted|cipher/i.test(key)))
    throw new Error('Sensitive fields are forbidden in card audit events.');
  return tx.cardAuditEvent.create({
    data: { cardId: card.id, userId: card.userId, action, metadata },
  });
}
export async function spendingThisMonth(
  tx: Prisma.TransactionClient,
  cardId: string,
  now = new Date(),
) {
  const period = monthBounds(now);
  const usage = await tx.cardPayment.aggregate({
    where: { cardId, status: 'COMPLETED', createdAt: { gte: period.start, lt: period.end } },
    _sum: { limitAmountUsdMinor: true },
  });
  return usage._sum.limitAmountUsdMinor ?? 0;
}
export function publicCard(card: Card, holderName: string, spentMinor: number, now = new Date()) {
  const period = monthBounds(now);
  return {
    id: card.id,
    type: card.type,
    status: effectiveCardStatus(card, now),
    label: card.label,
    network: card.network,
    holderName,
    last4: card.last4,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    credentialVersion: card.credentialVersion,
    lastCredentialRotation: card.lastCredentialRotation.toISOString(),
    createdAt: card.createdAt.toISOString(),
    terminatedAt: card.terminatedAt?.toISOString() ?? null,
    monthlyLimit: {
      enabled: card.monthlyLimitMinor !== null,
      amountMinor: card.monthlyLimitMinor,
      currency: 'USD' as const,
      spentMinor,
      remainingMinor:
        card.monthlyLimitMinor === null ? null : Math.max(0, card.monthlyLimitMinor - spentMinor),
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
    },
    security: {
      onlinePayments: card.onlinePayments,
      ...(card.type === 'PHYSICAL'
        ? {
            contactlessPayments: card.contactlessPayments,
            atmWithdrawals: card.atmWithdrawals,
            magstripePayments: card.magstripePayments,
            locationSecurity: card.locationSecurity,
          }
        : {}),
    },
    walletEnrolled: card.walletEnrolled,
  };
}
