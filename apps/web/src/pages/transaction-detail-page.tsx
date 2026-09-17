import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { PageHeader } from '@/design-system/headers';
import { ErrorState } from '@/design-system/feedback';
import { useGetTransactionQuery } from '@/features/finance/finance-api';
import { BalanceSkeleton } from '@/features/finance/loading';
import { MerchantIcon, StatusBadge } from '@/features/finance/transaction-rows';
import { CategoryEditor } from '@/features/finance/category-editor';
import {
  accessibleAmount,
  categoryNames,
  formatDate,
  paymentNames,
  transactionAmount,
  transactionReturnPath,
} from '@/features/finance/format';

export function TransactionDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const query = useGetTransactionQuery(id);
  const transaction = query.currentData;
  return (
    <>
      <Link className="text-link back-link" to={transactionReturnPath(params.get('from'))}>
        <ArrowLeft size={17} aria-hidden="true" /> Back to activity
      </Link>
      <PageHeader title="Transaction details" description="The full story behind this movement." />
      {query.isError ? (
        <ErrorState
          title="Transaction unavailable"
          description="This transaction may not exist, or the connection was interrupted."
          onRetry={() => void query.refetch()}
        />
      ) : !transaction ? (
        <BalanceSkeleton />
      ) : (
        <article className="transaction-detail">
          {transaction.cardPaymentId && (
            <Link className="text-link" to={`/cards/payments/${transaction.cardPaymentId}`}>
              View card payment, rate & fee
            </Link>
          )}
          {transaction.transferId && (
            <Link className="text-link" to={`/payments/transfers/${transaction.transferId}`}>
              View transfer, rate & fee
            </Link>
          )}
          <header className="transaction-detail-hero">
            <MerchantIcon merchant={transaction.merchant} />
            <h2>{transaction.merchant.name}</h2>
            <p
              className={`transaction-detail-amount ${transaction.direction === 'credit' ? 'money--positive' : ''} ${transaction.status === 'failed' ? 'money--failed' : ''}`}
              aria-label={accessibleAmount(transaction)}
            >
              {transactionAmount(transaction)}{' '}
              {transaction.currency !== 'AED' && <span>{transaction.currency}</span>}
            </p>
            <StatusBadge status={transaction.status} />
            {transaction.status === 'failed' && (
              <p className="finance-caption">This payment failed. Your balance was not charged.</p>
            )}
            {transaction.status === 'pending' && (
              <p className="finance-caption">
                Awaiting completion. This payment reduces your available balance.
              </p>
            )}
          </header>
          <dl className="transaction-detail-fields">
            <div>
              <dt>Date & time</dt>
              <dd>{formatDate(transaction.timestamp, true)} UTC</dd>
            </div>
            <div>
              <dt>Direction</dt>
              <dd>
                {transaction.direction === 'credit' ? 'Money in' : 'Money out'} ·{' '}
                {transaction.kind[0]?.toUpperCase()}
                {transaction.kind.slice(1)}
              </dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>
                <Link className="text-link" to={`/accounts/${transaction.accountId}`}>
                  {transaction.account.currency} · {transaction.account.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{categoryNames[transaction.category]}</dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>{paymentNames[transaction.paymentMethod]}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{transaction.location}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd className="transaction-reference">{transaction.reference}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{transaction.notes || 'No notes for this transaction.'}</dd>
            </div>
          </dl>
          <CategoryEditor
            key={`${transaction.id}-${transaction.category}`}
            transaction={transaction}
          />
        </article>
      )}
    </>
  );
}
