import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { OperationError } from './operation-error';
export function fingerprint(value: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function validateKey(key: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
    throw new OperationError('INVALID_KEY', 'A valid idempotency key is required.', 400);
}
export async function lockRequest(
  tx: Prisma.TransactionClient,
  userId: string,
  key: string,
  scope = '',
) {
  validateKey(key);
  const identity = scope ? `${scope}:${userId}:${key}` : `${userId}:${key}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity},0))::text`;
}
export function verifyReplay(existing: { requestHash: string }, expected: string) {
  if (existing.requestHash !== expected)
    throw new OperationError(
      'IDEMPOTENCY_CONFLICT',
      'This retry key belongs to a different request.',
      409,
    );
}
