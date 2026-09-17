import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowUpRight } from '@phosphor-icons/react';
import { Badge } from '@/design-system/badge';
import { PageHeader, SectionHeader } from '@/design-system/headers';
import { ErrorState } from '@/design-system/feedback';
import { AccountSelector } from '@/features/finance/account-selector';
import { BalanceSkeleton } from '@/features/finance/loading';
import { QuickActions } from '@/features/finance/quick-actions';
import { RecentActivity } from '@/features/finance/recent-activity';
import { useGetAccountQuery, useGetAccountsQuery } from '@/features/finance/finance-api';
import { currencyNames, formatMoney } from '@/features/finance/format';

export function AccountDetailPage() {
  const { id = '' } = useParams();
  const query = useGetAccountQuery(id);
  const accounts = useGetAccountsQuery();
  const account = query.currentData;
  return (
    <>
      <Link className="text-link back-link" to="/accounts">
        <ArrowLeft size={17} aria-hidden="true" /> All accounts
      </Link>
      <PageHeader
        title={account ? `${currencyNames[account.currency]} account` : 'Account details'}
        description="A closer look at your everyday money."
      />
      {accounts.isError ? (
        <ErrorState title="Account switcher unavailable" onRetry={() => void accounts.refetch()} />
      ) : (
        <AccountSelector
          accounts={accounts.data?.items ?? []}
          selected={id}
          loading={accounts.isLoading}
        />
      )}
      <section className="account-detail-summary">
        {query.isError ? (
          <ErrorState
            title="Account unavailable"
            description="This account may not exist, or the connection was interrupted."
            onRetry={() => void query.refetch()}
          />
        ) : !account ? (
          <BalanceSkeleton />
        ) : (
          <>
            <div>
              <div className="balance-top">
                <span>Current balance</span>
                <Badge>{account.status === 'active' ? 'Active' : 'Frozen'}</Badge>
              </div>
              <div className="balance-value">
                {formatMoney(account.balanceMinor, account.currency)}
                {account.currency !== 'AED' && (
                  <span className="balance-currency">{account.currency}</span>
                )}
              </div>
              <QuickActions />
            </div>
            <dl className="account-details">
              <div>
                <dt>Available balance</dt>
                <dd>{formatMoney(account.availableBalanceMinor, account.currency)}</dd>
              </div>
              <div>
                <dt>Pending payments</dt>
                <dd>{formatMoney(account.pendingMinor, account.currency)}</dd>
              </div>
              <div>
                <dt>Account name</dt>
                <dd>{account.name}</dd>
              </div>
              <div>
                <dt>Demo account identifier</dt>
                <dd>{account.identifier}</dd>
              </div>
            </dl>
          </>
        )}
      </section>
      <section className="finance-activity">
        <SectionHeader
          title="Recent activity"
          description="Transactions belonging to this account."
          action={
            <Link className="text-link" to={`/transactions?account=${encodeURIComponent(id)}`}>
              See all transactions <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <RecentActivity account={id} />
      </section>
      <p className="finance-footnote">
        Available balance is the current balance less pending payments. Demo identifiers cannot
        receive money.
      </p>
    </>
  );
}
