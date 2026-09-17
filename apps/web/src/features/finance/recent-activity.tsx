import { Link } from 'react-router';
import { Receipt } from '@phosphor-icons/react';
import { EmptyState, ErrorState } from '@/design-system/feedback';
import { useGetTransactionsQuery } from './finance-api';
import { TransactionSkeleton } from './loading';
import { TransactionRows } from './transaction-rows';

export function RecentActivity({ account }: { account: string }) {
  const query = useGetTransactionsQuery({ account, limit: 6 });
  return query.isError ? (
    <ErrorState
      title="Activity couldn’t load"
      description="Your balance is still available. Try loading the activity again."
      onRetry={() => void query.refetch()}
    />
  ) : !query.currentData ? (
    <TransactionSkeleton />
  ) : query.currentData.items.length ? (
    <TransactionRows items={query.currentData.items} compact />
  ) : (
    <EmptyState
      icon={<Receipt size={28} />}
      title="No activity in this account yet"
      description="When this account has transactions, you’ll find them here."
      action={
        <Link className="button button--secondary" to="/transactions">
          Browse all transactions
        </Link>
      }
    />
  );
}
