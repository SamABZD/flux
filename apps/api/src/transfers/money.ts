import { TransferError } from './transfer-error';

export const MAX_AMOUNT_MINOR = 100_000_000;
export const QUOTE_LIFETIME_MS = 45_000;
export const ceilDiv = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator - 1n) / denominator;

export function convertMinor(
  amountMinor: number,
  fromUsdMicros: number,
  toUsdMicros: number,
  maximumMinor = 2_000_000_000,
) {
  if (
    !Number.isSafeInteger(maximumMinor) ||
    maximumMinor < 1 ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 0 ||
    amountMinor > maximumMinor
  )
    throw new TransferError('INVALID_AMOUNT', 'The amount is outside the supported range.');
  if (
    !Number.isSafeInteger(fromUsdMicros) ||
    fromUsdMicros <= 0 ||
    !Number.isSafeInteger(toUsdMicros) ||
    toUsdMicros <= 0
  )
    throw new TransferError('INVALID_PAIR', 'This currency pair is unavailable.');
  const value = ceilDiv(BigInt(amountMinor) * BigInt(fromUsdMicros), BigInt(toUsdMicros));
  if (value > BigInt(maximumMinor))
    throw new TransferError('INVALID_AMOUNT', 'The converted amount exceeds the supported limit.');
  return Number(value);
}
export function calculateQuote(
  destinationAmountMinor: number,
  sourceUsdMicros: number,
  destinationUsdMicros: number,
) {
  if (
    !Number.isSafeInteger(destinationAmountMinor) ||
    destinationAmountMinor < 1 ||
    destinationAmountMinor > MAX_AMOUNT_MINOR
  )
    throw new TransferError('INVALID_AMOUNT', 'Enter an amount between 0.01 and 1,000,000.00.');
  if (
    !Number.isSafeInteger(sourceUsdMicros) ||
    sourceUsdMicros <= 0 ||
    !Number.isSafeInteger(destinationUsdMicros) ||
    destinationUsdMicros <= 0
  )
    throw new TransferError('INVALID_PAIR', 'This currency pair is unavailable.');
  const principal = BigInt(
    convertMinor(destinationAmountMinor, destinationUsdMicros, sourceUsdMicros),
  );

  const minimum = ceilDiv(50n * 1_000_000n, BigInt(sourceUsdMicros));
  const percentage = ceilDiv(principal * 40n, 10_000n);
  const fee = percentage > minimum ? percentage : minimum;
  if (principal + fee > 2_000_000_000n)
    throw new TransferError('INVALID_AMOUNT', 'This amount exceeds the supported transfer limit.');
  const rateScaled = (BigInt(sourceUsdMicros) * 1_000_000n) / BigInt(destinationUsdMicros);
  const rateLabel = `${rateScaled / 1_000_000n}.${String(rateScaled % 1_000_000n).padStart(6, '0')}`;
  return {
    sourceAmountMinor: Number(principal),
    destinationAmountMinor,
    feeMinor: Number(fee),
    totalDebitMinor: Number(principal + fee),
    rateLabel,
  };
}
export function quoteExpired(expiresAt: Date, now: Date) {
  return expiresAt.getTime() <= now.getTime();
}
export function availableMinor(balanceMinor: number, pendingMinor: number) {
  return balanceMinor - pendingMinor;
}
