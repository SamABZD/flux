import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { Input } from '@/design-system/input';
import { currencies } from '@/features/finance/types';
import { periods } from './types';
import type { Analytics, InsightFilters } from './types';

export function readInsightFilters(params: URLSearchParams): InsightFilters {
  const period = periods.find((item) => item.value === params.get('period'))?.value ?? 'month';
  const baseCurrency = currencies.find((item) => item === params.get('baseCurrency')) ?? 'USD';
  return {
    period,
    baseCurrency,
    ...(params.get('accountId') ? { accountId: params.get('accountId')! } : {}),
    ...(params.get('dateFrom') ? { dateFrom: params.get('dateFrom')! } : {}),
    ...(params.get('dateTo') ? { dateTo: params.get('dateTo')! } : {}),
  };
}
export function InsightNavigation({
  active,
}: {
  active: 'analytics' | 'budgets' | 'subscriptions';
}) {
  const [params] = useSearchParams();
  const currency = currencies.find((item) => item === params.get('baseCurrency'));
  return (
    <nav className="insight-nav" aria-label="Financial insights">
      {['analytics', 'budgets', 'subscriptions'].map((item) => (
        <Link
          key={item}
          to={'/' + item + (currency ? '?baseCurrency=' + currency : '')}
          aria-current={active === item ? 'page' : undefined}
        >
          {item[0]!.toUpperCase() + item.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
export function InsightControls({ accounts }: { accounts: Analytics['accounts'] }) {
  const [params, setParams] = useSearchParams();
  const filters = readInsightFilters(params);
  const [from, setFrom] = useState(filters.dateFrom ?? '');
  const [to, setTo] = useState(filters.dateTo ?? '');
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };
  return (
    <div className="insight-controls">
      <div className="insight-periods" role="group" aria-label="Analytics period">
        {periods.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-pressed={filters.period === item.value && !filters.dateFrom}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('period', item.value);
              next.delete('dateFrom');
              next.delete('dateTo');
              next.delete('page');
              setFrom('');
              setTo('');
              setParams(next, { replace: true });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="insight-selectors">
        <Select
          label="Reporting currency"
          value={filters.baseCurrency}
          onChange={(event) => update('baseCurrency', event.target.value)}
        >
          {currencies.map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </Select>
        <Select
          label="Analytics account"
          value={filters.accountId ?? ''}
          onChange={(event) => update('accountId', event.target.value)}
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.currency} account
            </option>
          ))}
        </Select>
      </div>
      <details className="insight-custom-range">
        <summary>Choose dates</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams(params);
            next.set('dateFrom', from);
            next.set('dateTo', to);
            next.delete('page');
            setParams(next, { replace: true });
          }}
        >
          <Input
            label="From date"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            required
          />
          <Input
            label="To date"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            required
          />
          <Button type="submit" variant="secondary">
            Apply dates
          </Button>
        </form>
      </details>
    </div>
  );
}
export const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(date),
  );
export const rangeLabel = (from: string, to: string) =>
  `${shortDate(from)} – ${shortDate(to)} ${to.slice(0, 4)}`;
export function Comparison({
  current,
  previous,
  percent,
}: {
  current: string;
  previous: string;
  percent: number | null;
}) {
  return (
    <p className="insight-comparison">
      {percent === null
        ? 'No positive net spending in the comparison period'
        : percent === 0
          ? 'Same spending as the comparison period'
          : `${Math.abs(percent).toFixed(1)}% ${percent > 0 ? 'more' : 'less'} spending`}
      <span>
        {current} compared with {previous}
      </span>
    </p>
  );
}
