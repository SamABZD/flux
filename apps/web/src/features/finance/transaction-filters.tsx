import { useState } from 'react';
import { SlidersHorizontal } from '@phosphor-icons/react';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { Input } from '@/design-system/input';
import { ResponsiveDialog } from '@/design-system/modal';
import { ErrorState } from '@/design-system/feedback';
import { useGetAccountsQuery, useGetMerchantsQuery } from './finance-api';
import { activeFilterCount } from './filters';
import { categoryNames } from './format';
import { categories, statuses } from './types';
import type { TransactionFilters as Filters } from './types';

function FilterFields({
  value,
  onChange,
  advanced = false,
}: {
  value: Filters;
  onChange: (next: Partial<Filters>) => void;
  advanced?: boolean;
}) {
  const accounts = useGetAccountsQuery();
  const merchants = useGetMerchantsQuery(undefined, { skip: !advanced });
  return (
    <>
      <Select
        label="Account"
        value={value.account}
        onChange={(event) => onChange({ account: event.target.value })}
      >
        <option value="">All accounts</option>
        {accounts.data?.items.map((account) => (
          <option key={account.id} value={account.id}>
            {account.currency} · {account.name}
          </option>
        ))}
      </Select>
      <Select
        label="Category"
        value={value.category}
        onChange={(event) => onChange({ category: event.target.value as Filters['category'] })}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {categoryNames[category]}
          </option>
        ))}
      </Select>
      <Select
        label="Direction"
        value={value.direction}
        onChange={(event) => onChange({ direction: event.target.value as Filters['direction'] })}
      >
        <option value="">Money in & out</option>
        <option value="credit">Money in</option>
        <option value="debit">Money out</option>
      </Select>
      {accounts.isError && (
        <ErrorState title="Account filters unavailable" onRetry={() => void accounts.refetch()} />
      )}
      {advanced && (
        <>
          <Select
            label="Status"
            value={value.status}
            onChange={(event) => onChange({ status: event.target.value as Filters['status'] })}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status[0]?.toUpperCase()}
                {status.slice(1)}
              </option>
            ))}
          </Select>
          <Select
            label="Merchant"
            value={value.merchant}
            onChange={(event) => onChange({ merchant: event.target.value })}
          >
            <option value="">All merchants</option>
            {merchants.data?.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </Select>
          <div className="filter-dates">
            <Input
              label="From date"
              type="date"
              value={value.dateFrom}
              max={value.dateTo || undefined}
              onChange={(event) => onChange({ dateFrom: event.target.value })}
            />
            <Input
              label="To date"
              type="date"
              value={value.dateTo}
              min={value.dateFrom || undefined}
              onChange={(event) => onChange({ dateTo: event.target.value })}
            />
          </div>
          {merchants.isError && (
            <ErrorState
              title="Merchant filters unavailable"
              onRetry={() => void merchants.refetch()}
            />
          )}
        </>
      )}
    </>
  );
}

export function TransactionFilters({
  value,
  onChange,
  onClear,
}: {
  value: Filters;
  onChange: (next: Partial<Filters>) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const count = activeFilterCount(value);
  const invalidDates = Boolean(draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo);
  return (
    <>
      <div className="transaction-filter-bar">
        <div className="desktop-filter-fields">
          <FilterFields value={value} onChange={onChange} />
        </div>
        <Button
          className={count ? 'filter-trigger filter-trigger--active' : 'filter-trigger'}
          variant="secondary"
          leadingIcon={<SlidersHorizontal size={18} />}
          onClick={() => {
            setDraft(value);
            setOpen(true);
          }}
        >
          Filters{count ? ` (${count})` : ''}
        </Button>
        {(count > 0 || value.search) && (
          <Button variant="ghost" onClick={onClear}>
            Clear all
          </Button>
        )}
      </div>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Filter transactions"
        description="Narrow your activity by account, category, and date."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalidDates) {
              onChange(draft);
              setOpen(false);
            }
          }}
        >
          <div className="filter-sheet-fields">
            <FilterFields
              value={draft}
              onChange={(next) => setDraft({ ...draft, ...next })}
              advanced
            />
          </div>
          {invalidDates && (
            <p className="field-error" role="alert">
              Choose an end date on or after the start date.
            </p>
          )}
          <div className="dialog-actions">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              Clear all
            </Button>
            <Button type="submit" disabled={invalidDates}>
              Apply filters
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </>
  );
}
