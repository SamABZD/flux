import type {
  Currency,
  Merchant,
  Transaction,
  TransactionCategory,
} from '@/features/finance/types';
export const periods = [
  { value: 'week', label: '7 days' },
  { value: 'month', label: '1 month' },
  { value: 'quarter', label: '3 months' },
  { value: 'half-year', label: '6 months' },
  { value: 'year', label: 'This year' },
] as const;
export type InsightPeriod = (typeof periods)[number]['value'];
export interface InsightFilters {
  period: InsightPeriod;
  baseCurrency: Currency;
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: TransactionCategory;
  merchantId?: string;
  direction?: 'spending' | 'income';
  page?: number;
  limit?: number;
}
export interface TrendPoint {
  date: string;
  amountMinor: number;
  topCategory: TransactionCategory | null;
}
export interface InsightRow {
  transaction: Transaction;
  reportingAmountMinor: number;
  feeOnly: boolean;
}
export interface Analytics {
  selectedMerchant?: Merchant | null;
  asOf: string;
  baseCurrency: Currency;
  accountId: string | null;
  accounts: { id: string; name: string; currency: Currency }[];
  period: InsightPeriod | 'custom';
  range: {
    dateFrom: string;
    dateTo: string;
    previousFrom: string;
    previousTo: string;
    bucket: 'day' | 'month';
  };
  fx: { strategy: string; rates: { currency: Currency; usdMicros: number; updatedAt: string }[] };
  spendingMinor: number;
  previousSpendingMinor: number;
  spendingChangePercent: number | null;
  incomeMinor: number;
  previousIncomeMinor: number;
  incomeChangePercent: number | null;
  netCashFlowMinor: number;
  transfersOutMinor: number;
  transfersInMinor: number;
  previousNetCashFlowMinor: number;
  transactionCount: number;
  averageTransactionMinor: number;
  trend: TrendPoint[];
  previousTrend: TrendPoint[];
  categories: {
    category: TransactionCategory;
    amountMinor: number;
    count: number;
    sharePercent: number;
    previousMinor: number;
  }[];
  merchants: { merchant: Merchant; amountMinor: number; count: number; averageMinor: number }[];
  incomeSources: { source: string; amountMinor: number; count: number }[];
  incomeMerchants: { merchant: Merchant; amountMinor: number; count: number }[];
  transactions: {
    items: InsightRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
export interface BudgetItem {
  id: string;
  category: TransactionCategory;
  currency: Currency;
  amountMinor: number;
  spentMinor: number;
  enabled: boolean;
  projectedMinor: number;
  projectedOverMinor: number;
  remainingMinor: number;
  usagePercent: number;
  status: 'WITHIN' | 'NEAR' | 'OVER' | 'AT_LIMIT' | 'DISABLED';
  daysRemaining: number;
  dailyAllowanceMinor: number;
  revision: number;
  transactionCount: number;
  reportAmountMinor: number;
  reportSpentMinor: number;
}
export interface Budgets {
  month: string;
  baseCurrency: Currency;
  editable: boolean;
  items: BudgetItem[];
  totalPlannedMinor: number;
  totalSpentMinor: number;
  daysRemaining: number;
  fx: string;
}
export type Cadence = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';
export interface Subscription {
  id: string;
  label: string;
  merchant: Merchant;
  accountId: string;
  currency: Currency;
  amountMinor: number;
  cadence: Cadence;
  status: SubscriptionStatus;
  source: string;
  revision: number;
  anchorDate: string;
  nextPaymentDate: string | null;
  monthlyEquivalentMinor: number;
  reportMonthlyMinor: number;
  spentThisMonthMinor: number;
  spentThisYearMinor: number;
  paymentCard: { id: string; label: string; last4: string; type: string; status: string } | null;
  cardWarning: string | null;
  lastPaidAt: string | null;
  paymentCount: number;
  transactions: Transaction[];
}
export interface SubscriptionCandidate {
  key: string;
  merchant: Merchant;
  accountId: string;
  currency: Currency;
  amountMinor: number;
  cadence: Cadence;
  nextPaymentDate: string;
  evidenceIds: string[];
  lastPaidAt: string;
  confidence: string;
}
export interface Subscriptions {
  asOf: string;
  baseCurrency: Currency;
  accounts: Analytics['accounts'];
  items: Subscription[];
  candidates: SubscriptionCandidate[];
  upcoming: {
    subscriptionId: string;
    label: string;
    merchant: Merchant;
    date: string;
    amountMinor: number;
    currency: Currency;
    reportAmountMinor: number;
    cardWarning: string | null;
  }[];
  monthlyEquivalentMinor: number;
  yearlyEquivalentMinor: number;
  upcomingTotalMinor: number;
  actualSubscriptionSpendingMinor: number;
  month: string;
}
export interface NewSubscription {
  accountId: string;
  merchantName: string;
  merchantId?: string;
  label: string;
  amountMinor: number;
  cadence: Cadence;
  nextPaymentDate: string;
  source: 'MANUAL' | 'DETECTED';
}
export interface SubscriptionEdit {
  revision: number;
  label?: string;
  amountMinor?: number;
  cadence?: Cadence;
  nextPaymentDate?: string;
  status?: SubscriptionStatus;
}
