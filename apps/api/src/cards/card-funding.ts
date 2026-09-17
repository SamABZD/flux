import type { Account, Currency, FxRate } from '../generated/prisma/client';
import { availableMinor, calculateQuote, convertMinor } from '../transfers/money';
import type { Posting } from '../transfers/ledger.service';
export const fundingOrder: Currency[] = ['USD', 'EUR', 'GBP', 'AED'];
export interface Funding {
  accountId: string;
  billingCurrency: Currency;
  billingAmountMinor: number;
  principalMinor: number;
  feeMinor: number;
  sourceUsdMicros: number;
  destinationUsdMicros: number;
  rateLabel: string;
  fundingReason: 'MATCHING_CURRENCY' | 'FX_FALLBACK';
  limitAmountUsdMinor: number;
}
export function isSupportedCurrency(currency: string): currency is Currency {
  return fundingOrder.some((value) => value === currency);
}
export function resolveCardFunding(
  accounts: Account[],
  holds: Map<string, number>,
  rates: FxRate[],
  amountMinor: number,
  currency: Currency,
): Funding | null {
  const destinationRate = rates.find((rate) => rate.currency === currency)?.usdMicros;
  if (!destinationRate) return null;
  const candidates = accounts
    .filter((a) => a.status === 'active')
    .sort((a, b) => {
      const rank = (value: Currency) => (value === currency ? -1 : fundingOrder.indexOf(value));
      return rank(a.currency) - rank(b.currency) || a.id.localeCompare(b.id);
    });
  for (const account of candidates) {
    const sourceRate = rates.find((rate) => rate.currency === account.currency)?.usdMicros;
    if (!sourceRate) continue;
    const matching = account.currency === currency;
    const quote = matching
      ? {
          sourceAmountMinor: amountMinor,
          feeMinor: 0,
          totalDebitMinor: amountMinor,
          rateLabel: '1.000000',
        }
      : calculateQuote(amountMinor, sourceRate, destinationRate);
    if (availableMinor(account.balanceMinor, holds.get(account.id) ?? 0) < quote.totalDebitMinor)
      continue;
    return {
      accountId: account.id,
      billingCurrency: account.currency,
      billingAmountMinor: quote.totalDebitMinor,
      principalMinor: quote.sourceAmountMinor,
      feeMinor: quote.feeMinor,
      sourceUsdMicros: sourceRate,
      destinationUsdMicros: destinationRate,
      rateLabel: quote.rateLabel,
      fundingReason: matching ? 'MATCHING_CURRENCY' : 'FX_FALLBACK',
      limitAmountUsdMinor: convertMinor(quote.totalDebitMinor, sourceRate, 1000000),
    };
  }
  return null;
}
export function cardPaymentPostings(
  funding: Funding,
  amountMinor: number,
  currency: Currency,
): Posting[] {
  if (funding.billingCurrency === currency)
    return [
      { ledgerAccountId: `customer:${funding.accountId}`, currency, amountMinor: -amountMinor },
      { ledgerAccountId: `external:${currency}`, currency, amountMinor },
    ];
  return [
    {
      ledgerAccountId: `customer:${funding.accountId}`,
      currency: funding.billingCurrency,
      amountMinor: -funding.billingAmountMinor,
    },
    {
      ledgerAccountId: `fx:${funding.billingCurrency}`,
      currency: funding.billingCurrency,
      amountMinor: funding.principalMinor,
    },
    ...(funding.feeMinor
      ? [
          {
            ledgerAccountId: `fee:${funding.billingCurrency}`,
            currency: funding.billingCurrency,
            amountMinor: funding.feeMinor,
          },
        ]
      : []),
    { ledgerAccountId: `fx:${currency}`, currency, amountMinor: -amountMinor },
    { ledgerAccountId: `external:${currency}`, currency, amountMinor },
  ];
}
