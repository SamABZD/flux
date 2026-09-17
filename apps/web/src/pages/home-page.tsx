import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowUpRight, Eye, EyeSlash } from '@phosphor-icons/react';
import { PageHeader, SectionHeader } from '@/design-system/headers';
import { IconButton } from '@/design-system/button';
import { Avatar } from '@/design-system/avatar';
import { ErrorState } from '@/design-system/feedback';
import { useGetAccountsQuery, useGetOverviewQuery } from '@/features/finance/finance-api';
import { BalanceSkeleton } from '@/features/finance/loading';
import { formatMoney } from '@/features/finance/format';
import { AccountSelector } from '@/features/finance/account-selector';
import { QuickActions } from '@/features/finance/quick-actions';
import { RecentActivity } from '@/features/finance/recent-activity';
import { SpendingPreview } from '@/features/finance/spending-preview';

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const [hidden, setHidden] = useState(false);
  const accounts = useGetAccountsQuery();
  const selected =
    accounts.data?.items.find((account) => account.id === params.get('account'))?.id ?? 'usd';
  const overview = useGetOverviewQuery(selected);

  const data = overview.data;
  return (
    <>
      <PageHeader
        title="Your money, in focus."
        description={`Welcome back, ${accounts.data?.user.name.split(' ')[0] ?? 'Alex'}. Here’s where you stand.`}
        actions={<Avatar name={accounts.data?.user.name ?? 'Alex Morgan'} />}
      />
      <div className="home-grid finance-home">
        <section className="balance-panel" aria-label="Balance overview">
          <div className="balance-top">
            <span>Total balance · USD equivalent</span>
            <IconButton
              label={hidden ? 'Show balance' : 'Hide balance'}
              aria-pressed={hidden}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <EyeSlash size={20} /> : <Eye size={20} />}
            </IconButton>
          </div>
          {overview.isError ? (
            <ErrorState
              title="Balance unavailable"
              description="Your overview couldn’t load. Try reconnecting."
              onRetry={() => void overview.refetch()}
            />
          ) : !data ? (
            <BalanceSkeleton />
          ) : (
            <>
              <div className="balance-value">
                <span
                  aria-label={
                    hidden
                      ? 'Balance hidden'
                      : `${formatMoney(data.totalBalanceMinor, 'USD')} US dollars`
                  }
                >
                  {hidden ? '••••' : formatMoney(data.totalBalanceMinor, 'USD')}
                </span>
              </div>
              <p className="finance-caption">
                Across your four currency accounts. Illustrative demo rates.
              </p>
              <details className="fx-details">
                <summary>How this total is calculated</summary>
                <p>
                  Each balance is converted to USD, then added. 1 EUR = 1.10 USD · 1 GBP = 1.30 USD
                  · 1 AED = 0.272294 USD. Fixed for this demo as of 14 September 2026.
                </p>
              </details>
            </>
          )}
          <QuickActions />
          <div className="account-selector-heading">
            <span>Activity account</span>
            <Link className="text-link" to="/accounts">
              All accounts <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {accounts.isError ? (
            <ErrorState title="Accounts unavailable" onRetry={() => void accounts.refetch()} />
          ) : (
            <AccountSelector
              accounts={accounts.data?.items ?? []}
              loading={accounts.isLoading}
              selected={selected}
              hidden={hidden}
              onSelect={(id) => setParams({ account: id }, { replace: true })}
            />
          )}
        </section>
        <section className="spending-panel" aria-label="Monthly spending">
          <SpendingPreview account={selected} />
        </section>
      </div>
      <section className="finance-activity">
        <SectionHeader
          title="Recent transactions"
          description={`${selected.toUpperCase()} account · latest activity`}
          action={
            <Link className="text-link" to={`/transactions?account=${selected}`}>
              See all transactions <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <RecentActivity account={selected} />
      </section>
      <p className="finance-footnote">
        Demo snapshot · 14 September 2026. All balances and transactions are fictional. Times shown
        in UTC.
      </p>
    </>
  );
}
