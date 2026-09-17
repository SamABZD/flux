import { Link } from 'react-router';
import { ArrowUpRight, Wallet } from '@phosphor-icons/react';
import { PageHeader } from '@/design-system/headers';
import { Badge } from '@/design-system/badge';
import { EmptyState, ErrorState } from '@/design-system/feedback';
import { useGetAccountsQuery } from '@/features/finance/finance-api';
import { AccountSkeleton } from '@/features/finance/loading';
import { currencyNames, formatMoney } from '@/features/finance/format';

export function AccountsPage() {
  const query = useGetAccountsQuery();
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Four currencies. One clear view."
        actions={
          <Link className="button button--secondary" to="/transactions">
            All transactions <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        }
      />
      {query.isError ? (
        <ErrorState
          title="Accounts couldn’t load"
          description="Check your connection, then try again."
          onRetry={() => void query.refetch()}
        />
      ) : !query.data ? (
        <AccountSkeleton />
      ) : !query.data.items.length ? (
        <EmptyState
          icon={<Wallet size={28} />}
          title="Your accounts will live here"
          description="There are no currency accounts in this workspace yet."
          action={
            <Link className="button button--secondary" to="/home">
              Return home
            </Link>
          }
        />
      ) : (
        <div className="account-grid">
          {query.data.items.map((account) => (
            <Link className="account-tile" to={`/accounts/${account.id}`} key={account.id}>
              <div className="account-tile-top">
                <span className="currency-symbol">{account.currency}</span>
                <Badge>{account.status === 'active' ? 'Active' : 'Frozen'}</Badge>
              </div>
              <h2>{currencyNames[account.currency]}</h2>
              <p className="account-tile-balance">
                {formatMoney(account.balanceMinor, account.currency)}
              </p>
              <div className="account-tile-bottom">
                <div>
                  <span>{account.name}</span>
                  <span>{account.identifier}</span>
                </div>
                <ArrowUpRight size={22} aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="finance-footnote">Fictional demo accounts. Balances as of 14 September 2026.</p>
    </>
  );
}
