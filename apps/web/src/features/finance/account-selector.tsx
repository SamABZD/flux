import { Link } from 'react-router';
import { Skeleton } from '@/design-system/feedback';
import { formatMoney } from './format';
import type { Account } from './types';

export function AccountSelector({
  accounts,
  selected,
  onSelect,
  hidden = false,
  loading = false,
}: {
  accounts: Account[];
  selected: string;
  onSelect?: (id: string) => void;
  hidden?: boolean;
  loading?: boolean;
}) {
  if (loading) return <Skeleton height="82px" label="Loading currency accounts" />;
  if (!accounts.length) return <p className="finance-caption">No currency accounts yet.</p>;
  return (
    <nav className="account-selector" aria-label="Currency accounts">
      {accounts.map((account) => {
        const content = (
          <>
            <span>{account.currency}</span>
            <span className="account-selector-balance">
              {hidden ? '••••' : formatMoney(account.balanceMinor, account.currency)}
            </span>
          </>
        );
        return onSelect ? (
          <button
            key={account.id}
            type="button"
            aria-pressed={selected === account.id}
            onClick={() => onSelect(account.id)}
          >
            {content}
          </button>
        ) : (
          <Link
            key={account.id}
            to={`/accounts/${account.id}`}
            aria-current={selected === account.id ? 'page' : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
