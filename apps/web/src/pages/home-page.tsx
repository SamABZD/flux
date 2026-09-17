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
import { useGetCardsQuery } from '@/features/cards/cards-api';
import { cardTypeNames } from '@/features/cards/types';
import { DashboardCard } from '@/features/workspace/dashboard-card';

function HomeCard() {
  const query = useGetCardsQuery();
  const available = query.data?.filter(
    (card) => card.status !== 'TERMINATED' && card.status !== 'EXPIRED',
  );
  const card = available?.find((item) => item.type === 'PHYSICAL') ?? available?.[0];

  return (
    <section className="home-card-panel" aria-labelledby="home-card-title">
      <div className="home-card-heading">
        <h2 id="home-card-title">My card</h2>
        <Link className="text-link" to="/cards">
          All cards <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {query.isError ? (
        <ErrorState title="Card unavailable" onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <div className="home-card-skeleton" role="status">
          <span className="sr-only">Loading your card</span>
        </div>
      ) : card ? (
        <>
          <Link className="home-card-link" to={`/cards/${card.id}`}>
            <DashboardCard card={card} />
          </Link>
          <div className="home-card-meta">
            <span>
              <strong>{card.label}</strong>
              <small>
                {cardTypeNames[card.type]} · ending {card.last4}
              </small>
            </span>
            <Link className="text-link" to={`/cards/${card.id}`}>
              Manage card <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : (
        <div className="home-card-empty">
          <p>No active cards</p>
          <Link className="text-link" to="/cards">
            Add a card <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

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
      <div className="home-grid finance-home">
        <PageHeader
          title="Your money, in focus."
          description={`Welcome back, ${accounts.data?.user.name.split(' ')[0] ?? 'Alex'}. Here’s where you stand.`}
          actions={<Avatar name={accounts.data?.user.name ?? 'Alex Morgan'} />}
        />
        <HomeCard />
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
      </div>
      <div className="home-lower-grid">
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
        <section className="spending-panel" aria-label="Monthly spending">
          <SpendingPreview account={selected} />
        </section>
      </div>
      <p className="finance-footnote">
        Demo snapshot · 14 September 2026. All balances and transactions are fictional. Times shown
        in UTC.
      </p>
    </>
  );
}
