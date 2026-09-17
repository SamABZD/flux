import { Link } from 'react-router';
import { ArrowUpRight, Receipt } from '@phosphor-icons/react';
import { Avatar } from '@/design-system/avatar';
import { Badge } from '@/design-system/badge';
import { EmptyState, ErrorState } from '@/design-system/feedback';
import { TransactionSkeleton } from '@/features/finance/loading';
import { formatDate } from '@/features/finance/format';
import { useGetCardPaymentsQuery } from './cards-api';
import type { CardPayment } from './types';
import { cardMoney, methodNames } from './types';
export function CardPaymentStatus({ status }: { status: CardPayment['status'] }) {
  return (
    <Badge
      tone={
        status === 'COMPLETED'
          ? 'success'
          : status === 'DECLINED'
            ? 'error'
            : status === 'REFUNDED'
              ? 'info'
              : 'neutral'
      }
    >
      {
        {
          COMPLETED: 'Completed',
          DECLINED: 'Declined',
          REFUNDED: 'Refunded',
          PENDING: 'Pending',
          AUTHORIZED: 'Authorized',
          REVERSED: 'Reversed',
        }[status]
      }
    </Badge>
  );
}
export function CardPaymentList({ payments }: { payments: CardPayment[] }) {
  return (
    <ul className="card-payment-list">
      {payments.map((payment) => (
        <li key={payment.id}>
          <Link to={`/cards/payments/${payment.id}`}>
            <Avatar name={payment.merchantName} />
            <div className="card-payment-copy">
              <strong>{payment.merchantName}</strong>
              <span>
                {methodNames[payment.paymentType]} · {formatDate(payment.createdAt)}
              </span>
              {payment.decline && (
                <span className="card-decline-preview">{payment.decline.message}</span>
              )}
            </div>
            <div className="card-payment-value">
              <strong>{cardMoney(payment.amountMinor, payment.currency)}</strong>
              <CardPaymentStatus status={payment.status} />
            </div>
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
export function CardHistory({ cardId }: { cardId: string }) {
  const query = useGetCardPaymentsQuery(cardId, { refetchOnMountOrArgChange: true });
  return query.isError ? (
    <ErrorState title="Card activity unavailable" onRetry={() => void query.refetch()} />
  ) : !query.currentData ? (
    <TransactionSkeleton rows={3} />
  ) : query.currentData.length ? (
    <CardPaymentList payments={query.currentData} />
  ) : (
    <EmptyState
      icon={<Receipt size={28} />}
      title="Ready for its first purchase"
      description="Payments and declined attempts will appear here when you use this card."
    />
  );
}
