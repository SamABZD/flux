import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Receipt } from '@phosphor-icons/react';
import { PageHeader } from '@/design-system/headers';
import { Button } from '@/design-system/button';
import { SearchInput } from '@/design-system/search-input';
import { EmptyState, ErrorState } from '@/design-system/feedback';
import { useGetTransactionsQuery } from '@/features/finance/finance-api';
import { TransactionSkeleton } from '@/features/finance/loading';
import { TransactionRows } from '@/features/finance/transaction-rows';
import { TransactionFilters } from '@/features/finance/transaction-filters';
import { activeFilterCount, filterParams, readFilters } from '@/features/finance/filters';
import type { TransactionFilters as Filters } from '@/features/finance/types';

export function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const invalidDates = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );
  const query = useGetTransactionsQuery(filters, { skip: invalidDates });
  const data = query.currentData;
  const filtered = Boolean(activeFilterCount(filters) || filters.search);
  useEffect(() => {
    if (data && data.totalPages > 0 && data.page > data.totalPages) {
      const next = new URLSearchParams(params);
      next.set('page', String(data.totalPages));
      setParams(next, { replace: true });
    }
  }, [data, params, setParams]);
  function update(next: Partial<Filters>) {
    setParams(filterParams({ ...filters, ...next, page: 1 }), { replace: true });
  }
  function page(next: number) {
    setParams(filterParams({ ...filters, page: next }));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const clear = () => setParams({}, { replace: true });
  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every movement, with the details that matter."
        actions={
          <Link className="button button--secondary" to="/accounts">
            Your accounts
          </Link>
        }
      />
      <section className="transaction-explorer" aria-label="Transaction explorer">
        <SearchInput
          className="transaction-search"
          label="Search transactions"
          placeholder="Search merchant, category, or reference"
          value={filters.search}
          maxLength={160}
          onValueChange={(search) => update({ search })}
        />
        <TransactionFilters value={filters} onChange={update} onClear={clear} />
        <div className="transaction-list-heading">
          <span role="status">
            {invalidDates
              ? 'Check your date range'
              : query.isFetching
                ? 'Loading transactions…'
                : data
                  ? `${data.total} transaction${data.total === 1 ? '' : 's'}${filtered ? ' found' : ''}`
                  : 'Transaction history'}
          </span>
          <span>Amount</span>
        </div>
        {invalidDates ? (
          <ErrorState
            title="Check your date range"
            description="The end date must be on or after the start date. Open Filters to adjust it."
          />
        ) : query.isError ? (
          <ErrorState
            title="Transactions couldn’t load"
            description="Your filters are saved. Try loading the results again."
            onRetry={() => void query.refetch()}
          />
        ) : !data ? (
          <TransactionSkeleton rows={20} />
        ) : data.items.length ? (
          <TransactionRows items={data.items} />
        ) : (
          <EmptyState
            icon={<Receipt size={30} />}
            title={filtered ? 'No transactions match' : 'No transactions here yet'}
            description={
              filtered
                ? 'Try a different search or widen your filters to see more activity.'
                : filters.page > 1
                  ? 'You’ve reached the end of this history. Return to the first page.'
                  : 'Transactions will appear here as your accounts become active.'
            }
            action={
              filtered ? (
                <Button variant="secondary" onClick={clear}>
                  Clear all filters
                </Button>
              ) : filters.page > 1 ? (
                <Button variant="secondary" onClick={() => page(1)}>
                  First page
                </Button>
              ) : (
                <Link className="button button--secondary" to="/accounts">
                  View your accounts
                </Link>
              )
            }
          />
        )}
        {data && data.total > 0 && !invalidDates && (
          <nav className="transaction-pagination" aria-label="Transaction pages">
            <p>
              Page {Math.min(data.page, data.totalPages)} of {data.totalPages}{' '}
              <span>· {filters.limit} per page</span>
            </p>
            <div>
              <Button
                variant="secondary"
                disabled={data.page <= 1 || query.isFetching}
                leadingIcon={<ArrowLeft size={16} />}
                onClick={() => page(Math.max(1, data.page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={data.page >= data.totalPages || query.isFetching}
                leadingIcon={<ArrowRight size={16} />}
                onClick={() => page(data.page + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        )}
      </section>
      <p className="finance-footnote">
        All times in UTC. “Money in” includes income, refunds, and incoming transfers.
      </p>
    </>
  );
}
