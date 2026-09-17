import type { Currency, TransactionCategory } from '@/features/finance/types';
export type CardType = 'PHYSICAL' | 'VIRTUAL' | 'SINGLE_USE';
export type CardStatus = 'ACTIVE' | 'FROZEN' | 'TERMINATED' | 'EXPIRED' | 'PENDING';
export const paymentTypes = [
  'ONLINE',
  'CONTACTLESS',
  'CHIP_AND_PIN',
  'MAGSTRIPE',
  'ATM',
  'RECURRING',
  'DIGITAL_WALLET',
] as const;
export type CardPaymentType = (typeof paymentTypes)[number];
export interface CardSecurity {
  onlinePayments: boolean;
  contactlessPayments?: boolean;
  atmWithdrawals?: boolean;
  magstripePayments?: boolean;
  locationSecurity?: boolean;
}
export interface Card {
  id: string;
  type: CardType;
  status: CardStatus;
  label: string;
  network: string;
  holderName: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  credentialVersion: number;
  lastCredentialRotation: string;
  createdAt: string;
  terminatedAt: string | null;
  monthlyLimit: {
    enabled: boolean;
    amountMinor: number | null;
    currency: 'USD';
    spentMinor: number;
    remainingMinor: number | null;
    periodStart: string;
    periodEnd: string;
  };
  security: CardSecurity;
  walletEnrolled: boolean;
}
export type CardPatch = Partial<CardSecurity> & {
  label?: string;
  status?: 'ACTIVE' | 'FROZEN';
  monthlyLimitMinor?: number | null;
};
export interface CardPaymentRequest {
  cardId: string;
  credentialVersion: number;
  merchantName: string;
  merchantCategory: TransactionCategory;
  amountMinor: number;
  currency: string;
  paymentType: CardPaymentType;
  isSubscription?: boolean;
  requiresPin?: boolean;
  merchantLocation?: string;
  cardholderLocation?: string;
  note?: string;
}
export interface CardPayment {
  id: string;
  merchantName: string;
  merchantCategory: TransactionCategory;
  amountMinor: number;
  currency: string;
  paymentType: CardPaymentType;
  isSubscription: boolean;
  merchantLocation: string | null;
  cardholderLocation: string | null;
  status: 'PENDING' | 'AUTHORIZED' | 'COMPLETED' | 'DECLINED' | 'REFUNDED' | 'REVERSED';
  declineReason: string | null;
  decline: { message: string; action: string } | null;
  account: { id: string; name: string; currency: Currency } | null;
  billingCurrency: Currency | null;
  billingAmountMinor: number | null;
  principalMinor: number | null;
  feeMinor: number | null;
  rateLabel: string | null;
  fundingReason: string | null;
  limitAmountUsdMinor: number | null;
  card: Pick<Card, 'id' | 'label' | 'type' | 'last4' | 'credentialVersion'>;
  currentCredentialVersion: number;
  reference: string;
  note: string;
  createdAt: string;
  authorizedAt: string | null;
  completedAt: string | null;
  refundedAt: string | null;
  refund: { id: string; reference: string; reason: string; createdAt: string } | null;
}
export interface CardAudit {
  id: string;
  action: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
}
export interface WalletOutcome {
  approved: boolean;
  reason?: string;
  message: string;
  action?: string;
}
export const cardTypeNames: Record<CardType, string> = {
  PHYSICAL: 'Physical',
  VIRTUAL: 'Virtual',
  SINGLE_USE: 'Single-use',
};
export const cardStatusNames: Record<CardStatus, string> = {
  ACTIVE: 'Active',
  FROZEN: 'Frozen',
  TERMINATED: 'Terminated',
  EXPIRED: 'Expired',
  PENDING: 'Pending',
};
export const methodNames: Record<CardPaymentType, string> = {
  ONLINE: 'Online',
  CONTACTLESS: 'Contactless',
  CHIP_AND_PIN: 'Chip & PIN',
  MAGSTRIPE: 'Magnetic stripe',
  ATM: 'ATM withdrawal',
  RECURRING: 'Recurring',
  DIGITAL_WALLET: 'Digital wallet',
};
export function cardMoney(minor: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: currency === 'AED' ? 'code' : 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
export function expiry(card: Pick<Card, 'expiryMonth' | 'expiryYear'>) {
  return `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`;
}
