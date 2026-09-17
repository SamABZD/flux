import {
  ArrowDownLeft,
  ArrowUpRight,
  Basket,
  BowlFood,
  Car,
  Coffee,
  FirstAid,
  FilmSlate,
  HouseLine,
  ShoppingBag,
  AirplaneTilt,
  Repeat,
  Wallet,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { Merchant, Transaction } from './types';
import { Badge } from '@/design-system/badge';
import { formatDate, categoryNames, transactionAmount, accessibleAmount } from './format';
import { Link, useLocation } from 'react-router';

const icons: Record<string, Icon> = {
  dining: BowlFood,
  coffee: Coffee,
  transport: Car,
  groceries: Basket,
  shopping: ShoppingBag,
  travel: AirplaneTilt,
  health: FirstAid,
  entertainment: FilmSlate,
  utilities: HouseLine,
  subscriptions: Repeat,
  income: ArrowDownLeft,
  transfers: ArrowUpRight,
};
export function MerchantIcon({ merchant }: { merchant: Merchant }) {
  const Icon = icons[merchant.icon] ?? Wallet;
  return (
    <span className="merchant-icon" aria-hidden="true">
      <Icon size={22} weight="regular" />
    </span>
  );
}
export function StatusBadge({ status }: { status: Transaction['status'] }) {
  return (
    <Badge
      tone={
        status === 'failed'
          ? 'error'
          : status === 'pending'
            ? 'warning'
            : status === 'refunded'
              ? 'success'
              : 'neutral'
      }
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
export function TransactionRows({
  items,
  compact = false,
}: {
  items: Transaction[];
  compact?: boolean;
}) {
  const location = useLocation();
  const from = encodeURIComponent(location.pathname + location.search);
  return (
    <ul className={`transaction-list ${compact ? 'transaction-list--compact' : ''}`}>
      {items.map((transaction) => (
        <li key={transaction.id}>
          <Link className="transaction-row" to={`/transactions/${transaction.id}?from=${from}`}>
            <MerchantIcon merchant={transaction.merchant} />
            <div className="transaction-merchant">
              <span className="transaction-name">{transaction.merchant.name}</span>
              <span className="transaction-meta">
                {categoryNames[transaction.category]}
                <span aria-hidden="true"> · </span>
                <time dateTime={transaction.timestamp}>
                  {formatDate(transaction.timestamp, true)}
                </time>
              </span>
            </div>
            {!compact && (
              <span className="transaction-account">{transaction.currency} account</span>
            )}
            <div className="transaction-value">
              <span
                className={`money ${transaction.direction === 'credit' ? 'money--positive' : ''} ${transaction.status === 'failed' ? 'money--failed' : ''}`}
                aria-label={accessibleAmount(transaction)}
              >
                {transactionAmount(transaction)}
              </span>
              <span className="transaction-value-meta">
                {transaction.status !== 'completed' ? (
                  <StatusBadge status={transaction.status} />
                ) : (
                  <span>{transaction.currency}</span>
                )}
              </span>
            </div>
            <ArrowUpRight className="transaction-arrow" size={17} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
